import json
import os
import networkx as nx

def get_data_dir():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(os.path.dirname(current_dir), "data", "generated")

def build_air_graph():
    # Key routes requested + some realistic connections
    edges = [
        {"source": "KA-01", "target": "EXT-03", "weight": 4200},
        {"source": "KA-01", "target": "EXT-08", "weight": 3800},
        {"source": "KA-01", "target": "EXT-02", "weight": 2100},
        {"source": "KA-01", "target": "EXT-01", "weight": 2400},
        {"source": "KA-03", "target": "EXT-03", "weight": 420},
        {"source": "KA-03", "target": "EXT-07", "weight": 380},
        
        # Additional valid airport connections
        {"source": "KA-01", "target": "KA-03", "weight": 350},
        {"source": "KA-01", "target": "KA-04", "weight": 250},
        {"source": "KA-01", "target": "KA-05", "weight": 180},
        {"source": "KA-01", "target": "EXT-04", "weight": 1500},
        {"source": "KA-01", "target": "EXT-05", "weight": 1200},
        {"source": "KA-01", "target": "EXT-09", "weight": 1900},
        {"source": "KA-01", "target": "EXT-10", "weight": 1600},
        {"source": "EXT-03", "target": "EXT-08", "weight": 5500},
        {"source": "EXT-03", "target": "EXT-05", "weight": 1100},
        {"source": "EXT-08", "target": "EXT-02", "weight": 2200}
    ]
    
    for e in edges:
        e["mode"] = "air"
        
    G = nx.Graph()
    for e in edges:
        G.add_edge(e["source"], e["target"], weight=e["weight"], mode="air")
        
    out_file = os.path.join(get_data_dir(), "air_edges.json")
    with open(out_file, 'w') as f:
        json.dump(edges, f, indent=4)
        
    return G
