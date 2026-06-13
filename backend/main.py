import json
import sys
import os
from pathlib import Path

# Root of the project is one level up from backend/
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional

app = FastAPI(title="OutbreakResponseOS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store of results keyed by event_id
results_store: dict = {}

# ── lazy-load node metadata once ─────────────────────────────────────────────
_node_meta: dict = {}

def _get_node_meta() -> dict:
    global _node_meta
    if not _node_meta:
        nodes_path = ROOT / "data" / "generated" / "nodes.json"
        with open(nodes_path, "r") as f:
            for n in json.load(f):
                _node_meta[n["node_id"]] = n
    return _node_meta

# ── lazy-load capacity once ───────────────────────────────────────────────────
_capacity_meta: dict = {}

def _get_capacity_meta() -> dict:
    global _capacity_meta
    if not _capacity_meta:
        cap_path = ROOT / "data" / "generated" / "hospital_capacity.json"
        with open(cap_path, "r") as f:
            for c in json.load(f):
                _capacity_meta[c["node_id"]] = c
    return _capacity_meta


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/sample-event")
def get_sample_event():
    return json.loads((ROOT / "data" / "generated" / "sample_phase1_event.json").read_text())


@app.get("/results/{event_id}")
def get_results(event_id: str):
    if event_id not in results_store:
        raise HTTPException(status_code=404, detail="Event not found")
    return results_store[event_id]


@app.post("/run-simulation")
def run_simulation(payload: dict):
    """
    Accepts a Phase 1 event dict (or uses sample if empty).
    Runs Phase 2 profiling then Phase 3 Monte Carlo simulation.
    Returns full results: profile + confidence bands + city status + lockdown recs.
    """
    # Import here to avoid multiprocessing spawn issues on Windows
    from phase2.pathogen_profiler import profile_pathogen
    from phase3.pipeline import run_phase3

    # Fall back to sample event if payload empty
    if not payload:
        payload = json.loads(
            (ROOT / "data" / "generated" / "sample_phase1_event.json").read_text()
        )

    event: dict = payload

    # ── Phase 2: pathogen profiling ───────────────────────────────────────────
    profile = profile_pathogen(event)

    # ── Phase 3: Monte Carlo spread simulation ────────────────────────────────
    output_files, res_no_lockdown, city_status, ranked_targets = run_phase3(
        event=event,
        profile=profile,
        origin_node_id=event.get("origin_node_id", "KA-01"),
        n_runs=50,
        days=90,
    )

    node_meta = _get_node_meta()
    cap_meta  = _get_capacity_meta()

    # ── Build node list for frontend ──────────────────────────────────────────
    nodes_out = []
    for nid, bands in res_no_lockdown["confidence_bands"].items():
        nm  = node_meta.get(nid, {})
        cap = cap_meta.get(nid, {})
        cs  = city_status.get(nid, {})
        peak_I = max(bands["P50"])

        nodes_out.append({
            "node_id":            nid,
            "name":               nm.get("name", nid),
            "lat":                nm.get("lat"),
            "lon":                nm.get("lon"),
            "population":         nm.get("population"),
            "is_karnataka":       nm.get("is_karnataka", False),
            "peak_infection_day": res_no_lockdown["peak_infection_day"].get(nid, 0),
            "peak_I_p50":         round(peak_I),
            "overwhelmed":        cs.get("overwhelmed", False),
            "first_overwhelm_day": cs.get("first_overwhelm_day"),
            "days_overwhelmed":   cs.get("days_overwhelmed", 0),
            "total_beds":         cap.get("total_beds"),
            "overwhelm_threshold": (
                cap.get("total_beds", 0) * cap.get("overwhelm_threshold_pct", 0.3)
                if cap else None
            ),
            "confidence_bands": {
                "P10": bands["P10"],
                "P50": bands["P50"],
                "P90": bands["P90"],
            },
        })

    # Sort so highest peak infections appear first
    nodes_out.sort(key=lambda n: n["peak_I_p50"], reverse=True)

    # ── Build edge list for frontend ──────────────────────────────────────────
    import networkx as nx
    graph_data = json.loads((ROOT / "data" / "generated" / "mobility_graph.json").read_text())
    G = nx.node_link_graph(graph_data)

    edges_out = []
    for u, v, data in G.edges(data=True):
        edges_out.append({
            "source": u,
            "target": v,
            "weight": data.get("weight", 1),
            "modes":  data.get("modes", []),
        })

    # ── Lockdown recommendations ──────────────────────────────────────────────
    lockdown = [
        {k: v for k, v in rec.items()} for rec in ranked_targets[:15]
    ]

    output = {
        "event_id":               event.get("event_id", "UNKNOWN"),
        "profile": {
            "disease_name":         profile.get("disease_name"),
            "R0_estimate":          profile.get("R0_estimate"),
            "R0_lower_95":          profile["base_template"]["R0"]["lower_95"],
            "R0_upper_95":          profile["base_template"]["R0"]["upper_95"],
            "mortality_rate":       profile.get("mortality_rate"),
            "seasonal_multiplier":  profile.get("seasonal_multiplier"),
            "data_confidence":      profile.get("data_confidence"),
            "template_confidence":  profile.get("template_confidence"),
        },
        "nodes":                  nodes_out,
        "edges":                  edges_out,
        "lockdown_recommendations": lockdown,
        "days":                   90,
        "output_files": {k: str(v) for k, v in output_files.items()},
    }

    results_store[event.get("event_id", "UNKNOWN")] = output
    return output

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
