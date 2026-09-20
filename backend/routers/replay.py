from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
from backend.replay.replay_engine import ingest_initial_events
from backend.replay.sse_stream import get_replay_controller
from backend.adapters.user_matching import populate_ground_truth_table
from backend.database.sqlite import get_connection

router = APIRouter(prefix="/cases", tags=["replay"])


class IngestRequest(BaseModel):
    limit: int = 20
    source: Optional[str] = "forum"  # "forum", "vendors", "listings", "all"


class ReplayControlRequest(BaseModel):
    action: str  # "START", "PAUSE", "STOP", "SET_SPEED"
    speed: Optional[float] = None


@router.post("/{case_id}/ingest")
def ingest_events(case_id: str, request: IngestRequest):
    return ingest_initial_events(case_id, limit=request.limit, source=request.source)


@router.get("/{case_id}/events")
def get_events(case_id: str, limit: int = 50, offset: int = 0):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT * FROM normalized_events 
        WHERE case_id=? 
        ORDER BY timestamp_occurred ASC 
        LIMIT ? OFFSET ?
    """,
        (case_id, limit, offset),
    )
    rows = cursor.fetchall()
    conn.close()

    events = []
    for r in rows:
        d = dict(r)
        d["payload_json"] = json.loads(d["payload_json"])
        events.append(d)

    return events


@router.get("/{case_id}/ground-truth")
def get_ground_truth(case_id: str, limit: int = 100):
    """
    EVALUATION MODE ENDPOINT:
    Returns verified historical cross-platform matches for evaluation purposes.
    Strictly isolated from investigator correlation features.
    """
    populate_ground_truth_table()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT match_id, username, uid, vid, used_in_evaluation 
        FROM ground_truth_matches 
        LIMIT ?
    """,
        (limit,),
    )
    rows = cursor.fetchall()
    matches = [dict(r) for r in rows]

    cursor.execute(
        "SELECT persona_id, canonical_handle, platform, raw_uid, raw_vid FROM personas WHERE case_id=?",
        (case_id,),
    )
    case_personas = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return {
        "provenance": "EVALUATION_GROUND_TRUTH",
        "notice": "This reference data is used exclusively for evaluating correlation accuracy and is isolated from investigator mode.",
        "total_reference_matches_available": len(matches),
        "case_personas_count": len(case_personas),
        "matches": matches,
        "sample_reference_matches": matches[:20],
    }


@router.get("/{case_id}/replay/status")
async def get_status(case_id: str):
    controller = get_replay_controller(case_id)
    return controller.get_status()


@router.post("/{case_id}/replay/control")
async def control_replay(case_id: str, req: ReplayControlRequest):
    controller = get_replay_controller(case_id)
    act = req.action.upper()
    if act == "START":
        return await controller.start(speed=req.speed)
    elif act == "PAUSE":
        return await controller.pause()
    elif act == "STOP":
        return await controller.stop()
    elif act == "SET_SPEED":
        if req.speed is None:
            raise HTTPException(
                status_code=400, detail="Speed parameter required for SET_SPEED"
            )
        return await controller.set_speed(req.speed)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")


@router.get("/{case_id}/replay/stream")
async def replay_stream(case_id: str, request: Request):
    """
    Server-Sent Events (SSE) stream yielding real-time observation replays.
    """
    controller = get_replay_controller(case_id)
    queue = asyncio.Queue()
    controller.active_listeners.append(queue)

    async def event_generator():
        # Send initial status event
        init_msg = (
            f"event: status_connected\ndata: {json.dumps(controller.get_status())}\n\n"
        )
        yield init_msg

        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for next event with a periodic heartbeat
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield msg
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep connection alive
                    yield ": heartbeat\n\n"
        finally:
            if queue in controller.active_listeners:
                controller.active_listeners.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
