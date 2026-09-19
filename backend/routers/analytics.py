from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import uuid
from backend.database.sqlite import get_connection
from backend.analytics.stylometry import extract_stylometric_profile, compare_stylometric_profiles
from backend.analytics.behavioral import extract_behavioral_profile, compare_behavioral_profiles

router = APIRouter(prefix="/cases", tags=["analytics"])

class CompareRequest(BaseModel):
    persona_a_id: str
    persona_b_id: str

def get_persona_texts_and_timestamps(case_id: str, persona_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get persona details
    cursor.execute("SELECT * FROM personas WHERE case_id=? AND persona_id=?", (case_id, persona_id))
    persona = cursor.fetchone()
    if not persona:
        conn.close()
        raise HTTPException(status_code=404, detail="Persona not found in case")
        
    raw_uid = persona['raw_uid']
    raw_vid = persona['raw_vid']
    
    # Query matching events from normalized_events
    texts = []
    timestamps = []
    
    cursor.execute("SELECT event_type, timestamp_occurred, payload_json FROM normalized_events WHERE case_id=?", (case_id,))
    for row in cursor.fetchall():
        try:
            payload = json.loads(row['payload_json']) if isinstance(row['payload_json'], str) else row['payload_json']
        except Exception:
            try:
                import ast
                payload = ast.literal_eval(row['payload_json'])
            except Exception:
                continue
        ts = row['timestamp_occurred']
        
        # Check if this event belongs to this persona
        is_match = False
        if raw_uid and row['event_type'] == 'post_observed':
            orig = payload.get('original_post', {})
            if str(orig.get('uid')) == str(raw_uid):
                is_match = True
                clean = payload.get('clean_text', '')
                if clean:
                    texts.append(clean)
        elif raw_vid and row['event_type'] in ['vendor_observed', 'listing_observed']:
            vid = payload.get('vid')
            if str(vid) == str(raw_vid):
                is_match = True
                desc = payload.get('clean_description', '')
                if desc:
                    texts.append(desc)
                    
        if is_match and ts:
            timestamps.append(ts)
            
    conn.close()
    return dict(persona), texts, timestamps

@router.get("/{case_id}/analytics/stylometry/{persona_id}")
def get_persona_stylometry(case_id: str, persona_id: str):
    persona, texts, _ = get_persona_texts_and_timestamps(case_id, persona_id)
    profile = extract_stylometric_profile(texts)
    
    # Cache profile in SQLite stylometric_profiles
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT profile_id FROM stylometric_profiles WHERE persona_id=?", (persona_id,))
    row = cursor.fetchone()
    
    p_vec_json = json.dumps(profile["punctuation_vector"])
    ngrams_json = json.dumps(profile["ngram_profile"])
    
    if row:
        cursor.execute("""
            UPDATE stylometric_profiles SET
                sample_count = ?, avg_sentence_len = ?, sentence_len_var = ?, avg_word_len = ?,
                yules_k = ?, punctuation_vector_json = ?, ngram_frequency_json = ?, updated_at = CURRENT_TIMESTAMP
            WHERE persona_id = ?
        """, (profile["sample_count"], profile["avg_sentence_len"], profile["sentence_len_var"], profile["avg_word_len"],
              profile["yules_k"], p_vec_json, ngrams_json, persona_id))
    else:
        prof_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO stylometric_profiles (
                profile_id, persona_id, sample_count, avg_sentence_len, sentence_len_var, avg_word_len,
                yules_k, simpsons_d, punctuation_vector_json, ngram_frequency_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?)
        """, (prof_id, persona_id, profile["sample_count"], profile["avg_sentence_len"], profile["sentence_len_var"],
              profile["avg_word_len"], profile["yules_k"], p_vec_json, ngrams_json))
    conn.commit()
    conn.close()
    
    return {
        "persona_id": persona_id,
        "handle": persona["canonical_handle"],
        "platform": persona["platform"],
        "stylometric_profile": profile
    }

@router.get("/{case_id}/analytics/behavioral/{persona_id}")
def get_persona_behavioral(case_id: str, persona_id: str):
    persona, _, timestamps = get_persona_texts_and_timestamps(case_id, persona_id)
    profile = extract_behavioral_profile(timestamps)
    return {
        "persona_id": persona_id,
        "handle": persona["canonical_handle"],
        "platform": persona["platform"],
        "behavioral_profile": profile
    }

@router.post("/{case_id}/analytics/compare")
def compare_personas(case_id: str, request: CompareRequest):
    p_a, texts_a, ts_a = get_persona_texts_and_timestamps(case_id, request.persona_a_id)
    p_b, texts_b, ts_b = get_persona_texts_and_timestamps(case_id, request.persona_b_id)
    
    sty_a = extract_stylometric_profile(texts_a)
    sty_b = extract_stylometric_profile(texts_b)
    sty_comp = compare_stylometric_profiles(sty_a, sty_b)
    
    beh_a = extract_behavioral_profile(ts_a)
    beh_b = extract_behavioral_profile(ts_b)
    beh_comp = compare_behavioral_profiles(beh_a, beh_b)
    
    return {
        "case_id": case_id,
        "persona_a": {"id": request.persona_a_id, "handle": p_a["canonical_handle"], "platform": p_a["platform"]},
        "persona_b": {"id": request.persona_b_id, "handle": p_b["canonical_handle"], "platform": p_b["platform"]},
        "stylometric_comparison": sty_comp,
        "behavioral_comparison": beh_comp,
        "provenance": "DERIVED"
    }
