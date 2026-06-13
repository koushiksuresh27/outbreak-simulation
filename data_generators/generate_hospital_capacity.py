import json
import os

def generate():
    # Load nodes to get population and state
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    nodes_file = os.path.join(project_root, "data", "generated", "nodes.json")
    
    with open(nodes_file, 'r', encoding='utf-8') as f:
        nodes = json.load(f)
        
    ka_beds = {
        "KA-01": 28000, "KA-02": 4200, "KA-03": 3800, "KA-04": 3500,
        "KA-05": 2800, "KA-06": 2600, "KA-07": 2100, "KA-08": 2300,
        "KA-09": 2000, "KA-10": 1800, "KA-11": 1600, "KA-12": 1700
    }
    
    # Approx State Population and Beds (2023 NHP rough estimates)
    state_stats = {
        "Telangana": {"pop": 38000000, "beds": 40000},
        "Tamil Nadu": {"pop": 76000000, "beds": 80000},
        "Maharashtra": {"pop": 123000000, "beds": 120000},
        "Goa": {"pop": 1500000, "beds": 3000},
        "Kerala": {"pop": 35000000, "beds": 40000},
        "Delhi": {"pop": 32000000, "beds": 50000},
        "West Bengal": {"pop": 98000000, "beds": 85000},
        "Gujarat": {"pop": 64000000, "beds": 60000}
    }
    
    capacity = []
    for node in nodes:
        nid = node["node_id"]
        if node["is_karnataka"]:
            if nid in ka_beds:
                beds = ka_beds[nid]
                dq = "district_level"
            else:
                # Estimate dynamic bed capacity at ~1.5 beds per 1000 population, rounded to nearest 100
                calculated_beds = int(node["population"] * 0.0015)
                # Keep a floor of 400 beds
                beds = max(400, (calculated_beds // 100) * 100)
                dq = "estimated_proportional"
        else:
            state = node["state"]
            stats = state_stats.get(state, {"pop": 1000000, "beds": 2000})
            beds = int((node["population"] / stats["pop"]) * stats["beds"])
            dq = "estimated"
            
        capacity.append({
            "node_id": nid,
            "total_beds": beds,
            "overwhelm_threshold_pct": 0.30,
            "data_quality": dq
        })
        
    output_dir = os.path.join(project_root, "data", "generated")
    os.makedirs(output_dir, exist_ok=True)
    out_file = os.path.join(output_dir, "hospital_capacity.json")
    
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(capacity, f, indent=4)
        
    print(f"Generated hospital capacity for {len(capacity)} nodes at {out_file}")
    
    # Print a quick preview of EXT nodes and new estimated KA nodes
    print("\n--- Estimated Beds for New/Estimated Nodes ---")
    for item in capacity:
        if item["data_quality"] in ["estimated", "estimated_proportional"]:
            node_name = next(n["name"] for n in nodes if n["node_id"] == item["node_id"])
            print(f"{item['node_id']} ({node_name}): {item['total_beds']} beds ({item['data_quality']})")

if __name__ == '__main__':
    generate()
