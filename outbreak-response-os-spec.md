# Outbreak Response OS — Condensed Build Spec

4-phase epidemic intelligence pipeline. Converts unstructured web signals → government-grade
outbreak response decisions (confidence bands, not single-line projections). One shared
Supabase (Postgres) database. Demo: COVID-19 India first signal (Thrissur, Kerala, Jan 30 2020),
90-day simulation to Apr 29 2020, validated against covid19india.org.

Pipeline: Phase 1 (Signal Intelligence) → Phase 2 (Pathogen Intelligence) → Phase 3 (Spread
Simulator) → Phase 4 (Command & Control Dashboard).

## Core design principles
- Every alert carries a UUID4 `event_id` minted in Phase 1, propagated through all tables/files.
- `data_confidence` (low/medium/high) propagates: widens Phase 3 Monte Carlo bands, triggers
  Phase 4 warning banners.
- Always output P10/P50/P90 confidence bands — never single-line projections.
- Single Supabase DB shared by all phases, no file-passing, no per-phase storage.

## Database — Supabase (Postgres 15)
- ORM: SQLAlchemy + psycopg2-binary. Region: ap-south-1 (Mumbai).
- Config via `DATABASE_URL` in `.env` — one connection string, no code changes to switch envs.
- Setup: `pip install sqlalchemy psycopg2-binary python-dotenv` → `python db_schema.py` (creates
  tables + seeds COVID demo data) → `pytest integration_test.py -v`.

Tables:
| Table | Owner | Purpose |
|---|---|---|
| alerts | Phase 1 | one row per detected outbreak event |
| pathogen_profiles | Phase 2 | versioned epi profiles (R0, CFR, confidence) |
| seird_results | Phase 3 | P10/P50/P90 SEIRD curves, one row per city per day (90 days × 15 cities) |
| city_status | Phase 3 | peak infection day, hospital capacity status per city |
| lockdown_recommendations | Phase 3 | ranked rail/air links to cut, with infection pressure score |

## Demo scenario constants
- `event_id` = `covid-2020-india-thrissur-001`
- Origin: Thrissur, Kerala; first detected 2020-01-30; pathogen SARS-CoV-2 (early Wuhan strain)
- R0 at detection: 2.2 [1.4–3.9]; CFR: 0.02 [0.01–0.04]
- Simulation window: 2020-01-30 to 2020-04-29 (90 days); lockdown event = Day 54 (Mar 24 2020)
- 15 cities: Thrissur, Kochi, Thiruvananthapuram, Chennai, Bengaluru, Mumbai, Delhi, Hyderabad,
  Pune, Kolkata, Ahmedabad, Jaipur, Lucknow, Nagpur, Coimbatore
- Confidence arc: low (Day 1) → medium (v2, ~Feb 15) → high (as data grows)

---

## PHASE 1 — Signal Intelligence
Monitors NewsAPI, RSS (WHO/MOHFW/Reuters Health), Reddit (r/india, r/COVID19). NLP extracts
locations/symptoms, detects spikes vs 30-day rolling baseline, emits alert JSON to `alerts`.

**Stack**: Python 3.10+, requests/feedparser/praw, spaCy `en_core_web_sm` (NER), APScheduler
(15–30 min cycle), SQLAlchemy, pytest + `responses` (mock HTTP).

**Components**: `news_scraper.py`, `social_scraper.py`, `nlp_pipeline.py`, `entity_resolver.py`
(disambiguates city names, LLM fallback), `anomaly_detector.py` (30-day baseline, flag >2 std
dev), `alert_engine.py` (risk score, mints `event_id`).

**`alerts` table schema**:
| Field | Type | Rule |
|---|---|---|
| event_id | TEXT PK | UUID4, minted here, used by all phases |
| location_city | TEXT | city only, never combined with state |
| location_state | TEXT | state only |
| symptoms_list | TEXT | JSON array as string |
| report_count | INTEGER | raw mention count |
| initial_risk_score | REAL | 0.0–100.0 |
| confidence_score | REAL | 0.0–1.0, never NULL, floor 0.1 |
| source_credibility | REAL | 0.0–1.0, never NULL, floor 0.1 |
| first_detected_at | TEXT | ISO 8601 |
| status | TEXT | active \| resolved \| duplicate |

**Rules**: event_id = `uuid.uuid4()`, never reused. No duplicate alert from same city+symptom
overlap within 6h. Anomaly gating mandatory (only spikes become alerts). Always split city/state.
No Twitter/X. Seed the COVID demo alert row on Day 1.

---

## PHASE 2 — Pathogen Intelligence
Consumes Phase 1 alert → produces quantitative pathogen profile (R0, incubation, CFR) with
Bayesian uncertainty bounds via template matching. Re-estimates every 24h, versioned.

**Stack**: Python 3.10+, scipy.stats/numpy, scipy distributions (PyMC optional),
`disease_templates.json` (India-tuned), APScheduler (24h), Supabase `pathogen_profiles`.

**Components**: `virus_profiler.py` (core estimator), `disease_templates.json` (COVID-19,
Dengue, TB, Cholera, Influenza, Monkeypox), `template_matcher.py` (symptom overlap scoring),
`seasonal_modifier.py` (monsoon/summer multipliers, vector-borne only), `profile_versioner.py`
(saves each 24h re-estimate, keeps full history).

**COVID demo evolution**: v1 (Jan 30, unknown, low, R0 2.2 [1.4–3.9]) → v2 (Feb 15, COVID-19,
medium, R0 2.5 [2.1–3.1]) → v3+ (Mar onward, COVID-19, high, narrowing bands).

**Rules**: Always output R0 as estimate + lower_95 + upper_95 (point estimate alone breaks
Phase 3). `data_confidence='low'` whenever `matched_template='unknown'` OR `report_count<10`.
`seasonal_multiplier>1.0` only for vector-borne diseases in months 6–10; COVID = 1.0. Never
overwrite old profile versions. Phase 3 reads latest via
`WHERE pathogen_id = $1 ORDER BY profile_version DESC LIMIT 1`.

---

## PHASE 3 — Spread Simulator
Takes Phase 2 profile + Phase 1 origin city → simulates spread across 15 cities over 90 days.
100 Monte Carlo iterations sampling Phase 2's uncertainty bounds → P10/P50/P90 bands. Ranks
transport links to cut via betweenness centrality × infection pressure.

**Stack**: Python 3.10+, NetworkX (mobility graph), scipy.integrate.odeint or custom Euler
(SEIRD ODE), numpy (Monte Carlo), city population CSV + hospital capacity JSON,
NetworkX betweenness_centrality, Supabase (`seird_results`, `city_status`,
`lockdown_recommendations`).

**Components**: `mobility_graph.py` (15-city graph, rail/air edges weighted by frequency),
`seird_model.py` (SEIRD ODE: S/E/I/R/D per city, reads R0/incubation/CFR from Phase 2),
`monte_carlo.py` (100 runs → P10/P50/P90), `healthcare_capacity.json`, `capacity_checker.py`
(flags overwhelmed when I > bed count), `lockdown_optimizer.py` (ranks links by
betweenness_centrality × infection_pressure).

**Scenario flags**: Day 54 = Mar 24 2020 lockdown flag. Feeds Phase 4's scenario comparator
(No Lockdown / Mar 24 Lockdown / Earlier Lockdown) — the centerpiece of the demo.

**Rules**: Never output single-line projections (every city, every compartment: P10/P50/P90).
If `data_confidence='low'`, multiply Monte Carlo std dev by 1.5. `peak_infection_day` computed
from I_p50 (not I_p90). Write to both Supabase AND flat JSON/CSV files. `event_id` in every row
and file. Agree `lockdown_recommendations` JSON schema with Phase 4 owner BEFORE coding
`lockdown_optimizer.py`.

---

## PHASE 4 — Command & Control Dashboard
Consumes outputs from all three phases: live signal feed, SEIRD curves with confidence bands,
India choropleth map, scenario comparisons, resource allocation timelines, exportable PDF
situation reports.

**Stack**: Streamlit (primary; React if time permits), Plotly (curves + band shading), Folium +
streamlit-folium (choropleth), reportlab (PDF export), Supabase REST API or SQLAlchemy,
`st.rerun()` every 30s for live feed.

**Components**: `alert_feed` (live Phase 1 stream, polls 30s), `seir_chart` (multi-curve,
P10/P50/P90 shaded, per-city toggle), `india_map` (choropleth by I value, click for detail),
`resource_allocator` (deployment timeline scheduled to `peak_infection_day`),
`scenario_comparator` (No Lockdown / Mar 24 / Earlier Lockdown, lives-saved delta),
`sitrep_exporter` (one-click PDF: map snapshot, key stats, top recommendations).

**Confidence banner**: low → RED "Low data confidence — projections have high uncertainty";
medium → YELLOW "Moderate confidence — monitor for profile updates"; high → no banner. Read
from `pathogen_profiles`, latest version.

**Rules**: P10–P90 shading must be visible on SEIRD chart. Show confidence banner per table
above. Lockdown panel must consume Phase 3 JSON exactly per contract. Resource allocations tied
to `peak_infection_day` per city, not total infected. PDF sitrep self-contained. Never hardcode
Phase 3 data — always read from Supabase. Agree data contracts with Phase 3 owner BEFORE writing
chart code.

---

## Inter-phase data contracts (fixed — changes require version bump)

### Lockdown recommendations (critical contract)
| Field | Type | Rule |
|---|---|---|
| link_id | string | `{TYPE}-{FROM}-{TO}-{SEQ}`, e.g. `AIR-TRV-BOM-01` |
| type | string | exactly `rail` or `air` |
| from_city | string | full name, Title Case, no codes |
| to_city | string | full name, Title Case, no codes |
| priority_rank | integer | 1-indexed, 1 = cut first, no ties |
| infection_pressure_score | float | 0.0–1.0, higher = more dangerous to leave open |

### Confidence propagation
Phase 2 sets `data_confidence` → Phase 3: low = std dev ×1.5 in Monte Carlo, medium/high = face
value → Phase 4: low = RED banner, medium = YELLOW, high = none.

### event_id propagation
Minted once in Phase 1 (`alerts.event_id`). Must equal `pathogen_profiles.pathogen_id` (Phase 2),
and appear in `seird_results.event_id`, `city_status.event_id`,
`lockdown_recommendations.event_id` (Phase 3), and filter all dashboard queries (Phase 4).

---

## Must / must-not quick reference

**Phase 1**: MUST emit UUID event_id, populate confidence_score, dedupe within 6h, gate on
anomaly detection. MUST NOT alert on every mention, merge city+state into one field, hardcode
event_ids, use Twitter/X.

**Phase 2**: MUST output credible intervals for R0+CFR, always set data_confidence, version
profiles and keep history, set low confidence for unknown pathogen. MUST NOT output point
estimates only, overwrite old versions, mark unknown pathogen as high confidence.

**Phase 3**: MUST run 100 Monte Carlo iterations → P10/P50/P90, compute peak_infection_day per
city, include event_id everywhere, flag Day 54 lockdown scenario. MUST NOT output single-line
projections, skip air edges, hardcode populations, start `lockdown_optimizer.py` before schema
is agreed.

**Phase 4**: MUST show P10–P90 shading, show confidence banner when low, read live from
Supabase, make PDF sitrep self-contained. MUST NOT hardcode Phase 3 data, skip the banner, show
only P50, start chart code before contracts are agreed.

---

## Prompting guidance for the AI agent
- Always include the exact relevant CONTRACTS.md section (schemas above) in any code-generation
  prompt for a phase — do not paraphrase field names/types.
- Build one component at a time; specify exact input schema, exact output schema, tech stack,
  and "do not add features beyond what is described."
- No Redis, Celery, Docker, or async task queues — this needs to run and demo, not scale.
- Keep integration_test.py as the source of truth for phase-boundary correctness.
