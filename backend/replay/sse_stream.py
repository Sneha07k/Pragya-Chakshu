import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional
from backend.database.sqlite import get_connection
from backend.adapters.evolution_forum import stream_forum_posts, get_username_by_uid
from backend.adapters.normalizer import normalize_post_event
from backend.database.neo4j_client import merge_persona_node, merge_post_node, merge_identifier_node

class ReplayController:
    def __init__(self, case_id: str):
        self.case_id = case_id
        self.status = "STOPPED"  # STOPPED, RUNNING, PAUSED
        self.speed = 5.0          # Speed multiplier
        self.cursor: Optional[datetime] = None
        self.events_replayed = 0
        self.active_listeners = []
        self._task: Optional[asyncio.Task] = None
        self._load_or_create_session()

    def _load_or_create_session(self):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM replay_sessions WHERE case_id=?", (self.case_id,))
        row = cursor.fetchone()
        if row:
            self.session_id = row['session_id']
            self.status = row['status']
            self.speed = row['speed'] or 5.0
            if row['current_cursor_timestamp']:
                try:
                    self.cursor = datetime.fromisoformat(row['current_cursor_timestamp'].replace('Z', '+00:00'))
                except Exception:
                    self.cursor = None
            self.events_replayed = row['events_replayed'] or 0
        else:
            self.session_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            cursor.execute("""
                INSERT INTO replay_sessions (session_id, case_id, status, speed, events_replayed, started_at, updated_at)
                VALUES (?, ?, 'STOPPED', 5.0, 0, ?, ?)
            """, (self.session_id, self.case_id, now, now))
            conn.commit()
        conn.close()

    def _persist_state(self):
        conn = get_connection()
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        cur_str = self.cursor.isoformat() if self.cursor else None
        cursor.execute("""
            UPDATE replay_sessions SET
                status = ?, speed = ?, current_cursor_timestamp = ?,
                events_replayed = ?, updated_at = ?
            WHERE session_id = ?
        """, (self.status, self.speed, cur_str, self.events_replayed, now, self.session_id))
        conn.commit()
        conn.close()

    async def broadcast(self, event_name: str, payload: dict):
        message = f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"
        dead_queues = []
        for q in self.active_listeners:
            try:
                q.put_nowait(message)
            except Exception:
                dead_queues.append(q)
        for dq in dead_queues:
            if dq in self.active_listeners:
                self.active_listeners.remove(dq)

    async def run_replay_loop(self):
        # Compute how many distinct posts already exist in this case so replay streams NEW unseen observations
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT count(distinct source_record_id) FROM normalized_events WHERE case_id=? AND event_type='post_observed'",
            (self.case_id,)
        )
        offset_row = cursor.fetchone()
        offset = offset_row[0] if offset_row else 0
        conn.close()

        # Fetch pre-sorted chronological events from dataset starting at the offset
        posts_generator = stream_forum_posts(offset=offset, limit=1000)
        
        while self.status == "RUNNING":
            try:
                post = next(posts_generator, None)
            except Exception:
                post = None
                
            if not post:
                self.status = "STOPPED"
                self._persist_state()
                await self.broadcast("status_changed", {"status": "STOPPED", "message": "Replay dataset completed."})
                break
                
            uid = post.get('uid')
            username = get_username_by_uid(uid)
            norm_event = normalize_post_event(post, self.case_id, username)
            payload = json.loads(norm_event['payload_json'])
            
            event_ts_str = norm_event['timestamp_occurred']
            try:
                event_ts = datetime.fromisoformat(event_ts_str.replace('Z', '+00:00'))
            except Exception:
                event_ts = datetime.utcnow()
                
            self.cursor = event_ts
            self.events_replayed += 1
            
            # Persist to SQLite
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR IGNORE INTO normalized_events 
                (event_id, case_id, event_type, timestamp_occurred, timestamp_ingested, source_dataset, source_record_id, provenance, payload_json)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
            """, (norm_event['event_id'], self.case_id, norm_event['event_type'],
                  event_ts_str, norm_event['source_dataset'], norm_event['source_record_id'],
                  norm_event['provenance'], norm_event['payload_json']))
                  
            # Persona handling
            cursor.execute("SELECT persona_id FROM personas WHERE case_id=? AND raw_uid=?", (self.case_id, uid))
            p_row = cursor.fetchone()
            if p_row:
                persona_id = p_row['persona_id']
                cursor.execute("UPDATE personas SET last_seen=MAX(last_seen, ?) WHERE persona_id=?", (event_ts_str, persona_id))
            else:
                persona_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO personas (persona_id, case_id, canonical_handle, platform, first_seen, last_seen, provenance, raw_uid)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (persona_id, self.case_id, username, "Evolution Forum", event_ts_str, event_ts_str, 'RESEARCH', uid))
                merge_persona_node(persona_id, username, "Evolution Forum", 'RESEARCH', self.case_id)
                
            merge_post_node(post.get('pid'), post.get('tid'), post.get('seq_id'), event_ts_str, payload['clean_text'][:100], 'RESEARCH', persona_id, self.case_id)
            
            conn.commit()
            conn.close()
            
            # Broadcast new observation
            await self.broadcast("new_observation", {
                "event": norm_event,
                "persona": {"id": persona_id, "handle": username, "platform": "Evolution Forum"},
                "cursor": self.cursor.isoformat(),
                "events_replayed": self.events_replayed
            })
            
            self._persist_state()
            
            # Delay proportional to speed multiplier (e.g. 5x = 0.4s between events)
            sleep_time = max(0.1, 2.0 / self.speed)
            await asyncio.sleep(sleep_time)

    async def start(self, speed: Optional[float] = None):
        if speed is not None and speed > 0:
            self.speed = speed
        self.status = "RUNNING"
        self._persist_state()
        if self._task is None or self._task.done():
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self.run_replay_loop())
        return self.get_status()

    async def pause(self):
        self.status = "PAUSED"
        self._persist_state()
        if self._task and not self._task.done():
            self._task.cancel()
        return self.get_status()

    async def stop(self):
        self.status = "STOPPED"
        self.cursor = None
        self._persist_state()
        if self._task and not self._task.done():
            self._task.cancel()
        return self.get_status()

    async def set_speed(self, speed: float):
        self.speed = max(0.5, min(100.0, float(speed)))
        self._persist_state()
        return self.get_status()

    def get_status(self):
        return {
            "session_id": self.session_id,
            "case_id": self.case_id,
            "status": self.status,
            "speed": self.speed,
            "cursor": self.cursor.isoformat() if self.cursor else None,
            "events_replayed": self.events_replayed
        }

# Global registry of active controllers per case
_controllers: Dict[str, ReplayController] = {}

def get_replay_controller(case_id: str) -> ReplayController:
    if case_id not in _controllers:
        _controllers[case_id] = ReplayController(case_id)
    return _controllers[case_id]
