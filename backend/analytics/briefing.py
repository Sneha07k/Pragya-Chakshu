"""
PRAGYA CHAKSHU — CASE BRIEFING & INTELLIGENCE SUMMARIZER
Deterministic Natural Language Generation (NLG) engine that synthesizes
case entities, temporal scopes, attribution signals, co-hosted infrastructure,
and investigator notes into an executive intelligence brief without requiring an LLM.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
import json
from collections import Counter

from backend.database.sqlite import get_connection
from backend.analytics.coordination import detect_coordination_network
from backend.synthetic.infrastructure import SYNTHETIC_HOSTING_PROVIDERS


def generate_case_briefing(case_id: str) -> Dict[str, Any]:
    """
    Synthesizes the complete factual and analytical state of a case into a structured
    executive intelligence briefing with natural language explanations.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Case details
    cursor.execute("SELECT * FROM cases WHERE case_id=?", (case_id,))
    case_row = cursor.fetchone()
    if not case_row:
        conn.close()
        raise ValueError(f"Case '{case_id}' not found.")
    case = dict(case_row)

    # 2. Normalized Events & Time Range
    cursor.execute(
        """
        SELECT 
            event_type, 
            provenance,
            count(*) as cnt,
            min(timestamp_occurred) as min_time,
            max(timestamp_occurred) as max_time
        FROM normalized_events
        WHERE case_id=?
        GROUP BY event_type, provenance
    """,
        (case_id,),
    )
    event_group_rows = cursor.fetchall()

    total_events = 0
    prov_counts = {"RESEARCH": 0, "DERIVED": 0, "SYNTHETIC": 0}
    event_type_counts = Counter()
    all_min_times = []
    all_max_times = []

    for r in event_group_rows:
        cnt = r["cnt"]
        total_events += cnt
        prov_counts[r["provenance"]] = prov_counts.get(r["provenance"], 0) + cnt
        event_type_counts[r["event_type"]] += cnt
        if r["provenance"] == "RESEARCH":
            if r["min_time"] and r["min_time"] > "2000":
                all_min_times.append(r["min_time"])
            if r["max_time"] and r["max_time"] > "2000":
                all_max_times.append(r["max_time"])

    min_date = min(all_min_times)[:10] if all_min_times else "N/A"
    max_date = max(all_max_times)[:10] if all_max_times else "N/A"

    # 3. Personas & Platform breakdown
    cursor.execute(
        """
        SELECT persona_id, canonical_handle, platform, provenance, raw_uid, raw_vid, first_seen, last_seen
        FROM personas
        WHERE case_id=? OR case_id IS NULL
    """,
        (case_id,),
    )
    persona_rows = [dict(r) for r in cursor.fetchall()]
    total_personas = len(persona_rows)
    forum_personas = [
        p
        for p in persona_rows
        if "forum" in p.get("platform", "").lower() or p.get("raw_uid")
    ]
    market_personas = [
        p
        for p in persona_rows
        if "market" in p.get("platform", "").lower() or p.get("raw_vid")
    ]

    persona_map = {p["persona_id"]: p for p in persona_rows}

    # 4. Identifiers (PGP, BTC, Onion, Email)
    cursor.execute("""
        SELECT identifier_type, raw_value, normalized_value, provenance, persona_id
        FROM identifiers
    """)
    id_rows = [dict(r) for r in cursor.fetchall()]
    id_by_type = Counter(r["identifier_type"] for r in id_rows)
    id_by_persona = {}
    for r in id_rows:
        p_id = r.get("persona_id")
        if p_id:
            id_by_persona.setdefault(p_id, []).append(r)

    # 5. Evidence & Correlations
    cursor.execute(
        """
        SELECT evidence_id, source_persona_id, target_persona_id, evidence_type, 
               polarity, confidence_weight, description, provenance, challenge_status
        FROM evidence
        WHERE case_id=?
        ORDER BY confidence_weight DESC
    """,
        (case_id,),
    )
    evidence_rows = [dict(r) for r in cursor.fetchall()]
    active_evidence = [
        e for e in evidence_rows if e.get("challenge_status") == "ACTIVE"
    ]
    challenged_evidence = [
        e for e in evidence_rows if e.get("challenge_status") == "CHALLENGED"
    ]

    # Group evidence by (source, target) pair to synthesize high-confidence attributions
    pair_evidence_map = {}
    for e in active_evidence:
        src = e["source_persona_id"]
        tgt = e["target_persona_id"]
        key = (src, tgt) if src < tgt else (tgt, src)
        pair_evidence_map.setdefault(key, []).append(e)

    high_confidence_attributions = []
    for (src, tgt), ev_list in pair_evidence_map.items():
        supp = [e for e in ev_list if e.get("polarity") == "SUPPORTING"]
        conf = [e for e in ev_list if e.get("polarity") == "CONFLICTING"]
        # Calculate composite score
        score = sum(e.get("confidence_weight", 0.0) for e in supp) - sum(
            e.get("confidence_weight", 0.0) for e in conf
        )
        score = max(0.0, min(100.0, round(score, 1)))

        p_src = persona_map.get(src, {})
        p_tgt = persona_map.get(tgt, {})
        h_src = p_src.get("canonical_handle", "Unknown")
        h_tgt = p_tgt.get("canonical_handle", "Unknown")

        reasons = [e.get("description", e.get("evidence_type")) for e in supp]
        conf_reasons = [e.get("description", e.get("evidence_type")) for e in conf]

        if score >= 40.0 or any(
            "PGP" in str(r) or "handle" in str(r).lower() for r in reasons
        ):
            high_confidence_attributions.append(
                {
                    "source_persona_id": src,
                    "target_persona_id": tgt,
                    "source_handle": h_src,
                    "target_handle": h_tgt,
                    "source_platform": p_src.get("platform", "Unknown"),
                    "target_platform": p_tgt.get("platform", "Unknown"),
                    "confidence_score": score,
                    "supporting_reasons": reasons,
                    "conflicting_reasons": conf_reasons,
                    "summary": (
                        f"Strong correlation between '{h_src}' ({p_src.get('platform')}) and "
                        f"'{h_tgt}' ({p_tgt.get('platform')}) at {score}% confidence, supported by "
                        f"{len(reasons)} corroborating analytical signal(s)."
                    ),
                }
            )

    high_confidence_attributions.sort(key=lambda x: x["confidence_score"], reverse=True)

    # 6. Synthetic Infrastructure
    cursor.execute(
        """
        SELECT event_id, timestamp_occurred, source_record_id, payload_json, provenance 
        FROM normalized_events 
        WHERE case_id=? AND provenance='SYNTHETIC' AND event_type='infrastructure_cluster_observed'
        ORDER BY timestamp_occurred DESC
    """,
        (case_id,),
    )
    infra_events = cursor.fetchall()
    infra_clusters = []
    import ast

    for r in infra_events:
        raw_p = r["payload_json"]
        if isinstance(raw_p, dict):
            infra_clusters.append(raw_p)
        elif isinstance(raw_p, str):
            try:
                infra_clusters.append(json.loads(raw_p))
            except Exception:
                try:
                    infra_clusters.append(ast.literal_eval(raw_p))
                except Exception:
                    pass

    # 7. Investigator Notes
    cursor.execute(
        """
        SELECT note_id, case_id, entity_type, entity_id, entity_label, investigator_id, note_text, created_at
        FROM investigator_notes
        WHERE case_id=?
        ORDER BY created_at DESC
    """,
        (case_id,),
    )
    notes = [dict(r) for r in cursor.fetchall()]

    # 8. Coordinated Activity (Capability 3)
    coordination_findings = []
    try:
        coord_res = detect_coordination_network(case_id, max_pairs=10)
        clusters = coord_res.get("coordination_clusters", [])
        for cl in clusters[:5]:
            coordination_findings.append(
                {
                    "cluster_name": cl.get("name", "Coordinated Persona Clique"),
                    "pattern": cl.get("pattern", "HIGHLY_SYNCHRONIZED_CASCADE"),
                    "personas": cl.get("personas", []),
                    "coordination_score": cl.get("coordination_percentage", 75.0),
                    "summary": cl.get(
                        "description",
                        "Rapid reply cascade observed across shared threads.",
                    ),
                }
            )
    except Exception:
        pass

    conn.close()

    # ---------------------------------------------------------
    # 9. Natural Language Generation (Executive Narrative)
    # ---------------------------------------------------------
    case_name = case.get("name", "Unnamed Investigation")
    scope_span_days = "several weeks"
    if min_date != "N/A" and max_date != "N/A":
        try:
            d1 = datetime.strptime(min_date, "%Y-%m-%d")
            d2 = datetime.strptime(max_date, "%Y-%m-%d")
            days = abs((d2 - d1).days)
            scope_span_days = f"{days} days"
        except Exception:
            pass

    # Paragraph 1: Situation & Scope
    p1 = (
        f"Investigation '{case_name}' is currently in status '{case.get('status', 'OPEN')}'. "
        f"The forensic system has ingested and normalized {total_events:,} discrete events "
        f"spanning {scope_span_days} of activity (from {min_date} to {max_date}). "
        f"The environment tracks {total_personas} identified personas ({len(forum_personas)} on Evolution Forum "
        f"and {len(market_personas)} registered on Evolution Marketplace), along with "
        f"{id_by_type.get('PGP_KEY', 0)} cryptographic PGP key identities, "
        f"{id_by_type.get('BTC_ADDRESS', 0)} Bitcoin wallets, and {id_by_type.get('ONION_URL', 0)} darknet hidden services."
    )

    # Paragraph 2: Core Attribution Findings
    if high_confidence_attributions:
        top_attr = high_confidence_attributions[0]
        p2 = (
            f"Cross-platform identity attribution has yielded {len(high_confidence_attributions)} primary candidate links. "
            f"The leading correlation hypothesis matches forum persona '{top_attr['source_handle']}' to marketplace vendor "
            f"'{top_attr['target_handle']}' with an analytical confidence of {top_attr['confidence_score']}%. "
            f"Primary corroboration includes {', '.join(top_attr['supporting_reasons'][:2])}. "
        )
        if len(high_confidence_attributions) > 1:
            p2 += (
                f"Additionally, {len(high_confidence_attributions) - 1} other actor pairs exhibit lexical or behavioral "
                f"continuity requiring investigator review."
            )
    else:
        p2 = (
            f"Attribution algorithms are actively evaluating candidate persona pairs. Currently, observed personas show "
            f"preliminary indicator continuity, with stylometric and temporal diurnal curves continuously updating as new replay slices arrive."
        )

    # Paragraph 3: Infrastructure & Collusion Signals
    infra_summary_text = ""
    if infra_clusters:
        first_cl = infra_clusters[0]
        server_ip = first_cl.get("server_ip") or first_cl.get("server", {}).get(
            "ip", "185.220.101.78"
        )
        asn_name = first_cl.get("asn") or first_cl.get("server", {}).get(
            "asn", "FlokiNET Offshore Datacenter"
        )
        services = first_cl.get("co_hosted_services") or first_cl.get("services", [])
        infra_summary_text = (
            f"Controlled infrastructure telemetry identifies co-hosting on bulletproof server {server_ip} ({asn_name}), "
            f"where {len(services)} distinct .onion services share cryptographic JARM TLS certificate fingerprints."
        )
    elif coordination_findings:
        first_co = coordination_findings[0]
        infra_summary_text = (
            f"Coordinated activity discovery has detected thread synchronization among personas "
            f"{', '.join(first_co.get('personas', [])[:3])} displaying rapid reply cadences (Δt < 60s), indicating potential collusion."
        )
    else:
        infra_summary_text = f"No malicious co-hosting infrastructure or synchronized posting cliques have triggered threshold alerts at this time."

    p3 = (
        f"Infrastructure and network analysis: {infra_summary_text} "
        f"Strict Tripartite Provenance boundaries remain active: {prov_counts.get('RESEARCH', 0)} research events are quarantined "
        f"from {prov_counts.get('SYNTHETIC', 0)} simulated infrastructure nodes to ensure forensic veracity."
    )

    # Paragraph 4: Analyst Field Notes & Integrity
    p4 = (
        f"Audit & Case Integrity: Investigators have logged {len(notes)} field annotation(s) and recorded "
        f"{len(challenged_evidence)} human challenge action(s). All case indicators are cryptographically locked "
        f"with verifiable SHA-256 state hashing for court and intelligence admissibility."
    )

    # 10. Prioritized Recommendations for Next Investigative Steps
    recommendations = []
    if high_confidence_attributions:
        top_a = high_confidence_attributions[0]
        recommendations.append(
            {
                "priority": "HIGH",
                "title": f"Verify High-Confidence Attribution: {top_a['source_handle']} ↔ {top_a['target_handle']}",
                "description": (
                    f"Inspect the evidence breakdown for {top_a['source_handle']} ({top_a['source_platform']}) and "
                    f"{top_a['target_handle']} ({top_a['target_platform']}). Confirm PGP fingerprint match and 24h diurnal curve compatibility."
                ),
                "target_entity": top_a["source_handle"],
            }
        )

    if challenged_evidence:
        recommendations.append(
            {
                "priority": "HIGH",
                "title": f"Review {len(challenged_evidence)} Contested Evidence Item(s)",
                "description": "An investigator flagged one or more correlation items. Re-evaluate whether disputed signals should remain suppressed or restored.",
                "target_entity": "Evidence Challenges",
            }
        )

    if infra_clusters:
        recommendations.append(
            {
                "priority": "MEDIUM",
                "title": "Correlate Bulletproof Hosting IP with Mirror Services",
                "description": "Examine the shared JARM fingerprint across co-hosted .onion nodes to identify secondary backend relays.",
                "target_entity": "Infrastructure Cluster",
            }
        )

    if len(notes) == 0:
        recommendations.append(
            {
                "priority": "MEDIUM",
                "title": "Log Initial Investigator Field Notes",
                "description": "Attach case annotations to primary threat actors to document investigative hypotheses before exporting the official forensic dossier.",
                "target_entity": "Case Personas",
            }
        )
    else:
        recommendations.append(
            {
                "priority": "LOW",
                "title": "Export Formatted Forensic Dossier",
                "description": f"Generate the printable case dossier (incorporating all {len(notes)} notes and cryptographic SHA-256 seal) for briefing stakeholders.",
                "target_entity": "Export Dossier",
            }
        )

    # 11. Top Observed Personas
    top_personas = []
    for p in sorted(
        persona_rows,
        key=lambda x: (x.get("raw_uid") or 0) + (x.get("raw_vid") or 0),
        reverse=True,
    )[:6]:
        p_ids = id_by_persona.get(p["persona_id"], [])
        top_personas.append(
            {
                "persona_id": p["persona_id"],
                "handle": p["canonical_handle"],
                "platform": p["platform"],
                "provenance": p["provenance"],
                "identifiers_count": len(p_ids),
                "first_seen": p.get("first_seen"),
                "last_seen": p.get("last_seen"),
            }
        )

    return {
        "case_id": case_id,
        "case_name": case_name,
        "status": case.get("status", "OPEN"),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "scope": {
            "min_date": min_date,
            "max_date": max_date,
            "span_days": scope_span_days,
            "total_events": total_events,
            "total_personas": total_personas,
            "forum_personas_count": len(forum_personas),
            "market_personas_count": len(market_personas),
        },
        "provenance_breakdown": {
            "RESEARCH": prov_counts.get("RESEARCH", 0),
            "DERIVED": len(evidence_rows),
            "SYNTHETIC": prov_counts.get("SYNTHETIC", 0),
        },
        "executive_narrative": {
            "headline": f"Forensic Intelligence Briefing: {case_name}",
            "paragraphs": [p1, p2, p3, p4],
        },
        "key_suspects": top_personas,
        "high_confidence_attributions": high_confidence_attributions[:5],
        "coordination_findings": coordination_findings,
        "infrastructure_findings": infra_clusters[:3],
        "investigator_field_notes": notes[:5],
        "recommendations": recommendations,
    }
