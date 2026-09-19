import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Optional
from backend.database.sqlite import get_connection
from backend.database.neo4j_client import (
    merge_server_node,
    merge_tls_cert_node,
    merge_service_node,
    merge_infrastructure_link,
)

# Realistic synthetic infrastructure templates (strictly tagged SYNTHETIC)
SYNTHETIC_HOSTING_PROVIDERS = [
    {"asn": "AS50673", "name": "FlokiNET Offshore Datacenter", "country": "IS", "netblock": "185.220.101.0/24"},
    {"asn": "AS200052", "name": "Voxility Bulletproof Netblock", "country": "RO", "netblock": "109.163.234.0/24"},
    {"asn": "AS39351", "name": "3NT Solutions Privacy Hosting", "country": "PA", "netblock": "194.26.29.0/24"},
]

def generate_synthetic_cluster(case_id: str, cluster_name: Optional[str] = "Evolution Mirror Cluster") -> Dict:
    """
    Generates a controlled synthetic infrastructure cluster for demonstrating Capability 1.
    All records, indicators, and nodes are strictly tagged with provenance='SYNTHETIC'.
    """
    prov = SYNTHETIC_HOSTING_PROVIDERS[0]
    server_id = f"server:{uuid.uuid4()}"
    server_ip = "185.220.101.78"
    asn = f"{prov['asn']} - {prov['name']}"
    country = prov['country']
    ssh_fingerprint = f"SHA256:{hashlib.sha256(server_id.encode()).hexdigest()[:43]}="
    http_banner = "nginx/1.18.0 (Ubuntu) OpenSSL/1.1.1f"
    
    # 1. Merge Server Node
    merge_server_node(
        server_id=server_id,
        ip=server_ip,
        asn=asn,
        country=country,
        ssh_fingerprint=ssh_fingerprint,
        http_banner=http_banner,
        provenance="SYNTHETIC",
        case_id=case_id
    )
    
    # 2. Synthetic TLS Certificate
    cert_id = f"cert:{uuid.uuid4()}"
    cert_sha256 = hashlib.sha256(f"cert_{server_id}".encode()).hexdigest()
    subject_cn = "gateway.darknet-relay.is"
    issuer = "cPanel, Inc. Certification Authority"
    jarm_hash = "27d40d40d29d40d1dc42d43d5c41d40212f840995c255c4d0a7a0b387e74e40e"
    
    merge_tls_cert_node(
        cert_id=cert_id,
        sha256=cert_sha256,
        subject_cn=subject_cn,
        issuer=issuer,
        jarm=jarm_hash,
        provenance="SYNTHETIC",
        server_id=server_id,
        case_id=case_id
    )
    
    # 3. Two Co-Hosted Hidden Services
    services = [
        {
            "id": f"srv:{uuid.uuid4()}",
            "onion_url": "k5q7z4n3evol7x9a.onion",
            "name": "Evolution Primary Escrow Portal",
            "type": "MARKETPLACE_GATEWAY"
        },
        {
            "id": f"srv:{uuid.uuid4()}",
            "onion_url": "v4m2p9k1evolbackup.onion",
            "name": "Evolution Fallback Admin Node",
            "type": "ADMIN_RELAY"
        }
    ]
    
    for s in services:
        merge_service_node(
            service_id=s['id'],
            onion_url=s['onion_url'],
            service_name=s['name'],
            service_type=s['type'],
            provenance="SYNTHETIC",
            server_id=server_id,
            cert_id=cert_id,
            case_id=case_id
        )
        
    # 4. Cross-Service Co-Hosting Link
    merge_infrastructure_link(
        service_a_id=services[0]['id'],
        service_b_id=services[1]['id'],
        link_type="CO_HOSTED_SERVER",
        reason=f"Both onion services resolve to shared physical host {server_ip} ({asn}) and identical JARM TLS certificate fingerprint",
        provenance="SYNTHETIC",
        case_id=case_id
    )
    
    # Also persist synthetic event in SQLite normalized_events for case timeline consistency
    conn = get_connection()
    cursor = conn.cursor()
    event_id = str(uuid.uuid4())
    payload = {
        "server_ip": server_ip,
        "asn": asn,
        "country": country,
        "tls_cert": {"subject_cn": subject_cn, "sha256": cert_sha256, "jarm": jarm_hash},
        "co_hosted_services": [s['onion_url'] for s in services],
        "cluster_name": cluster_name
    }
    cursor.execute("""
        INSERT INTO normalized_events (
            event_id, case_id, event_type, timestamp_occurred, timestamp_ingested,
            source_dataset, source_record_id, provenance, payload_json
        ) VALUES (?, ?, 'infrastructure_cluster_observed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                  'Synthetic_Infrastructure_Generator', ?, 'SYNTHETIC', ?)
    """, (event_id, case_id, server_id, str(payload)))
    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "provenance": "SYNTHETIC",
        "notice": "Controlled synthetic infrastructure indicators. Demonstrated exclusively for Capability 1 attribution.",
        "server": {
            "id": server_id,
            "ip": server_ip,
            "asn": asn,
            "country": country,
            "ssh_fingerprint": ssh_fingerprint,
            "http_banner": http_banner
        },
        "tls_certificate": {
            "id": cert_id,
            "subject_cn": subject_cn,
            "issuer": issuer,
            "sha256": cert_sha256,
            "jarm": jarm_hash
        },
        "co_hosted_services": services
    }
