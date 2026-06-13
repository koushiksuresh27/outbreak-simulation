---
# OutbreakResponseOS — Agent Context

## What this project is
An epidemic outbreak simulation pipeline for Karnataka, India.
Phase 1 (not here) produces alert events. This repo covers:
- Phase 2: Pathogen Intelligence — Bayesian profiling of the pathogen
- Phase 3: Spread Simulator — SEIRD Monte Carlo across Karnataka + 10 inter-state cities

## Network v1 — 22 nodes total
Karnataka districts (KA-01 to KA-12):
KA-01 Bengaluru Urban, KA-02 Mysuru, KA-03 Mangaluru, KA-04 Hubballi-Dharwad,
KA-05 Belagavi, KA-06 Kalaburagi, KA-07 Shivamogga, KA-08 Tumakuru,
KA-09 Vijayapura, KA-10 Hassan, KA-11 Udupi, KA-12 Kolar

Inter-state cities (EXT-01 to EXT-10):
EXT-01 Hyderabad, EXT-02 Chennai, EXT-03 Mumbai, EXT-04 Pune, EXT-05 Goa,
EXT-06 Coimbatore, EXT-07 Kochi, EXT-08 Delhi, EXT-09 Kolkata, EXT-10 Ahmedabad

## Key data files (generated for v1, real CSV to replace later)
- data/generated/nodes.json         ← 22 nodes with population, age bands, coords
- data/generated/hospital_capacity.json
- data/generated/railway_edges.json
- data/generated/air_edges.json
- data/generated/sample_phase1_event.json

## Phase 2 output: pathogen_profile dict (see virus_profiler.py)
## Phase 3 output: seird_results.csv, confidence_bands.json, city_status.json, lockdown_recommendations.json

## Real Karnataka cities.csv will be provided by user — generator should be replaceable.
## All synthetic generators live in data_generators/ and are clearly marked SYNTHETIC.
---
