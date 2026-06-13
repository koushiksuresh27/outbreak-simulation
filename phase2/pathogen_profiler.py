import json
import os
import glob
from datetime import datetime

from phase2.template_matcher import match_template
from phase2.seasonal_modifier import get_seasonal_multiplier
from phase2.virus_profiler import profile_from_event

def get_profiles_dir():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    profiles_dir = os.path.join(os.path.dirname(current_dir), "data", "generated", "profiles")
    os.makedirs(profiles_dir, exist_ok=True)
    return profiles_dir

def profile_pathogen(event):
    symptoms = event.get("symptoms_list", [])
    
    # Match template
    matched_template, conf = match_template(symptoms)
    
    # Get month from first_detected_at (e.g., "2024-09-01T08:30:00Z")
    dt_str = event.get("first_detected_at")
    month = 1
    if dt_str:
        try:
            dt = datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%SZ")
            month = dt.month
        except Exception:
            pass
            
    # Apply seasonal modifier
    disease_type = matched_template.get("name") if matched_template else "unknown"
    zone = event.get("zone", "other")
    seasonal_mult = get_seasonal_multiplier(zone, month, disease_type)
    
    # Generate profile
    profile = profile_from_event(event, matched_template, conf, seasonal_mult)
    
    # Save profile
    event_id = event.get("event_id", "UNKNOWN_EVENT")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    filename = f"{event_id}_v1_{timestamp}.json"
    filepath = os.path.join(get_profiles_dir(), filename)
    
    with open(filepath, 'w') as f:
        json.dump(profile, f, indent=4)
        
    return profile

def load_latest_profile(event_id):
    profiles_dir = get_profiles_dir()
    pattern = os.path.join(profiles_dir, f"{event_id}_v1_*.json")
    files = glob.glob(pattern)
    if not files:
        return None
    latest_file = max(files, key=os.path.getctime)
    with open(latest_file, 'r') as f:
        return json.load(f)

if __name__ == "__main__":
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sample_file = os.path.join(os.path.dirname(current_dir), "data", "generated", "sample_phase1_event.json")
    
    with open(sample_file, 'r') as f:
        event = json.load(f)
        
    print("Running Pathogen Profiler on event:", event["event_id"])
    profile = profile_pathogen(event)
    print("\n--- Generated Pathogen Profile ---")
    print(json.dumps(profile, indent=2))
