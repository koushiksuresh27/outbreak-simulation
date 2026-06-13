def compute_data_confidence(event, template_confidence):
    credibility = event.get("source_credibility", 0.0)
    count = event.get("report_count", 0)
    
    if credibility >= 0.75 and count >= 10 and template_confidence >= 0.75:
        return "HIGH"
    elif credibility < 0.5 or count < 5 or template_confidence < 0.5:
        return "LOW"
    else:
        return "MEDIUM"

def profile_from_event(event, matched_template, template_confidence, seasonal_multiplier):
    symptoms = event.get("symptoms_list", [])
    
    if len(symptoms) < 3 or template_confidence < 0.4 or matched_template.get("name") == "unknown":
        return {
            "disease_name": "unknown_pathogen",
            "R0_estimate": 3.5,
            "mortality_rate": 0.02,
            "data_confidence": "LOW",
            "template_confidence": 0.0,
            "seasonal_multiplier": 1.0
        }
        
    prior_R0 = matched_template["R0"]["estimate"]
    
    # We apply seasonal multiplier to R0
    adjusted_R0 = prior_R0 * seasonal_multiplier
    
    # Simple risk factor weighting
    risk = event.get("initial_risk_score", 50)
    risk_factor = 1.0 + ((risk - 50) / 100.0)
    
    final_R0 = adjusted_R0 * risk_factor
    
    return {
        "disease_name": matched_template["name"],
        "R0_estimate": round(final_R0, 3),
        "mortality_rate": matched_template["mortality_rate"]["estimate"],
        "data_confidence": compute_data_confidence(event, template_confidence),
        "template_confidence": round(template_confidence, 3),
        "seasonal_multiplier": round(seasonal_multiplier, 3),
        "base_template": matched_template
    }
