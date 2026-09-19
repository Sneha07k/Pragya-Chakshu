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

    print("2. Querying Evaluation Mode Benchmark (threshold = 40.0)...")
    bench_req = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/evaluation/benchmark?threshold=40.0")
    with urllib.request.urlopen(bench_req) as resp:
        data = json.loads(resp.read().decode())
        print("Evaluation benchmark response summary:")
        print(json.dumps(data["metrics"], indent=2))
        assert data.get("evaluation_mode") is True
        assert data.get("threshold") == 40.0
        assert "metrics" in data
        metrics = data["metrics"]
        assert "precision_percent" in metrics
        assert "recall_percent" in metrics
        assert "f1_score" in metrics
        assert "true_positives" in metrics
        assert "false_positives" in metrics
        assert "false_negatives" in metrics
        print(f"Metrics: Precision={metrics['precision_percent']}%, Recall={metrics['recall_percent']}%, F1={metrics['f1_score']}")

    print("3. Testing dynamic thresholding (threshold = 60.0)...")
    bench_req60 = urllib.request.Request(f"{BASE_URL}/cases/{case_id}/evaluation/benchmark?threshold=60.0")
    with urllib.request.urlopen(bench_req60) as resp:
        data60 = json.loads(resp.read().decode())
        m60 = data60["metrics"]
        print(f"Threshold 60.0: Precision={m60['precision_percent']}%, Recall={m60['recall_percent']}%, F1={m60['f1_score']}")
        assert data60.get("threshold") == 60.0

    print("Phase 8: Capability 2 Evaluation Mode Benchmark PASSED!")

if __name__ == "__main__":
    run_test()
