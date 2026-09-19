from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime
from backend.database.sqlite import get_connection
from backend.database.neo4j_client import merge_case_node

router = APIRouter(prefix="/cases", tags=["cases"])

class CaseCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class CaseUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None

@router.post("")
def create_case(case: CaseCreate):
    case_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO cases (case_id, name, description, status, created_at, updated_at)
        VALUES (?, ?, ?, 'OPEN', ?, ?)
    """, (case_id, case.name, case.description, now, now))
    conn.commit()
    conn.close()
    
    merge_case_node(case_id, case.name, 'OPEN')
    
    return {"case_id": case_id, "name": case.name, "description": case.description, "status": 'OPEN', "created_at": now}

@router.get("")
def get_cases():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cases")
    cases = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return cases

@router.get("/{case_id}")
def get_case(case_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cases WHERE case_id=?", (case_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
    return dict(row)

@router.patch("/{case_id}")
def update_case(case_id: str, case_update: CaseUpdate):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    updates = []
    params = []
    if case_update.status:
        updates.append("status=?")
        params.append(case_update.status)
    if case_update.description is not None:
        updates.append("description=?")
        params.append(case_update.description)
        
    if not updates:
        return {"status": "no updates provided"}
        
    updates.append("updated_at=?")
    params.append(now)
    params.append(case_id)
    
    query = f"UPDATE cases SET {', '.join(updates)} WHERE case_id=?"
    cursor.execute(query, params)
    conn.commit()
    
    cursor.execute("SELECT * FROM cases WHERE case_id=?", (case_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        merge_case_node(row['case_id'], row['name'], row['status'])
        return dict(row)
    raise HTTPException(status_code=404, detail="Case not found")
