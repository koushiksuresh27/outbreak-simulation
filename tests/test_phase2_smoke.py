import os
import sys
import json

# Adjust path to import phase2 modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from phase2.template_matcher import match_template
from phase2.seasonal_modifier import get_seasonal_multiplier
from phase2.virus_profiler import profile_from_event, compute_data_confidence
from phase2.pathogen_profiler import profile_pathogen

def test_dengue_template_match():
    symptoms = ["fever", "rash", "joint_pain", "myalgia", "headache"]
    matched_template, confidence = match_template(symptoms)
    assert matched_template["name"] == "dengue"
    assert confidence > 0.6

def test_monsoon_dengue_coastal():
    mult = get_seasonal_multiplier(zone="coastal", month=8, disease_type="dengue")
    assert mult >= 1.25

def test_low_confidence_data():
    event = {"report_count": 1, "source_credibility": 0.3}
    conf = compute_data_confidence(event, template_confidence=0.9)
    assert conf.upper() == "LOW"

def test_unknown_pathogen_fallback():
    symptoms = ["cough"]
    matched_template, confidence = match_template(symptoms)
    assert matched_template["name"] == "unknown"

def test_profile_has_all_fields():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sample_file = os.path.join(os.path.dirname(current_dir), "data", "generated", "sample_phase1_event.json")
    with open(sample_file, 'r') as f:
        event = json.load(f)
        
    profile = profile_pathogen(event)
    expected_fields = ["disease_name", "R0_estimate", "mortality_rate", "data_confidence", "template_confidence", "seasonal_multiplier", "base_template"]
    for field in expected_fields:
        assert field in profile
