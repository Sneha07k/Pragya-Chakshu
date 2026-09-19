import json
import urllib.request

BASE_URL = "http://localhost:8000/api"

def run_test():
    print("1. Fetching cases...")
    req = urllib.request.Request(f"{BASE_URL}/cases")
    with urllib.request.urlopen(req) as resp:
        cases = json.loads(resp.read().decode())
        assert len(cases) > 0, "No cases found"
        case_id = cases[0]["case_id"]
    print(f"Using case_id: {case_id}")

    print("2. Running Coordinated Activity Discovery...")
    coord_req = urllib.request.Request(
        f"{BASE_URL}/cases/{case_id}/coordination/detect",
        data=json.dumps({"max_pairs": 30}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(coord_req) as resp:
        res = json.loads(resp.read().decode())
        print("Coordination response summary:")
        print(f"Pairs analyzed: {res.get('pairs_analyzed')}")
        print(f"Top pairs: {len(res.get('top_coordinated_pairs', []))}")
        print(f"Clusters: {len(res.get('coordination_clusters', []))}")
        assert res.get("provenance") == "DERIVED"
        assert "pairs_analyzed" in res
        assert "top_coordinated_pairs" in res

    print("3. Querying coordination clusters endpoint...")
    clusters_req = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/coordination/clusters")
    with urllib.request.urlopen(clusters_req) as resp:
        c_res = json.loads(resp.read().decode())
        assert c_res.get("provenance") == "DERIVED"
        assert "clusters" in c_res
        print(f"Clusters endpoint verified successfully. Found {len(c_res['clusters'])} clusters.")

    print("4. Verifying graph contains COORDINATED_WITH edges...")
    graph_req = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/graph")
    with urllib.request.urlopen(graph_req) as resp:
        g_res = json.loads(resp.read().decode())
        edges = g_res.get("edges", [])
        coord_edges = [e for e in edges if e["data"].get("label") == "COORDINATED_WITH"]
        print(f"Found {len(coord_edges)} COORDINATED_WITH edges in graph.")
        for ce in coord_edges[:5]:
            d = ce["data"]
            print(f" - {d.get('source')} -> {d.get('target')}: score={d.get('score')}%, weight={d.get('weight')}, latency={d.get('latency_sec')}s")
            assert d.get("provenance") == "DERIVED"

    print("Phase 7: Capability 3 Coordinated Activity Discovery PASSED!")

if __name__ == "__main__":
    run_test()
