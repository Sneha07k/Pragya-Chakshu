from datetime import datetime
from collections import Counter
import numpy as np

def parse_iso_datetime(iso_str):
    if not iso_str:
        return None
    try:
        # Replace Z with UTC offset
        clean_str = iso_str.replace('Z', '+00:00')
        return datetime.fromisoformat(clean_str)
    except Exception:
        return None

def extract_behavioral_profile(timestamps):
    """
    Extracts diurnal (24-hour UTC cycle) and weekly cadence distributions
    from a list of ISO 8601 timestamps.
    """
    valid_dts = []
    for ts in timestamps:
        dt = parse_iso_datetime(ts)
        if dt:
            valid_dts.append(dt)
            
    total_events = len(valid_dts)
    if total_events == 0:
        return {
            "provenance": "DERIVED",
            "total_events": 0,
            "diurnal_24h": [0] * 24,
            "day_of_week": [0] * 7,
            "first_seen": None,
            "last_seen": None,
            "active_span_days": 0,
            "mean_interval_hours": 0.0,
            "burst_count": 0
        }
        
    valid_dts.sort()
    
    # 1. 24-hour UTC histogram (0 to 23)
    hours = [dt.hour for dt in valid_dts]
    hour_counts = Counter(hours)
    diurnal_24h = [hour_counts.get(h, 0) for h in range(24)]
    
    # 2. Day-of-week histogram (0=Monday, 6=Sunday)
    dows = [dt.weekday() for dt in valid_dts]
    dow_counts = Counter(dows)
    day_of_week = [dow_counts.get(d, 0) for d in range(7)]
    
    # 3. Cadence and intervals
    intervals_hours = []
    bursts = 0
    for i in range(1, len(valid_dts)):
        delta = (valid_dts[i] - valid_dts[i-1]).total_seconds() / 3600.0
        intervals_hours.append(delta)
        if delta <= 1.0:
            bursts += 1
            
    mean_interval = round(float(np.mean(intervals_hours)), 1) if intervals_hours else 0.0
    first_seen = valid_dts[0].isoformat()
    last_seen = valid_dts[-1].isoformat()
    span_days = round((valid_dts[-1] - valid_dts[0]).total_seconds() / 86400.0, 1)
    
    return {
        "provenance": "DERIVED",
        "total_events": total_events,
        "diurnal_24h": diurnal_24h,
        "day_of_week": day_of_week,
        "first_seen": first_seen,
        "last_seen": last_seen,
        "active_span_days": span_days,
        "mean_interval_hours": mean_interval,
        "burst_count": bursts
    }

def compare_behavioral_profiles(prof_a, prof_b):
    """
    Computes diurnal schedule compatibility using cosine similarity of the 24h vector.
    """
    vec_a = np.array(prof_a.get("diurnal_24h", [0] * 24), dtype=float)
    vec_b = np.array(prof_b.get("diurnal_24h", [0] * 24), dtype=float)
    
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    
    if norm_a == 0 or norm_b == 0:
        diurnal_sim = 50.0
        conflict = False
        desc = "Insufficient temporal activity data"
    else:
        cos_sim = float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
        diurnal_sim = round(max(0.0, min(100.0, cos_sim * 100.0)), 1)
        
        # Check peak hour difference
        peak_a = int(np.argmax(vec_a))
        peak_b = int(np.argmax(vec_b))
        peak_diff = min(abs(peak_a - peak_b), 24 - abs(peak_a - peak_b))
        
        conflict = peak_diff >= 8
        if conflict:
            desc = f"Conflicting temporal activity: Peak windows differ by {peak_diff} hours ({peak_a:02d}:00 vs {peak_b:02d}:00 UTC)"
        elif diurnal_sim >= 75:
            desc = f"High temporal alignment: Consistent diurnal activity peak around {peak_a:02d}:00 UTC"
        else:
            desc = f"Moderate temporal overlap (Peak delta: {peak_diff} hours)"
            
    return {
        "diurnal_similarity_score": diurnal_sim,
        "is_conflicting": conflict,
        "description": desc
    }
