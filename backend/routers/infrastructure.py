from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
from backend.synthetic.infrastructure import generate_synthetic_cluster
from backend.database.sqlite import get_connection

router = APIRouter(prefix="/cases", tags=["infrastructure"])

class GenerateClusterRequest(BaseModel):
    cluster_name: Optional[str] = "Evolution Infrastructure Cluster"

@router.post("/{case_id}/synthetic/generate")
def generate_cluster(case_id: str, req: GenerateClusterRequest):
    """
    CAPABILITY 1 — INFRASTRUCTURE ATTRIBUTION:
    Generates a controlled synthetic infrastructure cluster linking multiple .onion hidden services
    to a shared physical server via identical TLS certificate and JARM fingerprints.
    All data is strictly tagged with provenance: 'SYNTHETIC'.
    """
    result = generate_synthetic_cluster(case_id, req.cluster_name)
    return result

@router.get("/{case_id}/synthetic/clusters")
def list_clusters(case_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT event_id, timestamp_occurred, source_record_id, payload_json, provenance 
        FROM normalized_events 
        WHERE case_id=? AND provenance='SYNTHETIC' AND event_type='infrastructure_cluster_observed'
        ORDER BY timestamp_occurred DESC
    """, (case_id,))
    rows = cursor.fetchall()
    conn.close()
    
    clusters = []
    for r in rows:
        d = dict(r)
        try:
            d['payload'] = json.loads(d['payload_json']) if isinstance(d['payload_json'], str) else d['payload_json']
        except Exception:
            d['payload'] = d['payload_json']
        clusters.append(d)
        
    return {
        "case_id": case_id,
        "provenance": "SYNTHETIC",
        "notice": "Capability 1 Controlled Synthetic Infrastructure clusters.",
        "clusters": clusters
    }
