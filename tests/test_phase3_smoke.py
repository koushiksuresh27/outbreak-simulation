import os
import sys
import json
import numpy as np
import networkx as nx

# Adjust path to import phase3 modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from phase3.seird_model import run_seird_node
from phase3.monte_carlo import run_monte_carlo
from phase3.healthcare_capacity import load_capacity, check_overwhelmed
from phase3.lockdown_optimizer import rank_lockdown_targets

def get_data_dir():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(os.path.dirname(current_dir), "data", "generated")

def test_seird_conservation():
    N = 100000
    df = run_seird_node(
        population=N, 
        R0=3.0, 
        incubation_mean=5, 
        clinical_duration=10, 
        mortality_rate=0.01, 
        contagiousness_factor=0.5, 
        seed_infections=10, 
        days=20
    )
    
    total = df['S'] + df['E'] + df['I'] + df['R'] + df['D']
    
    for t in total:
        assert abs(t - N) / N < 0.01

def test_confidence_band_monotonicity():
    profiles_dir = os.path.join(get_data_dir(), "profiles")
    import glob
    latest_file = max(glob.glob(os.path.join(profiles_dir, "*.json")), key=os.path.getctime)
    with open(latest_file, 'r') as f:
        profile = json.load(f)
        
    with open(os.path.join(get_data_dir(), "mobility_graph.json"), 'r') as f:
        graph_data = json.load(f)
    G = nx.node_link_graph(graph_data)
    
    res = run_monte_carlo(profile, G, "KA-01", n_runs=5, days=10)
    
    for nid, bands in res["confidence_bands"].items():
        for i in range(len(bands["P50"])):
            assert bands["P10"][i] <= bands["P50"][i]
            assert bands["P50"][i] <= bands["P90"][i]

def test_bengaluru_overwhelmed():
    cap = load_capacity()
    
    df = run_seird_node(
        population=13193000, 
        R0=4.0, 
        incubation_mean=5, 
        clinical_duration=10, 
        mortality_rate=0.01, 
        contagiousness_factor=1.0, 
        seed_infections=10, 
        days=90
    )
    
    res = check_overwhelmed("KA-01", df['I'].values, cap)
    assert res["overwhelmed"] == True

def test_lockdown_top_edge_is_bengaluru():
    profiles_dir = os.path.join(get_data_dir(), "profiles")
    import glob
    latest_file = max(glob.glob(os.path.join(profiles_dir, "*.json")), key=os.path.getctime)
    with open(latest_file, 'r') as f:
        profile = json.load(f)
        
    with open(os.path.join(get_data_dir(), "mobility_graph.json"), 'r') as f:
        graph_data = json.load(f)
    G = nx.node_link_graph(graph_data)
    
    res = run_monte_carlo(profile, G, "KA-01", n_runs=5, days=30)
    
    ranked_targets = rank_lockdown_targets(
        G, 
        res["confidence_bands"], 
        res["peak_infection_day"], 
        top_n=5
    )
    
    top_edge = ranked_targets[0]
    assert top_edge["source"] == "KA-01" or top_edge["target"] == "KA-01"
