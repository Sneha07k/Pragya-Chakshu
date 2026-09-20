"""
PRAGYA CHAKSHU — AUTOMATED CASE BRIEFING & AI SUMMARIZER ROUTER
Provides structured executive debriefings, timeline analyses, actor attributions,
and actionable investigative recommendations using deterministic Natural Language Generation.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from backend.analytics.briefing import generate_case_briefing

router = APIRouter(prefix="/cases", tags=["briefing"])


@router.get("/{case_id}/briefing", response_model=Dict[str, Any])
def get_case_briefing_endpoint(case_id: str):
    """
    Returns an automated, deterministic executive intelligence briefing for a given case.
    Synthesizes timeline scope, key suspect profiles, attribution hypotheses,
    coordination cliques, co-hosted infrastructure, and recommended inquiries.
    """
    try:
        briefing = generate_case_briefing(case_id)
        return briefing
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate case briefing: {str(e)}"
        )
