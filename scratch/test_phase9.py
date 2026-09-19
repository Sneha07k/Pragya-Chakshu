import json
import urllib.request

BASE_URL = "http://localhost:8000/api"


def run_test():
    print("1. Fetching active case...")
    req = urllib.request.Request(f"{BASE_URL}/cases")
    with urllib.request.urlopen(req) as resp:
        cases = json.loads(resp.read().decode())
        assert len(cases) > 0, "No cases found"
        case_id = cases[0]["case_id"]
    print(f"Using case_id: {case_id}")

    print("2. Testing JSON Dossier Export...")
    json_req = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/export/json")
    with urllib.request.urlopen(json_req) as resp:
        dossier = json.loads(resp.read().decode())
        print(f"Dossier ID: {dossier.get('dossier_id')}")
        print(f"SHA-256 Seal: {dossier.get('cryptographic_hash_sha256')}")
        assert "dossier_id" in dossier
        assert "cryptographic_hash_sha256" in dossier
        assert len(dossier["cryptographic_hash_sha256"]) == 64
        assert "provenance_summary" in dossier
        prov = dossier["provenance_summary"]
        print(
            f"Provenance Breakdown: RESEARCH={prov.get('RESEARCH')}, DERIVED={prov.get('DERIVED')}, SYNTHETIC={prov.get('SYNTHETIC')}"
        )
        assert "RESEARCH" in prov
        assert "DERIVED" in prov
        assert "SYNTHETIC" in prov
        assert "personas" in dossier
        assert "evidence_inventory" in dossier

    print("3. Testing Printable HTML Dossier Export...")
    html_req = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/export/dossier")
    with urllib.request.urlopen(html_req) as resp:
        html_content = resp.read().decode()
        assert "PRAGYA CHAKSHU — CASE DOSSIER" in html_content
        assert "SHA-256 Digital Fingerprint:" in html_content
        assert "badge-research" in html_content
        assert "badge-synthetic" in html_content
        print(f"Printable HTML Dossier verified ({len(html_content)} bytes).")

    print("Phase 9: Forensic Case Dossier & Export Reporting PASSED!")


if __name__ == "__main__":
    run_test()
