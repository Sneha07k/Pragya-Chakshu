import json
import urllib.request

BASE_URL = "http://localhost:8000/api"


def run():
    req = urllib.request.Request(f"{BASE_URL}/cases")
    with urllib.request.urlopen(req) as resp:
        cases = json.loads(resp.read().decode())
        case_id = cases[0]["case_id"]

    print("1. Ingesting market vendors...")
    ingest_req = urllib.request.Request(
        f"{BASE_URL}/cases/{case_id}/ingest",
        data=json.dumps({"limit": 20, "source": "vendors"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(ingest_req) as resp:
        v_res = json.loads(resp.read().decode())
        print(f"Ingested {v_res.get('events_ingested', 0)} vendor events.")

    print("2. Running multi-factor correlation engine...")
    corr_req = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/correlations")
    with urllib.request.urlopen(corr_req) as resp:
        corrs = json.loads(resp.read().decode())
        print(f"Found {len(corrs)} correlated relationships.")

    print("3. Querying Evaluation Mode Benchmark...")
    bench_req = urllib.request.Request(
        f"{BASE_URL}/cases/{case_id}/evaluation/benchmark?threshold=30.0"
    )
    with urllib.request.urlopen(bench_req) as resp:
        b_data = json.loads(resp.read().decode())
        m = b_data["metrics"]
        print("Updated Evaluation Metrics:")
        print(f" - True Positives:  {m['true_positives']}")
        print(f" - False Positives: {m['false_positives']}")
        print(f" - False Negatives: {m['false_negatives']}")
        print(f" - Total Case GT:   {m['total_case_ground_truth']}")
        print(f" - Precision:       {m['precision_percent']}%")
        print(f" - Recall:          {m['recall_percent']}%")
        print(f" - F1 Score:        {m['f1_score']}")
        assert "precision_percent" in m

    print("Evaluation benchmark roundtrip verified successfully!")


if __name__ == "__main__":
    run()
