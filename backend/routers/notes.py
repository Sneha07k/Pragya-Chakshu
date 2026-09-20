"""
PRAGYA CHAKSHU — INVESTIGATOR NOTES & CHAIN-OF-CUSTODY ANNOTATIONS ROUTER
Enables investigators to attach timestamped forensic observations, analytical justifications,
and evidentiary memos to personas, evidence links, and overall cases.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from backend.database.sqlite import get_connection

router = APIRouter(prefix="/cases", tags=["notes"])


class NoteCreate(BaseModel):
    entity_type: str = Field(
        ..., description="Target type: PERSONA, EVIDENCE, IDENTIFIER, CASE"
    )
    entity_id: str = Field(
        ..., description="ID of the target persona, evidence, or case"
    )
    entity_label: Optional[str] = Field(
        None, description="Human-readable label of target"
    )
    note_text: str = Field(
        ..., min_length=1, description="Investigator observation text"
    )
    investigator_id: Optional[str] = Field(
        "investigator_1", description="Author investigator ID"
    )


@router.post("/{case_id}/notes")
def add_case_note(case_id: str, note_data: NoteCreate):
    """
    Creates an authenticated investigator note attached to an investigative entity.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Check case exists
    cursor.execute("SELECT case_id FROM cases WHERE case_id=?", (case_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Case not found")

    note_id = f"NOTE-{uuid.uuid4().hex[:12].upper()}"
    now = datetime.utcnow().isoformat() + "Z"

    cursor.execute(
        """
        INSERT INTO investigator_notes 
        (note_id, case_id, entity_type, entity_id, entity_label, investigator_id, note_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            note_id,
            case_id,
            note_data.entity_type.upper(),
            note_data.entity_id,
            note_data.entity_label or note_data.entity_id,
            note_data.investigator_id or "investigator_1",
            note_data.note_text.strip(),
            now,
        ),
    )

    conn.commit()
    conn.close()

    return {
        "note_id": note_id,
        "case_id": case_id,
        "entity_type": note_data.entity_type.upper(),
        "entity_id": note_data.entity_id,
        "entity_label": note_data.entity_label or note_data.entity_id,
        "investigator_id": note_data.investigator_id or "investigator_1",
        "note_text": note_data.note_text.strip(),
        "created_at": now,
        "provenance": "HUMAN_INVESTIGATOR",
        "status": "success",
    }


@router.get("/{case_id}/notes")
def list_case_notes(case_id: str, entity_id: Optional[str] = None):
    """
    Retrieves all notes for a case or filtered by a specific persona or evidence link.
    """
    conn = get_connection()
    cursor = conn.cursor()

    if entity_id:
        cursor.execute(
            """
            SELECT note_id, case_id, entity_type, entity_id, entity_label, investigator_id, note_text, created_at
            FROM investigator_notes
            WHERE case_id=? AND entity_id=?
            ORDER BY created_at DESC
        """,
            (case_id, entity_id),
        )
    else:
        cursor.execute(
            """
            SELECT note_id, case_id, entity_type, entity_id, entity_label, investigator_id, note_text, created_at
            FROM investigator_notes
            WHERE case_id=?
            ORDER BY created_at DESC
        """,
            (case_id,),
        )

    rows = cursor.fetchall()
    notes = [dict(r) for r in rows]
    conn.close()

    return {
        "case_id": case_id,
        "total_notes": len(notes),
        "notes": notes,
    }


@router.delete("/{case_id}/notes/{note_id}")
def delete_case_note(case_id: str, note_id: str):
    """
    Deletes an investigator note from the case.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT note_id FROM investigator_notes WHERE case_id=? AND note_id=?",
        (case_id, note_id),
    )
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")

    cursor.execute(
        "DELETE FROM investigator_notes WHERE case_id=? AND note_id=?",
        (case_id, note_id),
    )
    conn.commit()
    conn.close()

    return {"status": "deleted", "note_id": note_id}
