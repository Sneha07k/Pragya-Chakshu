"""
PRAGYA CHAKSHU — COORDINATED ACTIVITY ROUTER
API endpoints for Capability 3: Coordinated Activity Discovery
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from backend.analytics.coordination import detect_coordination_network
from backend.database.sqlite import get_connection

router = APIRouter(prefix="/cases", tags=["coordination"])

class DetectCoordinationRequest(BaseModel):
    max_pairs: Optional[int] = 50

@router.post("/{case_id}/coordination/detect")
def run_coordination_detection(case_id: str, req: DetectCoordinationRequest = DetectCoordinationRequest()):
    """
    Runs coordinated activity discovery across ingested forum threads,
    diurnal posting synchrony, and historical interaction networks.
    Discovered links are merged into the investigation graph.
    """
    results = detect_coordination_network(case_id=case_id, max_pairs=req.max_pairs)
    return results

@router.get("/{case_id}/coordination/clusters")
def get_coordination_clusters(case_id: str):
    """
    Retrieves current coordination clusters and tightly-coupled operation groups for the case.
    """
    results = detect_coordination_network(case_id=case_id, max_pairs=30)
    return {
        "case_id": case_id,
        "provenance": "DERIVED",
        "clusters": results.get("coordination_clusters", []),
        "top_pairs": results.get("top_coordinated_pairs", [])
    }
