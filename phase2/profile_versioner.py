import os
import json
import glob
import re
from datetime import datetime

def get_profiles_dir():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    profiles_dir = os.path.join(os.path.dirname(current_dir), "data", "generated", "profiles")
    os.makedirs(profiles_dir, exist_ok=True)
    return profiles_dir

def _get_version_from_filename(filename):
    basename = os.path.basename(filename)
    match = re.search(r'_v(\d+)_', basename)
    if match:
        return int(match.group(1))
    return 0

def get_next_version(event_id: str) -> int:
    profiles_dir = get_profiles_dir()
    pattern = os.path.join(profiles_dir, f"{event_id}_v*.json")
    files = glob.glob(pattern)
    
    if not files:
        return 1
        
    highest_version = 0
    for file in files:
        version = _get_version_from_filename(file)
        if version > highest_version:
            highest_version = version
            
    return highest_version + 1

def save_profile_version(profile_dict: dict) -> None:
    event_id = profile_dict.get("pathogen_id") or profile_dict.get("event_id", "UNKNOWN_EVENT")
    version = profile_dict.get("profile_version", 1)
    
    profiles_dir = get_profiles_dir()
    existing = glob.glob(os.path.join(profiles_dir, f"{event_id}_v{version}_*.json"))
    if existing:
        raise ValueError(f"Profile version {version} already exists for event {event_id}. Cannot overwrite.")
        
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{event_id}_v{version}_{timestamp}.json"
    filepath = os.path.join(profiles_dir, filename)
    
    with open(filepath, 'w') as f:
        json.dump(profile_dict, f, indent=4)

def get_latest_profile(event_id: str) -> dict | None:
    profiles_dir = get_profiles_dir()
    pattern = os.path.join(profiles_dir, f"{event_id}_v*.json")
    files = glob.glob(pattern)
    
    if not files:
        return None
        
    def sort_key(filepath):
        version = _get_version_from_filename(filepath)
        ctime = os.path.getctime(filepath)
        return (version, ctime)
        
    latest_file = max(files, key=sort_key)
    with open(latest_file, 'r') as f:
        return json.load(f)

def get_profile_history(event_id: str) -> list[dict]:
    profiles_dir = get_profiles_dir()
    pattern = os.path.join(profiles_dir, f"{event_id}_v*.json")
    files = glob.glob(pattern)
    
    def sort_key(filepath):
        return (_get_version_from_filename(filepath), os.path.getctime(filepath))
        
    sorted_files = sorted(files, key=sort_key)
    
    history = []
    for file in sorted_files:
        with open(file, 'r') as f:
            history.append(json.load(f))
            
    return history
