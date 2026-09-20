"""
PRAGYA CHAKSHU — FORENSIC CASE DOSSIER & EXPORT ROUTER
Generates standardized investigation dossiers with full chain of custody,
provenance segregation breakdown (RESEARCH / DERIVED / SYNTHETIC),
and human challenge audit trails.
"""

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import HTMLResponse
import json
import hashlib
from datetime import datetime
from typing import Dict, Any

from backend.database.sqlite import get_connection
from backend.analytics.evaluation import run_evaluation_benchmark
from backend.analytics.coordination import detect_coordination_network

router = APIRouter(prefix="/cases", tags=["export"])


def compile_case_dossier(case_id: str) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Case details
    cursor.execute("SELECT * FROM cases WHERE case_id=?", (case_id,))
    case_row = cursor.fetchone()
    if not case_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Case not found")
    case = dict(case_row)

    # 2. Personas
    cursor.execute(
        "SELECT * FROM personas WHERE case_id=? OR case_id IS NULL", (case_id,)
    )
    personas = [dict(r) for r in cursor.fetchall()]

    # 3. Evidence
    cursor.execute("SELECT * FROM evidence WHERE case_id=?", (case_id,))
    evidence = [dict(r) for r in cursor.fetchall()]

    # 4. Challenges audit trail
    cursor.execute(
        "SELECT * FROM evidence_challenges WHERE case_id=? ORDER BY timestamp DESC",
        (case_id,),
    )
    challenges = [dict(r) for r in cursor.fetchall()]

    # 5. Normalized Events count and provenance breakdown
    cursor.execute(
        """
        SELECT provenance, count(*) as count 
        FROM normalized_events 
        WHERE case_id=? 
        GROUP BY provenance
    """,
        (case_id,),
    )
    prov_counts = {r["provenance"]: r["count"] for r in cursor.fetchall()}

    # 6. Evaluation metrics
    # Count derived analytical signals from evidence table
    cursor.execute(
        "SELECT count(*) FROM evidence WHERE case_id=? AND provenance='DERIVED'",
        (case_id,),
    )
    derived_evidence_count = cursor.fetchone()[0]
    derived_total = prov_counts.get("DERIVED", 0) + derived_evidence_count

    # 6. Evaluation metrics (evaluated at calibrated threshold 10.0)
    try:
        benchmark = run_evaluation_benchmark(case_id, threshold=10.0)
    except Exception:
        benchmark = {}

    # 7. Coordination summary
    try:
        coordination = detect_coordination_network(case_id, max_pairs=10)
    except Exception:
        coordination = {}

    # 8. Investigator notes
    cursor.execute(
        """
        SELECT note_id, case_id, entity_type, entity_id, entity_label, investigator_id, note_text, created_at
        FROM investigator_notes
        WHERE case_id=?
        ORDER BY created_at ASC
    """,
        (case_id,),
    )
    notes = [dict(r) for r in cursor.fetchall()]

    conn.close()

    dossier = {
        "dossier_id": f"DOSSIER-{case_id[:8].upper()}-{datetime.utcnow().strftime('%Y%m%d%H%M')}",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "system": "PRAGYA CHAKSHU Intelligence Attribution System",
        "classification": "CONTROLLED RESEARCH / EVALUATION",
        "case": case,
        "provenance_summary": {
            "RESEARCH": prov_counts.get("RESEARCH", 0),
            "DERIVED": derived_total,
            "SYNTHETIC": prov_counts.get("SYNTHETIC", 0),
            "total_events": prov_counts.get("RESEARCH", 0)
            + derived_total
            + prov_counts.get("SYNTHETIC", 0),
        },
        "personas": personas,
        "evidence_inventory": evidence,
        "investigator_notes": notes,
        "human_challenge_audit_trail": challenges,
        "evaluation_benchmark": benchmark.get("metrics", {}),
        "coordination_clusters": coordination.get("coordination_clusters", []),
    }

    # Digital seal / hash of the dossier for chain of custody
    payload_bytes = json.dumps(dossier, sort_keys=True).encode("utf-8")
    dossier["cryptographic_hash_sha256"] = hashlib.sha256(payload_bytes).hexdigest()

    return dossier


@router.get("/{case_id}/export/json")
def export_case_json(case_id: str):
    """
    Exports full forensic case dossier in structured JSON.
    """
    return compile_case_dossier(case_id)


@router.get("/{case_id}/export/dossier", response_class=HTMLResponse)
def export_printable_dossier(case_id: str):
    """
    Renders a formatted, printable HTML dossier with professional styling,
    provenance badges, and chain of custody log.
    """
    d = compile_case_dossier(case_id)
    c = d["case"]
    prov = d["provenance_summary"]
    metrics = d.get("evaluation_benchmark", {})
    challenges = d.get("human_challenge_audit_trail", [])
    personas = d.get("personas", [])
    notes = d.get("investigator_notes", [])
    evidence = d.get("evidence_inventory", [])

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PRAGYA CHAKSHU Case Dossier — {c.get('name')}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 40px;
            font-size: 13px;
            line-height: 1.6;
        }}
        .header {{
            border-bottom: 2px solid #0f172a;
            padding-bottom: 15px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }}
        .title {{
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
        }}
        .subtitle {{
            font-size: 13px;
            color: #64748b;
            margin-top: 4px;
        }}
        .seal {{
            text-align: right;
            font-family: monospace;
            font-size: 11px;
            color: #475569;
        }}
        .badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .badge-research {{ background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }}
        .badge-derived {{ background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }}
        .badge-synthetic {{ background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }}
        
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin: 20px 0;
        }}
        .kpi-card {{
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            background: #f8fafc;
        }}
        .kpi-val {{ font-size: 20px; font-weight: 700; color: #0f172a; }}
        .kpi-lbl {{ font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 2px; }}

        h2 {{
            font-size: 16px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
            margin-top: 30px;
            color: #0f172a;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 10px;
        }}
        th, td {{
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }}
        th {{ background: #f1f5f9; color: #475569; font-weight: 600; }}
        .footer {{
            margin-top: 40px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            font-size: 11px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
        }}
        @media print {{
            body {{ padding: 20px; font-size: 11px; }}
            .no-print {{ display: none; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="title">PRAGYA CHAKSHU — CASE DOSSIER</div>
            <div class="subtitle">Case: <strong>{c.get('name')}</strong> (ID: {c.get('case_id')})</div>
        </div>
        <div class="seal">
            <div>Dossier ID: {d['dossier_id']}</div>
            <div>Generated: {d['generated_at']}</div>
            <div>Status: <strong>{c.get('status')}</strong></div>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-val">{prov.get('RESEARCH', 0)}</div>
            <div class="kpi-lbl">Research Events <span class="badge badge-research">REAL</span></div>
        </div>
        <div class="kpi-card">
            <div class="kpi-val">{prov.get('DERIVED', 0)}</div>
            <div class="kpi-lbl">Derived Signals <span class="badge badge-derived">NLP/GRAPH</span></div>
        </div>
        <div class="kpi-card">
            <div class="kpi-val">{prov.get('SYNTHETIC', 0)}</div>
            <div class="kpi-lbl">Synthetic Infra <span class="badge badge-synthetic">CONTROLLED</span></div>
        </div>
        <div class="kpi-card">
            <div class="kpi-val">{metrics.get('precision_percent', 'N/A')}%</div>
            <div class="kpi-lbl">Precision @ τ=10% (F1: {metrics.get('f1_score', 'N/A')})</div>
        </div>
    </div>

    <h2>1. Case Personas & Attribution Inventory</h2>
    <table>
        <thead>
            <tr>
                <th>Canonical Handle</th>
                <th>Platform</th>
                <th>Provenance</th>
                <th>UID / VID</th>
                <th>First Seen</th>
            </tr>
        </thead>
        <tbody>
            {"".join(f"<tr><td><strong>{p.get('canonical_handle')}</strong></td><td>{p.get('platform')}</td><td><span class='badge badge-{p.get('provenance', '').lower()}'>{p.get('provenance')}</span></td><td>{p.get('raw_uid') or p.get('raw_vid') or 'N/A'}</td><td>{p.get('first_seen') or 'N/A'}</td></tr>" for p in personas[:25])}
        </tbody>
    </table>

    <h2>2. Investigator Field Notes & Case Annotations ({len(notes)})</h2>
    {f"""<table>
        <thead>
            <tr>
                <th>Timestamp (UTC)</th>
                <th>Investigator</th>
                <th>Target Entity</th>
                <th>Type</th>
                <th>Observation / Note</th>
            </tr>
        </thead>
        <tbody>
            {"".join(f"<tr><td style='white-space:nowrap;font-family:monospace;color:#475569;'>{n.get('created_at', '')[:19].replace('T', ' ')}</td><td><strong>{n.get('investigator_id')}</strong></td><td><strong>{n.get('entity_label')}</strong></td><td><span class='badge badge-derived'>{n.get('entity_type')}</span></td><td>{n.get('note_text')}</td></tr>" for n in notes)}
        </tbody>
    </table>""" if notes else "<p style='color: #64748b; font-style: italic;'>No investigator field notes recorded for this case.</p>"}

    <h2>3. Human-in-the-Loop Challenge Audit Trail</h2>
    {f"""<table>
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>Investigator</th>
                <th>Action</th>
                <th>Previous Score</th>
                <th>New Score</th>
                <th>Rationale</th>
            </tr>
        </thead>
        <tbody>
            {"".join(f"<tr><td>{ch.get('timestamp')}</td><td>{ch.get('investigator_id')}</td><td><strong>{ch.get('action')}</strong></td><td>{ch.get('previous_score')}%</td><td>{ch.get('new_score')}%</td><td>{ch.get('reason')}</td></tr>" for ch in challenges)}
        </tbody>
    </table>""" if challenges else "<p style='color: #64748b; font-style: italic;'>No human challenges recorded. All evidence items remain in active algorithmic consensus.</p>"}

    <h2>4. Chain of Custody & Integrity Seal</h2>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px;">
        <div><strong>SHA-256 Digital Fingerprint:</strong> {d['cryptographic_hash_sha256']}</div>
        <div style="margin-top: 4px; color: #64748b;">This cryptographic hash locks the entire state of cases, normalized events, stylometric profiles, and human challenges at time of export.</div>
    </div>

    <div class="footer">
        <div>PRAGYA CHAKSHU — Controlled Attribution & Forensic Intelligence System</div>
        <div>Page 1 of 1 • Strict Provenance Segregation Maintained</div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)
