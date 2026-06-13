import json
import os

def generate():
    event = {
        "event_id": "EVT-20240901-KA01-001",
        "location": "Bengaluru, Karnataka",
        "origin_node_id": "KA-01",
        "symptoms_list": ["fever", "rash", "joint_pain", "headache", "myalgia"],
        "report_count": 14,
        "initial_risk_score": 72.5,
        "confidence_score": 0.81,
        "source_credibility": 0.78,
        "signal_type": "outbreak_event",
        "first_detected_at": "2024-09-01T08:30:00Z",
        "zone": "metro"
    }
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    output_dir = os.path.join(project_root, "data", "generated")
    os.makedirs(output_dir, exist_ok=True)
    
    out_file = os.path.join(output_dir, "sample_phase1_event.json")
    with open(out_file, 'w') as f:
        json.dump(event, f, indent=4)
        
    print(f"Generated sample Phase 1 event at {out_file}")

if __name__ == '__main__':
    generate()
