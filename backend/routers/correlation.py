from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.database.sqlite import get_connection
from backend.analytics.correlation import evaluate_persona_correlation, challenge_evidence_item, restore_evidence_item

router = APIRouter(prefix="/cases", tags=["correlation"])

class ChallengeRequest(BaseModel):
    reason: str
    investigator_id: Optional[str] = "investigator_1"

class RestoreRequest(BaseModel):
    investigator_id: Optional[str] = "investigator_1"

@router.get("/{case_id}/correlations")
def list_correlations(case_id: str, min_score: float = 0.0):
    """
    Scans personas in the case and discovers correlation hypotheses across platforms
    or handles. Computes multi-signal scores with supporting and conflicting evidence.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT persona_id, canonical_handle, platform FROM personas WHERE case_id=?", (case_id,))
    personas = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    correlations = []
    # Evaluate pairwise cross-platform or similar-handle pairs
    for i in range(len(personas)):
        for j in range(i + 1, len(personas)):
            p_a = personas[i]
            p_b = personas[j]
            
            # Prioritize cross-platform or similar handle candidates
            is_candidate = (p_a['platform'] != p_b['platform']) or (p_a['canonical_handle'].lower() == p_b['canonical_handle'].lower())
            
            if is_candidate:
                res = evaluate_persona_correlation(case_id, p_a['persona_id'], p_b['persona_id'])
                if res and res['correlation_score'] >= min_score:
                    correlations.append(res)
                    
    # Sort descending by correlation score
    correlations.sort(key=lambda x: x['correlation_score'], reverse=True)
    return {
        "case_id": case_id,
        "total_correlations": len(correlations),
        "notice": "Investigator Mode: Analytical hypotheses only. Ground-truth verified matches are isolated in Evaluation Mode.",
        "correlations": correlations
    }

@router.get("/{case_id}/correlations/{persona_a_id}/{persona_b_id}")
def get_correlation_detail(case_id: str, persona_a_id: str, persona_b_id: str):
    res = evaluate_persona_correlation(case_id, persona_a_id, persona_b_id)
    if not res:
        raise HTTPException(status_code=404, detail="Personas not found or could not evaluate correlation")
        
    # Fetch challenge history for this relationship
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ec.*, e.evidence_type, e.description 
        FROM evidence_challenges ec
        JOIN evidence e ON ec.evidence_id = e.evidence_id
        WHERE ec.case_id = ? AND e.relationship_id = ?
        ORDER BY ec.timestamp DESC
    """, (case_id, res['relationship_id']))
    challenges = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    res['challenge_audit_history'] = challenges
    return res

@router.post("/{case_id}/evidence/{evidence_id}/challenge")
def challenge_evidence(case_id: str, evidence_id: str, req: ChallengeRequest):
    result = challenge_evidence_item(case_id, evidence_id, req.reason, req.investigator_id)
    if not result:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    return result

@router.post("/{case_id}/evidence/{evidence_id}/restore")
def restore_evidence(case_id: str, evidence_id: str, req: RestoreRequest):
    result = restore_evidence_item(case_id, evidence_id, req.investigator_id)
    if not result:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    return result
