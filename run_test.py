import json, sys
from pathlib import Path
sys.path.insert(0, '.')
from phase2.pathogen_profiler import profile_pathogen
from phase3.pipeline import run_phase3
import networkx as nx

if __name__ == '__main__':
    event = json.loads(Path('data/generated/sample_phase1_event.json').read_text())
    print('=== PHASE 2: Profiling pathogen ===')
    profile = profile_pathogen(event)
    print(f'  Template matched : {profile["disease_name"]}')
    print(f'  R0 estimate      : {profile["R0_estimate"]}')
    print(f'  R0 95% CI        : [{profile["base_template"]["R0"]["lower_95"]} - {profile["base_template"]["R0"]["upper_95"]}]')
    print(f'  Mortality rate   : {profile["mortality_rate"]}')
    print(f'  Seasonal mult.   : {profile["seasonal_multiplier"]}')
    print(f'  Data confidence  : {profile["data_confidence"]}')

    print()
    print('=== PHASE 3: Running spread simulation ===')
    output_files, res_no_lockdown, city_status, ranked_targets = run_phase3(
        event=event,
        profile=profile,
        origin_node_id=event.get('origin_node_id', 'KA-01'),
        n_runs=50,
        days=90
    )

    mc = res_no_lockdown
    with open('data/generated/mobility_graph.json') as f:
        graph_data = json.load(f)
    graph = nx.node_link_graph(graph_data)

    print()
    print('--- Peak infection day per city (P50 median) ---')
    rows = sorted(mc['peak_infection_day'].items(), key=lambda x: x[1])
    for nid, peak in rows:
        name = graph.nodes[nid]['name']
        peak_I = max(mc['confidence_bands'][nid]['P50'])
        print(f'  {nid:7s}  {name:<22s}  peak_day={peak:3d}  peak_I={peak_I:>10,.0f}')

    print()
    print('--- Healthcare capacity status ---')
    cap = json.loads(Path('data/generated/hospital_capacity.json').read_text())
    cap_dict = {c["node_id"]: c["total_beds"] for c in cap}

    for nid, status in city_status.items():
        flag = '[OVERWHELMED]' if status['overwhelmed'] else '[OK]'
        name = graph.nodes[nid]['name']
        beds = cap_dict.get(nid, 0)
        print(f'  {nid:7s}  {name:<22s}  {flag}  (beds={beds:,}  first_overwhelm_day={status["first_overwhelm_day"]})')

    print()
    print('--- Top 10 lockdown recommendations ---')
    if ranked_targets:
        for i, rec in enumerate(ranked_targets[:10], 1):
            print(f'  {i:2d}. {rec["source_name"]:<22s} <-> {rec["target_name"]:<22s}  score={rec["combined_score"]:.4f}  modes={rec["modes"]}')

    print()
    print('Output files written to:', Path(output_files['confidence_bands']).parent)
