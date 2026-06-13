import json
import os
import math
from collections import Counter

def get_templates():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    templates_file = os.path.join(current_dir, "disease_templates.json")
    with open(templates_file, 'r') as f:
        return json.load(f)

def cosine_similarity(list1, list2):
    vec1 = Counter(list1)
    vec2 = Counter(list2)
    intersection = set(vec1.keys()) & set(vec2.keys())
    numerator = sum([vec1[x] * vec2[x] for x in intersection])
    sum1 = sum([vec1[x]**2 for x in list1])
    sum2 = sum([vec2[x]**2 for x in list2])
    denominator = math.sqrt(sum1) * math.sqrt(sum2)
    if not denominator:
        return 0.0
    return float(numerator) / denominator

def match_template(symptoms_list):
    templates = get_templates()
    best_match = None
    best_conf = 0.0
    
    for t in templates:
        conf = cosine_similarity(symptoms_list, t["symptoms"])
        if conf > best_conf:
            best_conf = conf
            best_match = t
            
    if best_conf < 0.5:
        return {"name": "unknown"}, 0.0
        
    return best_match, best_conf
