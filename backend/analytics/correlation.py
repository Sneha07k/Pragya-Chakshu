import uuid
import math
from difflib import SequenceMatcher
import json
from backend.database.sqlite import get_connection
from backend.analytics.stylometry import (
    extract_stylometric_profile,
    compare_stylometric_profiles,
)
from backend.analytics.behavioral import (
    extract_behavioral_profile,
    compare_behavioral_profiles,
)
from backend.database.neo4j_client import merge_correlation_edge


def calculate_handle_similarity(handle_a, handle_b):
    if not handle_a or not handle_b:
        return 0.0
    ha = handle_a.lower().strip()
    hb = handle_b.lower().strip()
    if ha == hb:
        return 100.0
    # SequenceMatcher ratio
    ratio = SequenceMatcher(None, ha, hb).ratio()
    return round(ratio * 100.0, 1)


def evaluate_persona_correlation(case_id: str, persona_a_id: str, persona_b_id: str):
    """
    Evaluates correlation hypothesis between Persona A and Persona B.
    Extracts all evidence signals, calculates score, persists evidence to SQLite,
    and updates the graph edge.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Fetch persona records
    cursor.execute(
        "SELECT * FROM personas WHERE case_id=? AND persona_id=?",
        (case_id, persona_a_id),
    )
    p_a = cursor.fetchone()
    cursor.execute(
        "SELECT * FROM personas WHERE case_id=? AND persona_id=?",
        (case_id, persona_b_id),
    )
    p_b = cursor.fetchone()

    if not p_a or not p_b:
        conn.close()
        return None

    p_a = dict(p_a)
    p_b = dict(p_b)

    relationship_id = (
        f"rel_{min(persona_a_id, persona_b_id)}_{max(persona_a_id, persona_b_id)}"
    )

    # 2. Check existing evidence in DB
    cursor.execute(
        """
        SELECT * FROM evidence 
        WHERE case_id=? AND ((source_persona_id=? AND target_persona_id=?) OR (source_persona_id=? AND target_persona_id=?))
    """,
        (case_id, persona_a_id, persona_b_id, persona_b_id, persona_a_id),
    )
    existing_evidence = [dict(r) for r in cursor.fetchall()]

    # If evidence already exists, use it to calculate score (taking into account challenge_status)
    # Otherwise, generate initial evidence signals
    if not existing_evidence:
        generated_evidence = []

        # --- SIGNAL 1: Handle Continuity ---
        handle_sim = calculate_handle_similarity(
            p_a["canonical_handle"], p_b["canonical_handle"]
        )
        if handle_sim >= 90:
            generated_evidence.append(
                {
                    "evidence_id": str(uuid.uuid4()),
                    "case_id": case_id,
                    "relationship_id": relationship_id,
                    "source_persona_id": persona_a_id,
                    "target_persona_id": persona_b_id,
                    "evidence_type": "HANDLE_CONTINUITY",
                    "polarity": "SUPPORTING",
                    "confidence_weight": 25.0,
                    "description": f"Direct handle continuity: '{p_a['canonical_handle']}' and '{p_b['canonical_handle']}' ({handle_sim}% string similarity)",
                    "provenance": "DERIVED",
                }
            )
        elif handle_sim >= 70:
            generated_evidence.append(
                {
                    "evidence_id": str(uuid.uuid4()),
                    "case_id": case_id,
                    "relationship_id": relationship_id,
                    "source_persona_id": persona_a_id,
                    "target_persona_id": persona_b_id,
                    "evidence_type": "HANDLE_SIMILARITY",
                    "polarity": "SUPPORTING",
                    "confidence_weight": 15.0,
                    "description": f"Lexical handle resemblance: '{p_a['canonical_handle']}' ~ '{p_b['canonical_handle']}' ({handle_sim}% similarity)",
                    "provenance": "DERIVED",
                }
            )

        # --- SIGNAL 2: Shared Cryptographic PGP Keys & Identifiers ---
        cursor.execute("SELECT * FROM identifiers WHERE persona_id=?", (persona_a_id,))
        idents_a = [dict(r) for r in cursor.fetchall()]
        cursor.execute("SELECT * FROM identifiers WHERE persona_id=?", (persona_b_id,))
        idents_b = [dict(r) for r in cursor.fetchall()]

        pgp_a = {
            i["normalized_value"] for i in idents_a if i["identifier_type"] == "PGP_KEY"
        }
        pgp_b = {
            i["normalized_value"] for i in idents_b if i["identifier_type"] == "PGP_KEY"
        }
        shared_pgp = pgp_a.intersection(pgp_b)

        if shared_pgp:
            generated_evidence.append(
                {
                    "evidence_id": str(uuid.uuid4()),
                    "case_id": case_id,
                    "relationship_id": relationship_id,
                    "source_persona_id": persona_a_id,
                    "target_persona_id": persona_b_id,
                    "evidence_type": "PGP_KEY_MATCH",
                    "polarity": "SUPPORTING",
                    "confidence_weight": 40.0,
                    "description": "Cryptographic identity match: Both personas share the exact same PGP public key",
                    "provenance": "DERIVED",
                }
            )

        # Check other shared identifiers (BTC, Onion)
        other_a = {
            f"{i['identifier_type']}:{i['normalized_value']}"
            for i in idents_a
            if i["identifier_type"] != "PGP_KEY"
        }
        other_b = {
            f"{i['identifier_type']}:{i['normalized_value']}"
            for i in idents_b
            if i["identifier_type"] != "PGP_KEY"
        }
        shared_other = other_a.intersection(other_b)
        for so in shared_other:
            itype, val = so.split(":", 1)
            generated_evidence.append(
                {
                    "evidence_id": str(uuid.uuid4()),
                    "case_id": case_id,
                    "relationship_id": relationship_id,
                    "source_persona_id": persona_a_id,
                    "target_persona_id": persona_b_id,
                    "evidence_type": f"SHARED_{itype}",
                    "polarity": "SUPPORTING",
                    "confidence_weight": 20.0,
                    "description": f"Shared infrastructure/crypto indicator: Both personas referenced {itype} ({val[:24]}...)",
                    "provenance": "DERIVED",
                }
            )

        # --- SIGNAL 3: Stylometric Feature Comparison ---
        from backend.routers.analytics import get_persona_texts_and_timestamps

        _, texts_a, ts_a = get_persona_texts_and_timestamps(case_id, persona_a_id)
        _, texts_b, ts_b = get_persona_texts_and_timestamps(case_id, persona_b_id)

        if texts_a and texts_b:
            prof_a = extract_stylometric_profile(texts_a)
            prof_b = extract_stylometric_profile(texts_b)
            sty_comp = compare_stylometric_profiles(prof_a, prof_b)
            sty_score = sty_comp["overall_stylometric_similarity"]

            if sty_score >= 65:
                generated_evidence.append(
                    {
                        "evidence_id": str(uuid.uuid4()),
                        "case_id": case_id,
                        "relationship_id": relationship_id,
                        "source_persona_id": persona_a_id,
                        "target_persona_id": persona_b_id,
                        "evidence_type": "STYLOMETRIC_SIMILARITY",
                        "polarity": "SUPPORTING",
                        "confidence_weight": 25.0,
                        "description": f"High stylometric alignment ({sty_score}% concordant): Character 4-grams ({sty_comp['signals']['char_ngram_similarity']}%) & punctuation ({sty_comp['signals']['punctuation_similarity']}%)",
                        "provenance": "DERIVED",
                    }
                )
            elif sty_score <= 25 and len(texts_a) >= 2 and len(texts_b) >= 2:
                generated_evidence.append(
                    {
                        "evidence_id": str(uuid.uuid4()),
                        "case_id": case_id,
                        "relationship_id": relationship_id,
                        "source_persona_id": persona_a_id,
                        "target_persona_id": persona_b_id,
                        "evidence_type": "STYLOMETRIC_DIVERGENCE",
                        "polarity": "CONFLICTING",
                        "confidence_weight": 20.0,
                        "description": f"Divergent writing styles ({sty_score}% match): Contrasting vocabulary richness and n-gram patterns",
                        "provenance": "DERIVED",
                    }
                )

        # --- SIGNAL 4: Temporal Behavioral Alignment ---
        if ts_a and ts_b:
            bprof_a = extract_behavioral_profile(ts_a)
            bprof_b = extract_behavioral_profile(ts_b)
            beh_comp = compare_behavioral_profiles(bprof_a, bprof_b)

            if beh_comp["is_conflicting"]:
                generated_evidence.append(
                    {
                        "evidence_id": str(uuid.uuid4()),
                        "case_id": case_id,
                        "relationship_id": relationship_id,
                        "source_persona_id": persona_a_id,
                        "target_persona_id": persona_b_id,
                        "evidence_type": "TEMPORAL_CONFLICT",
                        "polarity": "CONFLICTING",
                        "confidence_weight": 25.0,
                        "description": beh_comp["description"],
                        "provenance": "DERIVED",
                    }
                )
            elif beh_comp["diurnal_similarity_score"] >= 75:
                generated_evidence.append(
                    {
                        "evidence_id": str(uuid.uuid4()),
                        "case_id": case_id,
                        "relationship_id": relationship_id,
                        "source_persona_id": persona_a_id,
                        "target_persona_id": persona_b_id,
                        "evidence_type": "TEMPORAL_ALIGNMENT",
                        "polarity": "SUPPORTING",
                        "confidence_weight": 15.0,
                        "description": beh_comp["description"],
                        "provenance": "DERIVED",
                    }
                )

        # Insert all generated evidence into SQLite
        for ev in generated_evidence:
            cursor.execute(
                """
                INSERT INTO evidence (
                    evidence_id, case_id, relationship_id, source_persona_id, target_persona_id,
                    evidence_type, polarity, confidence_weight, description, provenance, challenge_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
            """,
                (
                    ev["evidence_id"],
                    ev["case_id"],
                    ev["relationship_id"],
                    ev["source_persona_id"],
                    ev["target_persona_id"],
                    ev["evidence_type"],
                    ev["polarity"],
                    ev["confidence_weight"],
                    ev["description"],
                    ev["provenance"],
                ),
            )
        conn.commit()

        # Reload evidence from DB
        cursor.execute(
            """
            SELECT * FROM evidence 
            WHERE case_id=? AND ((source_persona_id=? AND target_persona_id=?) OR (source_persona_id=? AND target_persona_id=?))
        """,
            (case_id, persona_a_id, persona_b_id, persona_b_id, persona_a_id),
        )
        existing_evidence = [dict(r) for r in cursor.fetchall()]

    conn.close()

    # 3. Calculate Score using the active (non-challenged) evidence items
    return compute_score_from_evidence(
        existing_evidence, p_a, p_b, relationship_id, case_id
    )


def compute_score_from_evidence(
    evidence_list, persona_a, persona_b, relationship_id, case_id
):
    active_supporting = [
        e
        for e in evidence_list
        if e["polarity"] == "SUPPORTING" and e.get("challenge_status") == "ACTIVE"
    ]
    active_conflicting = [
        e
        for e in evidence_list
        if e["polarity"] == "CONFLICTING" and e.get("challenge_status") == "ACTIVE"
    ]

    sum_supp_weights = sum(e["confidence_weight"] for e in active_supporting)
    sum_conf_weights = sum(e["confidence_weight"] for e in active_conflicting)

    if sum_supp_weights == 0:
        raw_score = 0.0
    else:
        # Scale score bounded between 0 and 100
        raw_score = max(0.0, min(100.0, sum_supp_weights - sum_conf_weights))
        # If strong supporting evidence exists, boost proportional to maximum potential weight
        scale_factor = min(1.0, sum_supp_weights / 60.0)
        raw_score = round(raw_score * scale_factor, 1)
        raw_score = max(0.0, min(100.0, raw_score))

    # Merge or update the correlation edge in graph only if positive correlation exists
    if raw_score > 0.0:
        merge_correlation_edge(
            persona_a["persona_id"],
            persona_b["persona_id"],
            raw_score,
            0.85,
            relationship_id,
            case_id,
        )

    return {
        "relationship_id": relationship_id,
        "case_id": case_id,
        "persona_a": {
            "id": persona_a["persona_id"],
            "handle": persona_a["canonical_handle"],
            "platform": persona_a["platform"],
        },
        "persona_b": {
            "id": persona_b["persona_id"],
            "handle": persona_b["canonical_handle"],
            "platform": persona_b["platform"],
        },
        "correlation_score": raw_score,
        "active_supporting_weight": sum_supp_weights,
        "active_conflicting_weight": sum_conf_weights,
        "evidence_items": evidence_list,
        "notice": "Analytical correlation hypothesis based on available signals. Does not constitute proof of identity.",
        "provenance": "DERIVED",
    }


def challenge_evidence_item(
    case_id: str, evidence_id: str, reason: str, investigator_id: str = "investigator_1"
):
    """
    HUMAN-IN-THE-LOOP CHALLENGE ACTION:
    Challenges an evidence item, updates database, logs audit trail, and recalculates score.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM evidence WHERE evidence_id=?", (evidence_id,))
    ev = cursor.fetchone()
    if not ev:
        conn.close()
        return None

    ev = dict(ev)
    p_a_id = ev["source_persona_id"]
    p_b_id = ev["target_persona_id"]
    rel_id = ev["relationship_id"]

    # Calculate score before challenge
    cursor.execute("SELECT * FROM evidence WHERE relationship_id=?", (rel_id,))
    all_ev = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM personas WHERE persona_id=?", (p_a_id,))
    p_a = dict(cursor.fetchone())
    cursor.execute("SELECT * FROM personas WHERE persona_id=?", (p_b_id,))
    p_b = dict(cursor.fetchone())

    prev_result = compute_score_from_evidence(all_ev, p_a, p_b, rel_id, case_id)
    prev_score = prev_result["correlation_score"]

    # Update evidence status to CHALLENGED
    cursor.execute(
        "UPDATE evidence SET challenge_status='CHALLENGED' WHERE evidence_id=?",
        (evidence_id,),
    )

    # Recalculate score
    cursor.execute("SELECT * FROM evidence WHERE relationship_id=?", (rel_id,))
    updated_ev = [dict(r) for r in cursor.fetchall()]
    new_result = compute_score_from_evidence(updated_ev, p_a, p_b, rel_id, case_id)
    new_score = new_result["correlation_score"]

    # Insert challenge audit log
    challenge_id = str(uuid.uuid4())
    cursor.execute(
        """
        INSERT INTO evidence_challenges (
            challenge_id, evidence_id, case_id, investigator_id, action, reason, previous_score, new_score, timestamp
        ) VALUES (?, ?, ?, ?, 'CHALLENGE', ?, ?, ?, CURRENT_TIMESTAMP)
    """,
        (
            challenge_id,
            evidence_id,
            case_id,
            investigator_id,
            reason,
            prev_score,
            new_score,
        ),
    )

    conn.commit()
    conn.close()

    return {
        "success": True,
        "action": "CHALLENGE",
        "evidence_id": evidence_id,
        "previous_score": prev_score,
        "new_score": new_score,
        "updated_relationship": new_result,
    }


def restore_evidence_item(
    case_id: str, evidence_id: str, investigator_id: str = "investigator_1"
):
    """
    HUMAN-IN-THE-LOOP RESTORE ACTION:
    Restores a challenged evidence item to ACTIVE, logs audit trail, and recalculates score.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM evidence WHERE evidence_id=?", (evidence_id,))
    ev = cursor.fetchone()
    if not ev:
        conn.close()
        return None

    ev = dict(ev)
    p_a_id = ev["source_persona_id"]
    p_b_id = ev["target_persona_id"]
    rel_id = ev["relationship_id"]

    cursor.execute("SELECT * FROM personas WHERE persona_id=?", (p_a_id,))
    p_a = dict(cursor.fetchone())
    cursor.execute("SELECT * FROM personas WHERE persona_id=?", (p_b_id,))
    p_b = dict(cursor.fetchone())

    # Get score before restore
    cursor.execute("SELECT * FROM evidence WHERE relationship_id=?", (rel_id,))
    all_ev = [dict(r) for r in cursor.fetchall()]
    prev_result = compute_score_from_evidence(all_ev, p_a, p_b, rel_id, case_id)
    prev_score = prev_result["correlation_score"]

    # Update evidence status to ACTIVE
    cursor.execute(
        "UPDATE evidence SET challenge_status='ACTIVE' WHERE evidence_id=?",
        (evidence_id,),
    )

    # Recalculate score
    cursor.execute("SELECT * FROM evidence WHERE relationship_id=?", (rel_id,))
    updated_ev = [dict(r) for r in cursor.fetchall()]
    new_result = compute_score_from_evidence(updated_ev, p_a, p_b, rel_id, case_id)
    new_score = new_result["correlation_score"]

    # Insert restore audit log
    challenge_id = str(uuid.uuid4())
    cursor.execute(
        """
        INSERT INTO evidence_challenges (
            challenge_id, evidence_id, case_id, investigator_id, action, reason, previous_score, new_score, timestamp
        ) VALUES (?, ?, ?, ?, 'RESTORE', 'Investigator restored evidence', ?, ?, CURRENT_TIMESTAMP)
    """,
        (challenge_id, evidence_id, case_id, investigator_id, prev_score, new_score),
    )

    conn.commit()
    conn.close()

    return {
        "success": True,
        "action": "RESTORE",
        "evidence_id": evidence_id,
        "previous_score": prev_score,
        "new_score": new_score,
        "updated_relationship": new_result,
    }
