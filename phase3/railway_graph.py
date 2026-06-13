import json
import os
import networkx as nx

def get_data_dir():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(os.path.dirname(current_dir), "data", "generated")

def build_rail_graph():
    edges = [
        {"source": "KA-01", "target": "KA-02", "weight": 42},
        {"source": "KA-01", "target": "KA-03", "weight": 21},
        {"source": "KA-01", "target": "KA-04", "weight": 28},
        {"source": "KA-01", "target": "KA-08", "weight": 35},
        {"source": "KA-01", "target": "EXT-02", "weight": 18},
        {"source": "KA-01", "target": "EXT-03", "weight": 14},
        {"source": "KA-01", "target": "EXT-01", "weight": 12},
        {"source": "KA-04", "target": "KA-05", "weight": 14},
        {"source": "KA-05", "target": "EXT-03", "weight": 11},
        {"source": "KA-05", "target": "EXT-04", "weight": 9},
        {"source": "KA-06", "target": "EXT-01", "weight": 10},
        {"source": "KA-12", "target": "EXT-02", "weight": 8},
        {"source": "KA-03", "target": "EXT-07", "weight": 6},
        
        # Additional realistic connections
        {"source": "KA-01", "target": "KA-06", "weight": 15},
        {"source": "KA-01", "target": "KA-07", "weight": 10},
        {"source": "KA-04", "target": "KA-09", "weight": 12},
        {"source": "KA-02", "target": "KA-10", "weight": 14},
        {"source": "KA-03", "target": "KA-11", "weight": 20},
        {"source": "EXT-01", "target": "EXT-02", "weight": 25},
        {"source": "EXT-03", "target": "EXT-04", "weight": 60},
        {"source": "EXT-03", "target": "EXT-08", "weight": 45},
        {"source": "EXT-02", "target": "EXT-06", "weight": 22},
        {"source": "EXT-06", "target": "EXT-07", "weight": 18}
    ]
    
    for e in edges:
        e["mode"] = "rail"
        
    G = nx.Graph()
    for e in edges:
        G.add_edge(e["source"], e["target"], weight=e["weight"], mode="rail")
        
    out_file = os.path.join(get_data_dir(), "railway_edges.json")
    with open(out_file, 'w') as f:
        json.dump(edges, f, indent=4)
        
    return G
