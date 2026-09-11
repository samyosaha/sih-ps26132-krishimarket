import re
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models import Hub

# 2-digit PIN prefix mapping to States
PINCODE_PREFIX_TO_STATE: dict[str, str] = {
    "11": "Delhi",
    "12": "Haryana",
    "13": "Haryana",
    "14": "Punjab",
    "15": "Punjab",
    "16": "Chandigarh",
    "17": "Himachal Pradesh",
    "18": "Jammu and Kashmir",
    "19": "Jammu and Kashmir",
    "20": "Uttar Pradesh",
    "21": "Uttar Pradesh",
    "22": "Uttar Pradesh",
    "23": "Uttar Pradesh",
    "24": "Uttar Pradesh",
    "25": "Uttar Pradesh",
    "26": "Uttarakhand",
    "27": "Uttar Pradesh",
    "28": "Uttar Pradesh",
    "30": "Rajasthan",
    "31": "Rajasthan",
    "32": "Rajasthan",
    "33": "Rajasthan",
    "34": "Rajasthan",
    "36": "Gujarat",
    "37": "Gujarat",
    "38": "Gujarat",
    "39": "Gujarat",
    "40": "Maharashtra",
    "41": "Maharashtra",
    "42": "Maharashtra",
    "43": "Maharashtra",
    "44": "Maharashtra",
    "45": "Madhya Pradesh",
    "46": "Madhya Pradesh",
    "47": "Madhya Pradesh",
    "48": "Madhya Pradesh",
    "49": "Chhattisgarh",
    "50": "Telangana",
    "51": "Andhra Pradesh",
    "52": "Andhra Pradesh",
    "53": "Andhra Pradesh",
    "56": "Karnataka",
    "57": "Karnataka",
    "58": "Karnataka",
    "59": "Karnataka",
    "60": "Tamil Nadu",
    "61": "Tamil Nadu",
    "62": "Tamil Nadu",
    "63": "Tamil Nadu",
    "64": "Tamil Nadu",
    "67": "Kerala",
    "68": "Kerala",
    "69": "Kerala",
    "70": "West Bengal",
    "71": "West Bengal",
    "72": "West Bengal",
    "73": "West Bengal",
    "74": "West Bengal",
    "75": "Odisha",
    "76": "Odisha",
    "77": "Odisha",
    "78": "Assam",
    "79": "Meghalaya",
    "80": "Bihar",
    "81": "Bihar",
    "82": "Bihar",
    "83": "Jharkhand",
    "84": "Bihar",
    "85": "Bihar",
}

# 3-digit PIN prefix mapping to major hub districts
PINCODE_3DIGIT_DISTRICT_MAP: dict[str, tuple[str, str]] = {
    "400": ("Mumbai City", "Maharashtra"),
    "401": ("Thane", "Maharashtra"),
    "411": ("Pune", "Maharashtra"),
    "412": ("Pune", "Maharashtra"),
    "413": ("Solapur", "Maharashtra"),
    "414": ("Ahmednagar", "Maharashtra"),
    "416": ("Kolhapur", "Maharashtra"),
    "422": ("Nashik", "Maharashtra"),
    "440": ("Nagpur", "Maharashtra"),
    "380": ("Ahmedabad", "Gujarat"),
    "360": ("Rajkot", "Gujarat"),
    "395": ("Surat", "Gujarat"),
    "560": ("Bengaluru", "Karnataka"),
}


def normalize_string(val: Optional[str]) -> str:
    """Lowercase, strip, and collapse contiguous whitespace."""
    if not val:
        return ""
    return " ".join(val.strip().lower().split())


def clean_district_name(val: Optional[str]) -> str:
    """
    Remove administrative suffixes like 'district', 'rural', 'urban', 'city', 'metro'
    matching the logic in frontend/components/nearby-logistics.tsx.
    """
    norm = normalize_string(val)
    if not norm:
        return ""
    cleaned = re.sub(
        r"\b(district|rural|urban|metro|metropolitan|city)\b",
        "",
        norm,
        flags=re.IGNORECASE,
    )
    return " ".join(cleaned.split())


def match_hub(
    db: Session,
    district: Optional[str] = None,
    state: Optional[str] = None,
    pincode: Optional[str] = None,
) -> Tuple[Optional[Hub], bool]:
    """
    Match a location to the nearest/best seeded Hub in the database.

    Reuses the normalization and matching logic from frontend/components/nearby-logistics.tsx:
    1. Exact match on district (preferring matching state)
    2. Normalized match (trimmed, lowercase)
    3. Suffix-cleaned match (e.g. 'Bankura District' -> 'bankura', 'Mumbai' -> 'Mumbai City')
    4. State-level fallback: any hub located in the matching state.

    Returns:
        (Hub, is_regional_fallback: bool) if a hub is found, else (None, False).
    """
    effective_district = district.strip() if district else None
    effective_state = state.strip() if state else None

    # Resolve pincode to district/state if given or if district is numeric
    pin_str = (pincode or "").strip()
    if not pin_str and effective_district and effective_district.isdigit():
        pin_str = effective_district
        effective_district = None

    if pin_str:
        prefix3 = pin_str[:3]
        prefix2 = pin_str[:2]
        if prefix3 in PINCODE_3DIGIT_DISTRICT_MAP:
            pin_dist, pin_st = PINCODE_3DIGIT_DISTRICT_MAP[prefix3]
            if not effective_district:
                effective_district = pin_dist
            if not effective_state:
                effective_state = pin_st
        elif prefix2 in PINCODE_PREFIX_TO_STATE:
            if not effective_state:
                effective_state = PINCODE_PREFIX_TO_STATE[prefix2]

    all_hubs = db.query(Hub).all()
    if not all_hubs:
        return None, False

    norm_dist = normalize_string(effective_district)
    clean_dist = clean_district_name(effective_district)
    norm_state = normalize_string(effective_state)

    # 1. Exact match on district
    if effective_district:
        for hub in all_hubs:
            if hub.district == effective_district:
                if not norm_state or normalize_string(hub.state) == norm_state:
                    return hub, False

        # 2. Normalized match (trimmed, lowercase)
        for hub in all_hubs:
            if normalize_string(hub.district) == norm_dist:
                if not norm_state or normalize_string(hub.state) == norm_state:
                    return hub, False

        # 3. Suffix-cleaned match (e.g. 'Mumbai' matches 'Mumbai City')
        if clean_dist:
            for hub in all_hubs:
                hub_clean = clean_district_name(hub.district)
                if hub_clean and hub_clean == clean_dist:
                    if not norm_state or normalize_string(hub.state) == norm_state:
                        return hub, False

            for hub in all_hubs:
                hub_clean = clean_district_name(hub.district)
                if hub_clean and (clean_dist in hub_clean or hub_clean in clean_dist):
                    if not norm_state or normalize_string(hub.state) == norm_state:
                        return hub, False

    # 4. State-level regional fallback
    if norm_state:
        for hub in all_hubs:
            if normalize_string(hub.state) == norm_state:
                return hub, True

    return None, False
