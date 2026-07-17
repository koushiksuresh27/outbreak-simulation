import datetime

def compute_data_confidence(event, template_confidence, matched_template_name=None):
    credibility = event.get("source_credibility", 0.0)
    count = event.get("report_count", 0)
    
    if matched_template_name == "unknown" or count < 10:
        return "low"
        
    if credibility >= 0.75 and template_confidence >= 0.75:
        return "high"
    elif credibility < 0.5 or template_confidence < 0.5:
        return "low"
    else:
        return "medium"

def profile_from_event(event, matched_template, template_confidence, seasonal_multiplier):
    symptoms = event.get("symptoms_list", [])
    
    is_unknown = len(symptoms) < 3 or template_confidence < 0.4 or matched_template.get("name") == "unknown"
    
    # Safe default base_template
    default_base_template = {
        "name": "unknown",
        "transmission_mode": "unknown",
        "incubation_days": {"min": 1, "mean": 7, "max": 14},
        "R0": {"estimate": 2.0, "lower_95": 0.5, "upper_95": 5.0},
        "mortality_rate": {"estimate": 0.02, "lower_95": 0.005, "upper_95": 0.05},
        "contagiousness_factor": 0.5
    }
    
    if is_unknown:
        matched_name = "unknown"
        base = default_base_template
        temp_conf = 0.0
    else:
        matched_name = matched_template["name"]
        base = matched_template
        temp_conf = template_confidence

    data_conf = compute_data_confidence(event, temp_conf, matched_name)
    
    # Simple risk factor weighting
    risk = event.get("initial_risk_score", 50)
    risk_factor = 1.0 + ((risk - 50) / 100.0)
    
    # Adjusted R0
    prior_r0_est = base.get("R0", {}).get("estimate", 2.0)
    prior_r0_lower = base.get("R0", {}).get("lower_95", 0.5)
    prior_r0_upper = base.get("R0", {}).get("upper_95", 5.0)
    
    final_r0_est = prior_r0_est * seasonal_multiplier * risk_factor
    final_r0_lower = prior_r0_lower * seasonal_multiplier * risk_factor
    final_r0_upper = prior_r0_upper * seasonal_multiplier * risk_factor

    mortality = base.get("mortality_rate", {})
    mortality_estimate = mortality.get("estimate", 0.02)
    mortality_lower_95 = mortality.get("lower_95", 0.005)
    mortality_upper_95 = mortality.get("upper_95", 0.05)

    incubation = base.get("incubation_days", {})
    inc_min = incubation.get("min", 1)
    inc_mean = incubation.get("mean", 7)
    inc_max = incubation.get("max", 14)
    
    contagiousness = base.get("contagiousness_factor", 0.5)
    transmission = base.get("transmission_mode", "unknown")
    
    return {
        # Strict Schema (contracts2.md)
        "pathogen_id": event.get("event_id", "unknown_event"),
        "profile_version": 1,
        "matched_template": matched_name,
        "data_confidence": data_conf,
        "transmission_mode": transmission,
        "r0_estimate": round(final_r0_est, 3),
        "r0_lower_95": round(final_r0_lower, 3),
        "r0_upper_95": round(final_r0_upper, 3),
        "mortality_estimate": mortality_estimate,
        "mortality_lower_95": mortality_lower_95,
        "mortality_upper_95": mortality_upper_95,
        "incubation_min_days": float(inc_min),
        "incubation_mean_days": float(inc_mean),
        "incubation_max_days": float(inc_max),
        "contagiousness_factor": contagiousness,
        "seasonal_multiplier": round(seasonal_multiplier, 3),
        "estimated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "base_template": base,
        
        # Legacy fields for backward compatibility
        "disease_name": matched_name if matched_name != "unknown" else "unknown_pathogen",
        "R0_estimate": round(final_r0_est, 3),
        "mortality_rate": mortality_estimate,
        "template_confidence": round(temp_conf, 3)
    }
