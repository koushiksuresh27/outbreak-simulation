def get_seasonal_multiplier(zone, month, disease_type):
    # Monsoon: June (6) to Sept (9)
    # Summer: March (3) to May (5)
    multiplier = 1.0
    
    if 6 <= month <= 9:  # Monsoon
        if disease_type == "dengue":
            multiplier += 0.30
        elif disease_type == "leptospirosis":
            multiplier += 0.40
        elif disease_type == "cholera":
            multiplier += 0.25
    elif 3 <= month <= 5:  # Summer
        if disease_type == "influenza_seasonal":
            multiplier -= 0.15
        elif disease_type in ["cholera", "typhoid"]: # Enteric
            multiplier += 0.10
            
    return multiplier
