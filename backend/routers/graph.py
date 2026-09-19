from fastapi import APIRouter
from backend.database.neo4j_client import get_case_graph

router = APIRouter(prefix="/cases", tags=["graph"])

@router.get("/{case_id}/graph")
def get_graph(case_id: str):
    return get_case_graph(case_id)
