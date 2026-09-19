import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000/api"

def run_test():
    print("1. Listing cases...")
    req = urllib.request.Request(f"{BASE_URL}/cases")
    with urllib.request.urlopen(req) as resp:
        cases = json.loads(resp.read().decode())
        print(f"Found {len(cases)} cases.")
        if not cases:
            print("Creating test case...")
            create_req = urllib.request.Request(
                f"{BASE_URL}/cases",
                data=json.dumps({"name": "Test Case Phase 6", "description": "Phase 6 verification"}).encode(),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(create_req) as c_resp:
                case = json.loads(c_resp.read().decode())
                case_id = case["case_id"]
        else:
            case_id = cases[0]["case_id"]
    
    print(f"Using case_id: {case_id}")

    print("2. Generating synthetic infrastructure cluster...")
    gen_req = urllib.request.Request(
        f"{BASE_URL}/cases/{case_id}/synthetic/generate",
        data=json.dumps({"cluster_name": "Darknet Operations Pool A", "seed": 42}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(gen_req) as resp:
        gen_data = json.loads(resp.read().decode())
        print("Generated cluster response:")
        print(json.dumps(gen_data, indent=2))
        assert gen_data["status"] == "success"
        assert gen_data["provenance"] == "SYNTHETIC"
        assert "server" in gen_data
        assert "tls_certificate" in gen_data
        assert len(gen_data["co_hosted_services"]) > 0

    print("3. Querying synthetic clusters...")
    clusters_req = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/synthetic/clusters")
    with urllib.request.urlopen(clusters_req) as resp:
        clusters_data = json.loads(resp.read().decode())
        clusters = clusters_data.get("clusters", [])
        print(f"Found {len(clusters)} clusters.")
        assert len(clusters) >= 1

    print("4. Verifying graph contains synthetic nodes and edges...")
    graph_req = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/graph")
    with urllib.request.urlopen(graph_req) as resp:
        graph_data = json.loads(resp.read().decode())
        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])
        
        server_nodes = [n for n in nodes if n["data"].get("type") == "Server"]
        cert_nodes = [n for n in nodes if n["data"].get("type") == "Certificate"]
        service_nodes = [n for n in nodes if n["data"].get("type") == "HiddenService"]
        cohosted_edges = [e for e in edges if e["data"].get("label") == "CO_HOSTED_SERVER"]
        
        print(f"Graph verification: Servers={len(server_nodes)}, Certs={len(cert_nodes)}, Services={len(service_nodes)}, CoHosted Edges={len(cohosted_edges)}")
        
        for n in server_nodes + cert_nodes + service_nodes:
            assert n["data"].get("provenance") == "SYNTHETIC", f"Node {n['data']['id']} missing SYNTHETIC provenance!"
            
        for e in cohosted_edges:
            assert e["data"].get("provenance") == "SYNTHETIC", f"Edge {e['data']['id']} missing SYNTHETIC provenance!"
            
        print("All provenance and graph assertions PASSED!")

if __name__ == "__main__":
    run_test()
