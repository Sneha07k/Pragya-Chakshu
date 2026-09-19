import os
import json
import logging
from neo4j import GraphDatabase, exceptions
import networkx as nx
from backend.config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

logger = logging.getLogger(__name__)

GRAPH_FALLBACK_PATH = r"c:\projects\PC\backend\data\graph_fallback.json"
_driver = None
_nx_graph = None
_use_fallback = False


def init_neo4j():
    global _driver, _nx_graph, _use_fallback
    os.makedirs(os.path.dirname(GRAPH_FALLBACK_PATH), exist_ok=True)
    try:
        _driver = GraphDatabase.driver(
            NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD), connection_timeout=1.0
        )
        _driver.verify_connectivity()
        logger.info("Successfully connected to Neo4j.")
    except Exception as e:
        logger.warning(
            f"Failed to connect to Neo4j. Falling back to NetworkX. Error: {e}"
        )
        _use_fallback = True
        if os.path.exists(GRAPH_FALLBACK_PATH):
            try:
                with open(GRAPH_FALLBACK_PATH, "r") as f:
                    data = json.load(f)
                    _nx_graph = nx.node_link_graph(data)
            except Exception as e:
                logger.error(f"Failed to load fallback graph: {e}")
                _nx_graph = nx.DiGraph()
        else:
            _nx_graph = nx.DiGraph()


def _save_fallback_graph():
    if _use_fallback and _nx_graph is not None:
        data = nx.node_link_data(_nx_graph)
        with open(GRAPH_FALLBACK_PATH, "w") as f:
            json.dump(data, f)


def _ensure_init():
    if _driver is None and not _use_fallback:
        init_neo4j()


def merge_case_node(case_id, name, status):
    _ensure_init()
    if _use_fallback:
        _nx_graph.add_node(case_id, type="Case", label=name, name=name, status=status)
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (c:Case {id: $case_id}) " "SET c.name = $name, c.status = $status",
            case_id=case_id,
            name=name,
            status=status,
        )


def merge_persona_node(persona_id, handle, platform, provenance, case_id):
    _ensure_init()
    if _use_fallback:
        _nx_graph.add_node(
            persona_id,
            type="Persona",
            label=handle,
            handle=handle,
            platform=platform,
            provenance=provenance,
        )
        _nx_graph.add_edge(persona_id, case_id, label="PART_OF")
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (p:Persona {id: $persona_id}) "
            "SET p.handle = $handle, p.platform = $platform, p.provenance = $provenance "
            "MERGE (c:Case {id: $case_id}) "
            "MERGE (p)-[:PART_OF]->(c)",
            persona_id=persona_id,
            handle=handle,
            platform=platform,
            provenance=provenance,
            case_id=case_id,
        )


def merge_post_node(
    pid, tid, seq_id, timestamp_str, text_snippet, provenance, persona_id, case_id
):
    _ensure_init()
    post_id = f"post:{pid}"
    if _use_fallback:
        _nx_graph.add_node(
            post_id,
            type="Post",
            label=f"Post #{pid}",
            tid=tid,
            seq_id=seq_id,
            timestamp=timestamp_str,
            text_snippet=text_snippet,
            provenance=provenance,
        )
        _nx_graph.add_edge(persona_id, post_id, label="AUTHORED")
        _nx_graph.add_edge(post_id, case_id, label="PART_OF")
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (po:Post {id: $post_id}) "
            "SET po.tid = $tid, po.seq_id = $seq_id, po.timestamp = $timestamp_str, po.text_snippet = $text_snippet, po.provenance = $provenance "
            "MERGE (p:Persona {id: $persona_id}) "
            "MERGE (c:Case {id: $case_id}) "
            "MERGE (p)-[:AUTHORED]->(po) "
            "MERGE (po)-[:PART_OF]->(c)",
            post_id=post_id,
            tid=tid,
            seq_id=seq_id,
            timestamp_str=timestamp_str,
            text_snippet=text_snippet,
            provenance=provenance,
            persona_id=persona_id,
            case_id=case_id,
        )


def merge_identifier_node(
    identifier_id, id_type, value, provenance, persona_id, post_pid=None
):
    _ensure_init()
    if _use_fallback:
        display_val = value[:20] + "..." if len(value) > 20 else value
        _nx_graph.add_node(
            identifier_id,
            type="Identifier",
            label=f"{id_type}: {display_val}",
            identifier_type=id_type,
            value=value,
            provenance=provenance,
        )
        _nx_graph.add_edge(persona_id, identifier_id, label="USES_IDENTIFIER")
        if post_pid:
            post_id = f"post:{post_pid}"
            _nx_graph.add_edge(post_id, identifier_id, label="MENTIONS_IDENTIFIER")
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (i:Identifier {id: $identifier_id}) "
            "SET i.type = $id_type, i.value = $value, i.provenance = $provenance "
            "MERGE (p:Persona {id: $persona_id}) "
            "MERGE (p)-[:USES_IDENTIFIER]->(i)",
            identifier_id=identifier_id,
            id_type=id_type,
            value=value,
            provenance=provenance,
            persona_id=persona_id,
        )
        if post_pid:
            session.run(
                "MERGE (po:Post {id: $post_id}) "
                "MERGE (i:Identifier {id: $identifier_id}) "
                "MERGE (po)-[:MENTIONS_IDENTIFIER]->(i)",
                post_id=f"post:{post_pid}",
                identifier_id=identifier_id,
            )


def merge_listing_node(
    lid, vid, title, price, product_class, provenance, persona_id, case_id
):
    _ensure_init()
    listing_id = f"listing:{lid}"
    if _use_fallback:
        display_title = title[:30] + "..." if len(title) > 30 else title
        _nx_graph.add_node(
            listing_id,
            type="Listing",
            label=f"Listing #{lid}: {display_title}",
            title=title,
            price=price,
            product_class=product_class,
            provenance=provenance,
        )
        _nx_graph.add_edge(persona_id, listing_id, label="PUBLISHED")
        _nx_graph.add_edge(listing_id, case_id, label="PART_OF")
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (l:Listing {id: $listing_id}) "
            "SET l.title = $title, l.price = $price, l.product_class = $product_class, l.provenance = $provenance "
            "MERGE (p:Persona {id: $persona_id}) "
            "MERGE (c:Case {id: $case_id}) "
            "MERGE (p)-[:PUBLISHED]->(l) "
            "MERGE (l)-[:PART_OF]->(c)",
            listing_id=listing_id,
            title=title,
            price=price,
            product_class=product_class,
            provenance=provenance,
            persona_id=persona_id,
            case_id=case_id,
        )


def merge_correlation_edge(
    persona_a_id, persona_b_id, score, confidence, relationship_id, case_id
):
    _ensure_init()
    if _use_fallback:
        _nx_graph.add_edge(
            persona_a_id,
            persona_b_id,
            label="CORRELATED_WITH",
            score=score,
            confidence=confidence,
            relationship_id=relationship_id,
            case_id=case_id,
        )
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (a:Persona {id: $persona_a_id}) "
            "MERGE (b:Persona {id: $persona_b_id}) "
            "MERGE (a)-[r:CORRELATED_WITH]->(b) "
            "SET r.score = $score, r.confidence = $confidence, r.relationship_id = $relationship_id, r.case_id = $case_id",
            persona_a_id=persona_a_id,
            persona_b_id=persona_b_id,
            score=score,
            confidence=confidence,
            relationship_id=relationship_id,
            case_id=case_id,
        )


def merge_coordination_link(
    source_persona_id, target_persona_id, score, weight, latency_sec, pattern, case_id
):
    _ensure_init()
    if _use_fallback:
        _nx_graph.add_edge(
            source_persona_id,
            target_persona_id,
            label="COORDINATED_WITH",
            score=score,
            weight=weight,
            latency_sec=latency_sec,
            pattern=pattern,
            provenance="DERIVED",
            case_id=case_id,
        )
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (a:Persona {id: $source_id}) "
            "MERGE (b:Persona {id: $target_id}) "
            "MERGE (a)-[r:COORDINATED_WITH]->(b) "
            "SET r.score = $score, r.weight = $weight, r.latency_sec = $latency_sec, r.pattern = $pattern, r.provenance = 'DERIVED', r.case_id = $case_id",
            source_id=source_persona_id,
            target_id=target_persona_id,
            score=score,
            weight=weight,
            latency_sec=latency_sec,
            pattern=pattern,
            case_id=case_id,
        )


def merge_server_node(
    server_id, ip, asn, country, ssh_fingerprint, http_banner, provenance, case_id
):
    _ensure_init()
    if _use_fallback:
        _nx_graph.add_node(
            server_id,
            type="Server",
            label=f"Server: {ip}",
            ip=ip,
            asn=asn,
            country=country,
            ssh_fingerprint=ssh_fingerprint,
            http_banner=http_banner,
            provenance=provenance,
        )
        _nx_graph.add_edge(server_id, case_id, label="PART_OF")
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (s:Server {id: $server_id}) "
            "SET s.ip = $ip, s.asn = $asn, s.country = $country, s.ssh_fingerprint = $ssh_fingerprint, s.http_banner = $http_banner, s.provenance = $provenance "
            "MERGE (c:Case {id: $case_id}) "
            "MERGE (s)-[:PART_OF]->(c)",
            server_id=server_id,
            ip=ip,
            asn=asn,
            country=country,
            ssh_fingerprint=ssh_fingerprint,
            http_banner=http_banner,
            provenance=provenance,
            case_id=case_id,
        )


def merge_tls_cert_node(
    cert_id, sha256, subject_cn, issuer, jarm, provenance, server_id, case_id
):
    _ensure_init()
    if _use_fallback:
        _nx_graph.add_node(
            cert_id,
            type="Certificate",
            label=f"TLS: {subject_cn}",
            sha256=sha256,
            subject_cn=subject_cn,
            issuer=issuer,
            jarm=jarm,
            provenance=provenance,
        )
        _nx_graph.add_edge(server_id, cert_id, label="SERVES_CERTIFICATE")
        _nx_graph.add_edge(cert_id, case_id, label="PART_OF")
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (t:Certificate {id: $cert_id}) "
            "SET t.sha256 = $sha256, t.subject_cn = $subject_cn, t.issuer = $issuer, t.jarm = $jarm, t.provenance = $provenance "
            "MERGE (s:Server {id: $server_id}) "
            "MERGE (c:Case {id: $case_id}) "
            "MERGE (s)-[:SERVES_CERTIFICATE]->(t) "
            "MERGE (t)-[:PART_OF]->(c)",
            cert_id=cert_id,
            sha256=sha256,
            subject_cn=subject_cn,
            issuer=issuer,
            jarm=jarm,
            provenance=provenance,
            server_id=server_id,
            case_id=case_id,
        )


def merge_service_node(
    service_id,
    onion_url,
    service_name,
    service_type,
    provenance,
    server_id,
    cert_id,
    case_id,
):
    _ensure_init()
    if _use_fallback:
        _nx_graph.add_node(
            service_id,
            type="HiddenService",
            label=f"{service_name}",
            onion_url=onion_url,
            service_name=service_name,
            service_type=service_type,
            provenance=provenance,
        )
        _nx_graph.add_edge(service_id, server_id, label="HOSTED_ON")
        _nx_graph.add_edge(service_id, case_id, label="PART_OF")
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (hs:HiddenService {id: $service_id}) "
            "SET hs.onion_url = $onion_url, hs.name = $service_name, hs.service_type = $service_type, hs.provenance = $provenance "
            "MERGE (s:Server {id: $server_id}) "
            "MERGE (c:Case {id: $case_id}) "
            "MERGE (hs)-[:HOSTED_ON]->(s) "
            "MERGE (hs)-[:PART_OF]->(c)",
            service_id=service_id,
            onion_url=onion_url,
            service_name=service_name,
            service_type=service_type,
            provenance=provenance,
            server_id=server_id,
            case_id=case_id,
        )


def merge_infrastructure_link(
    service_a_id, service_b_id, link_type, reason, provenance, case_id
):
    _ensure_init()
    if _use_fallback:
        _nx_graph.add_edge(
            service_a_id,
            service_b_id,
            label=link_type,
            reason=reason,
            provenance=provenance,
            case_id=case_id,
        )
        _save_fallback_graph()
        return
    with _driver.session() as session:
        session.run(
            "MERGE (a:HiddenService {id: $service_a_id}) "
            "MERGE (b:HiddenService {id: $service_b_id}) "
            "MERGE (a)-[r:CO_HOSTED_SERVER]->(b) "
            "SET r.reason = $reason, r.provenance = $provenance, r.case_id = $case_id",
            service_a_id=service_a_id,
            service_b_id=service_b_id,
            reason=reason,
            provenance=provenance,
            case_id=case_id,
        )


def get_case_graph(case_id):
    _ensure_init()
    nodes = []
    edges = []

    if _use_fallback:
        # Collect all node IDs that are part of this case
        case_node_ids = set()
        case_node_ids.add(case_id)
        for u, v, data in _nx_graph.edges(data=True):
            if data.get("label") == "PART_OF" and v == case_id:
                case_node_ids.add(u)
        # Also collect nodes connected to case nodes via any relationship
        extended_ids = set(case_node_ids)
        for u, v, data in _nx_graph.edges(data=True):
            if (
                u in case_node_ids
                or v in case_node_ids
                or data.get("case_id") == case_id
            ):
                extended_ids.add(u)
                extended_ids.add(v)

        for node_id, data in _nx_graph.nodes(data=True):
            if node_id in extended_ids:
                node_data = dict(data)
                if not node_data.get("type"):
                    node_data["type"] = "Case" if node_id == case_id else "Persona"
                if not node_data.get("label"):
                    node_data["label"] = (
                        node_data.get("canonical_handle")
                        or node_data.get("name")
                        or str(node_id)[:8]
                    )
                nodes.append({"data": {"id": node_id, **node_data}})
        for u, v, data in _nx_graph.edges(data=True):
            if u in extended_ids and v in extended_ids:
                label = data.get("label", "")
                # Skip zero-score or null correlation edges to prevent visual clutter
                if label == "CORRELATED_WITH" and float(data.get("score", 0)) <= 0.0:
                    continue
                edges.append(
                    {
                        "data": {
                            "id": f"{u}-{v}-{label}",
                            "source": u,
                            "target": v,
                            **data,
                        }
                    }
                )
    else:
        with _driver.session() as session:
            # Get all nodes connected to the case
            result = session.run(
                "MATCH (c:Case {id: $case_id})<-[:PART_OF*0..3]-(n) RETURN DISTINCT n",
                case_id=case_id,
            )
            for record in result:
                node = record["n"]
                props = dict(node)
                nodes.append(
                    {"data": {"id": props.get("id", str(node.element_id)), **props}}
                )

            # Get all edges between those nodes
            result = session.run(
                "MATCH (c:Case {id: $case_id})<-[:PART_OF*0..3]-(n) "
                "WITH collect(n) AS case_nodes "
                "UNWIND case_nodes AS a "
                "MATCH (a)-[r]->(b) WHERE b IN case_nodes "
                "RETURN id(r) as rid, type(r) as rtype, a, b",
                case_id=case_id,
            )
            for record in result:
                a_props = dict(record["a"])
                b_props = dict(record["b"])
                edges.append(
                    {
                        "data": {
                            "id": str(record["rid"]),
                            "source": a_props.get("id", ""),
                            "target": b_props.get("id", ""),
                            "label": record["rtype"],
                        }
                    }
                )
    return {"nodes": nodes, "edges": edges}
