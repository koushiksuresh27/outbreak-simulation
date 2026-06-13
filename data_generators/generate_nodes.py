import csv
import json
import os
import pandas as pd

def generate_nodes():
    # Get the project root directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    cities_csv_path = os.path.join(project_root, "data", "raw", "cities.csv")
    
    # Read and clean cities.csv robustly
    cleaned_lines = []
    with open(cities_csv_path, 'r', encoding='utf-8-sig') as f:
        for line in f:
            clean = line.strip().strip('"').strip()
            if clean:
                cleaned_lines.append(clean)
                
    # Parse CSV using DictReader
    import csv
    reader = csv.DictReader(cleaned_lines)
    
    # Map for original 12 districts to maintain backwards compatibility
    MAPPING = {
        "bengaluru urban": "KA-01",
        "mysuru": "KA-02",
        "dakshina kannada": "KA-03",
        "dharwad": "KA-04",
        "belagavi": "KA-05",
        "kalaburagi": "KA-06",
        "shivamoga": "KA-07",
        "shivamogga": "KA-07",
        "tumkuru": "KA-08",
        "tumakuru": "KA-08",
        "vijayapura": "KA-09",
        "hassan": "KA-10",
        "udupi": "KA-11",
        "kolar": "KA-12"
    }
    
    # Name cleanups for high quality representation
    CLEAN_NAMES = {
        "bengaluru urban": "Bengaluru Urban",
        "mysuru": "Mysuru",
        "dakshina kannada": "Mangaluru",
        "dharwad": "Hubballi-Dharwad",
        "belagavi": "Belagavi",
        "kalaburagi": "Kalaburagi",
        "shivamoga": "Shivamogga",
        "shivamogga": "Shivamogga",
        "tumkuru": "Tumakuru",
        "tumakuru": "Tumakuru",
        "vijayapura": "Vijayapura",
        "hassan": "Hassan",
        "udupi": "Udupi",
        "kolar": "Kolar",
        "bengalurur rural": "Bengaluru Rural"
    }
    
    # Precise geographical zones mapping for all 30 districts
    ZONES = {
        "belagavi": "border",
        "bagalkot": "inland_north",
        "vijayapura": "border",
        "bidar": "border",
        "raichur": "inland_north",
        "koppal": "inland_north",
        "gadag": "inland_north",
        "dharwad": "inland_north",
        "uttara kannada": "coastal",
        "haveri": "inland_north",
        "ballari": "inland_north",
        "chitradurga": "inland_south",
        "davanagere": "inland_south",
        "shivamoga": "inland_south",
        "shivamogga": "inland_south",
        "udupi": "coastal",
        "chikkamagaluru": "inland_south",
        "tumkuru": "inland_south",
        "tumakuru": "inland_south",
        "bengaluru urban": "metro",
        "mandya": "inland_south",
        "hassan": "inland_south",
        "dakshina kannada": "coastal",
        "kodagu": "inland_south",
        "mysuru": "inland_south",
        "chamarajanagar": "inland_south",
        "kalaburagi": "border",
        "yadgir": "border",
        "kolar": "border",
        "chikkaballapura": "inland_south",
        "bengalurur rural": "inland_south",
        "ramanagara": "inland_south"
    }
    
    # Airports dictionary
    AIRPORTS = {
        "KA-01": "BLR",
        "KA-02": "MYQ",
        "KA-03": "IXE",
        "KA-04": "HBX",
        "KA-05": "IXG",
        "KA-06": "GBI",
        "KA-07": "RQY"
    }
    
    # Separate rows into mapped and unmapped to keep sequential order KA-13 to KA-30
    mapped_nodes = []
    unmapped_rows = []
    
    for row in reader:
        raw_name = row["city_name"].strip()
        norm_name = raw_name.lower()
        if norm_name in MAPPING:
            mapped_nodes.append((MAPPING[norm_name], row))
        else:
            unmapped_rows.append(row)
            
    # Sort mapped nodes so they are ordered KA-01 to KA-12
    mapped_nodes.sort(key=lambda x: x[0])
    
    nodes_data = []
    
    # Construct Karnataka nodes from the CSV records
    # 1. First add the 12 mapped nodes
    for nid, row in mapped_nodes:
        raw_name = row["city_name"].strip()
        norm_name = raw_name.lower()
        name = CLEAN_NAMES.get(norm_name, raw_name.title())
        zone = ZONES.get(norm_name, "inland_south")
        has_airport = nid in AIRPORTS
        airport_code = AIRPORTS.get(nid, None)
        
        nodes_data.append({
            "node_id": nid,
            "name": name,
            "state": "Karnataka",
            "is_karnataka": True,
            "population": int(row["population"]),
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "zone": zone,
            "has_airport": has_airport,
            "airport_code": airport_code
        })
        
    # 2. Then add the remaining 18 unmapped nodes from KA-13 to KA-30
    next_id_num = 13
    for row in unmapped_rows:
        nid = f"KA-{next_id_num:02d}"
        raw_name = row["city_name"].strip()
        norm_name = raw_name.lower()
        name = CLEAN_NAMES.get(norm_name, raw_name.title())
        zone = ZONES.get(norm_name, "inland_south")
        
        nodes_data.append({
            "node_id": nid,
            "name": name,
            "state": "Karnataka",
            "is_karnataka": True,
            "population": int(row["population"]),
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "zone": zone,
            "has_airport": False,
            "airport_code": None
        })
        next_id_num += 1
        
    # 3. Add the 10 inter-state nodes from original configuration
    interstate_nodes = [
        {"node_id": "EXT-01", "name": "Hyderabad", "state": "Telangana", "is_karnataka": False, "population": 10500000, "lat": 17.3850, "lon": 78.4867, "zone": "other", "has_airport": True, "airport_code": "HYD"},
        {"node_id": "EXT-02", "name": "Chennai", "state": "Tamil Nadu", "is_karnataka": False, "population": 11200000, "lat": 13.0827, "lon": 80.2707, "zone": "other", "has_airport": True, "airport_code": "MAA"},
        {"node_id": "EXT-03", "name": "Mumbai", "state": "Maharashtra", "is_karnataka": False, "population": 20700000, "lat": 19.0760, "lon": 72.8777, "zone": "other", "has_airport": True, "airport_code": "BOM"},
        {"node_id": "EXT-04", "name": "Pune", "state": "Maharashtra", "is_karnataka": False, "population": 7400000, "lat": 18.5204, "lon": 73.8567, "zone": "other", "has_airport": True, "airport_code": "PNQ"},
        {"node_id": "EXT-05", "name": "Goa", "state": "Goa", "is_karnataka": False, "population": 800000, "lat": 15.2993, "lon": 74.1240, "zone": "other", "has_airport": True, "airport_code": "GOI"},
        {"node_id": "EXT-06", "name": "Coimbatore", "state": "Tamil Nadu", "is_karnataka": False, "population": 2100000, "lat": 11.0168, "lon": 76.9558, "zone": "other", "has_airport": True, "airport_code": "CJB"},
        {"node_id": "EXT-07", "name": "Kochi", "state": "Kerala", "is_karnataka": False, "population": 2300000, "lat": 9.9312, "lon": 76.2673, "zone": "other", "has_airport": True, "airport_code": "COK"},
        {"node_id": "EXT-08", "name": "Delhi", "state": "Delhi", "is_karnataka": False, "population": 32000000, "lat": 28.6139, "lon": 77.2090, "zone": "other", "has_airport": True, "airport_code": "DEL"},
        {"node_id": "EXT-09", "name": "Kolkata", "state": "West Bengal", "is_karnataka": False, "population": 14800000, "lat": 22.5726, "lon": 88.3639, "zone": "other", "has_airport": True, "airport_code": "CCU"},
        {"node_id": "EXT-10", "name": "Ahmedabad", "state": "Gujarat", "is_karnataka": False, "population": 8650000, "lat": 23.0225, "lon": 72.5714, "zone": "other", "has_airport": True, "airport_code": "AMD"},
    ]
    
    nodes_data.extend(interstate_nodes)

    # Add default age distribution to all nodes
    default_age_dist = { "0_14": 0.27, "15_29": 0.28, "30_59": 0.33, "60_plus": 0.12 }
    for node in nodes_data:
        node["age_distribution"] = default_age_dist
        
    # Output file path
    output_dir = os.path.join(project_root, "data", "generated")
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "nodes.json")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(nodes_data, f, indent=4)
        
    print(f"Successfully generated {len(nodes_data)} nodes (30 Karnataka + 10 Interstate) at {output_file}\n")
    
    # Print summary table using pandas
    df = pd.DataFrame(nodes_data)
    columns_to_show = ["node_id", "name", "state", "population", "zone", "has_airport"]
    summary_df = df[columns_to_show].copy()
    summary_df['population'] = summary_df['population'].apply(lambda x: f"{x:,}")
    
    print("--- Generated Nodes Summary ---")
    print(summary_df.to_string(index=False))

if __name__ == "__main__":
    generate_nodes()
