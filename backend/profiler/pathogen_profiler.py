import json
import os
import glob
from datetime import datetime

from backend.profiler.template_matcher import match_template
from backend.profiler.seasonal_modifier import get_seasonal_multiplier
from backend.profiler.virus_profiler import profile_from_event

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
    
    from backend.profiler.profile_versioner import get_next_version, save_profile_version, get_latest_profile
    
    # Versioning
    event_id = event.get("event_id", "UNKNOWN_EVENT")
    next_version = get_next_version(event_id)
    profile["profile_version"] = next_version
    
    # Save profile
    save_profile_version(profile)
        
    return profile

def load_latest_profile(event_id):
    from backend.profiler.profile_versioner import get_latest_profile
    return get_latest_profile(event_id)

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
