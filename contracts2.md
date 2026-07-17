2. PHASE 2 OUTPUT — Pathogen Profile
Produced by: Kishore
Consumed by: Koushik (Phase 3), Sujay (Phase 4 confidence banner + evolution view)
Table name: `pathogen_profiles`
SQL Schema
```sql
CREATE TABLE pathogen_profiles (
    profile_id              SERIAL PRIMARY KEY,
    pathogen_id             TEXT NOT NULL REFERENCES alerts(event_id),
    profile_version         INTEGER NOT NULL DEFAULT 1,
    transmission_mode       TEXT NOT NULL
        CHECK (transmission_mode IN ('airborne','vector','fomite','fecal-oral','contact','unknown')),
    incubation_min_days     REAL NOT NULL,
    incubation_mean_days    REAL NOT NULL,
    incubation_max_days     REAL NOT NULL,
    r0_estimate             REAL NOT NULL,
    r0_lower_95             REAL NOT NULL,
    r0_upper_95             REAL NOT NULL,
    mortality_estimate      REAL NOT NULL,    -- CFR as decimal: 0.02 = 2%
    mortality_lower_95      REAL NOT NULL,
    mortality_upper_95      REAL NOT NULL,
    contagiousness_factor   REAL NOT NULL,    -- 0.0 – 1.0
    seasonal_multiplier     REAL NOT NULL DEFAULT 1.0,
    matched_template        TEXT NOT NULL,    -- disease name or "unknown"
    data_confidence         TEXT NOT NULL
        CHECK (data_confidence IN ('low','medium','high')),
    estimated_at            TEXT NOT NULL     -- ISO 8601
);
```
JSON example — COVID early signal (Jan 30 2020, WHO estimates)
```json
{
  "pathogen_id":           "covid-2020-india-thrissur-001",
  "profile_version":       1,
  "transmission_mode":     "airborne",
  "incubation_days":       { "min": 2, "mean": 5, "max": 14 },
  "R0":                    { "estimate": 2.2, "lower_95": 1.4, "upper_95": 3.9 },
  "mortality_rate":        { "estimate": 0.02, "lower_95": 0.01, "upper_95": 0.04 },
  "contagiousness_factor": 0.72,
  "seasonal_multiplier":   1.0,
  "matched_template":      "unknown",
  "data_confidence":       "low",
  "estimated_at":          "2020-01-30T12:00:00Z"
}
```
> Note: `matched_template = "unknown"` and `data_confidence = "low"` on Day 1 is correct and intentional.
> This is what the system would genuinely have known on Jan 30, 2020.
> As profile_version increments over the demo, confidence rises — that evolution is the story.
Rules Kishore MUST follow
Always output all three values for `R0` and `mortality_rate`. Point estimate alone breaks Phase 3.
`data_confidence = "low"` whenever `matched_template = "unknown"` or `report_count < 10`.
`seasonal_multiplier` > 1.0 only for vector-borne diseases during monsoon (months 6–10). COVID = 1.0.
Every 24h re-estimate increments `profile_version` by 1. Never overwrite — keep all versions.
Phase 3 always reads the latest: `WHERE pathogen_id = $1 ORDER BY profile_version DESC LIMIT 1`.
---
3. PHASE 3 OUTPUT — Simulation Results
Produced by: Koushik
Consumed by: Sujay (Phase 4)
Tables: `seird_results`, `city_status`, `lockdown_recommendations`
Flat file fallback: `confidence_bands.json`
Table: seird_results
```sql
CREATE TABLE seird_results (
    id       SERIAL PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES alerts(event_id),
    city     TEXT NOT NULL,
    day      INTEGER NOT NULL CHECK (day >= 0 AND day <= 89),
    S_p10 REAL NOT NULL, S_p50 REAL NOT NULL, S_p90 REAL NOT NULL,
    E_p10 REAL NOT NULL, E_p50 REAL NOT NULL, E_p90 REAL NOT NULL,
    I_p10 REAL NOT NULL, I_p50 REAL NOT NULL, I_p90 REAL NOT NULL,
    R_p10 REAL NOT NULL, R_p50 REAL NOT NULL, R_p90 REAL NOT NULL,
    D_p10 REAL NOT NULL, D_p50 REAL NOT NULL, D_p90 REAL NOT NULL,
    UNIQUE (event_id, city, day)
);
```
Table: city_status
```sql
CREATE TABLE city_status (
    id                  SERIAL PRIMARY KEY,
    event_id            TEXT NOT NULL REFERENCES alerts(event_id),
    city                TEXT NOT NULL,
    status              TEXT NOT NULL
        CHECK (status IN ('normal','warning','overwhelmed')),
    peak_infection_day  INTEGER NOT NULL,
    peak_I_p50          REAL NOT NULL,
    hospital_capacity   INTEGER NOT NULL,
    UNIQUE (event_id, city)
);
```
Table: lockdown_recommendations
```sql
CREATE TABLE lockdown_recommendations (
    id                       SERIAL PRIMARY KEY,
    event_id                 TEXT NOT NULL REFERENCES alerts(event_id),
    link_id                  TEXT NOT NULL,
    type                     TEXT NOT NULL CHECK (type IN ('rail','air')),
    from_city                TEXT NOT NULL,
    to_city                  TEXT NOT NULL,
    priority_rank            INTEGER NOT NULL,
    infection_pressure_score REAL NOT NULL CHECK (infection_pressure_score >= 0.0 AND infection_pressure_score <= 1.0),
    UNIQUE (event_id, link_id)
);
```
confidence_bands.json (flat file written alongside DB)
```json
{
  "event_id": "covid-2020-india-thrissur-001",
  "generated_at": "2020-02-01T06:00:00Z",
  "cities": {
    "Thrissur": {
      "days": [0, 1, 2, "...89"],
      "I_p10": [1, 1, 2, "..."],
      "I_p50": [1, 2, 4, "..."],
      "I_p90": [1, 4, 9, "..."]
    },
    "Mumbai": {
      "days": [0, 1, 2, "...89"],
      "I_p10": [0, 0, 0, "..."],
      "I_p50": [0, 0, 1, "..."],
      "I_p90": [0, 1, 3, "..."]
    }
  }
}
```
Rules Koushik MUST follow
Never output single-line projections. Every city, every compartment: P10/P50/P90.
If `data_confidence = "low"` from Phase 2, multiply Monte Carlo sampling std dev by 1.5.
`peak_infection_day` computed from `I_p50` curve only, not P90.
`link_id` format: `"{TYPE}-{FROM_CODE}-{TO_CODE}-{SEQ}"` e.g. `"AIR-TRV-BOM-01"`.
Write to both DB tables AND flat JSON/CSV. Phase 4 uses either; flat files are demo fallback.
`event_id` in every row and every file. No exceptions.
Day 54 (March 24, 2020) is the lockdown event. Build a scenario flag for this — Phase 4 uses it for the scenario comparator (No Lockdown / Mar 24 Lockdown / Earlier Lockdown).
