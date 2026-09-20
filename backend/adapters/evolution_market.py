import os
import csv
from backend.config import DATASET_BASE_PATH

_scrape_date_cache = None


def _load_market_scrapes():
    global _scrape_date_cache
    if _scrape_date_cache is not None:
        return
    _scrape_date_cache = {}
    scrapes_path = os.path.join(DATASET_BASE_PATH, "market", "scrapes.tsv")
    if not os.path.exists(scrapes_path):
        return
    with open(scrapes_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            sid = row.get("mscrape_id")
            year = row.get("scrape_year", "")
            month = row.get("scrape_month", "").zfill(2)
            day = row.get("scrape_day", "").zfill(2)
            if year and month and day:
                _scrape_date_cache[sid] = f"{year}-{month}-{day}T00:00:00Z"


def get_scrape_timestamp(mscrape_id):
    _load_market_scrapes()
    return _scrape_date_cache.get(str(mscrape_id), "2014-01-21T00:00:00Z")


def stream_market_vendors(offset=0, limit=None):
    filepath = os.path.join(DATASET_BASE_PATH, "market", "vendors.tsv")
    if not os.path.exists(filepath):
        return

    _load_market_scrapes()
    count = 0
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for i, row in enumerate(reader):
            if i < offset:
                continue
            if limit and count >= limit:
                break

            sid = row.get("mscrape_id")
            row["iso_timestamp"] = get_scrape_timestamp(sid)
            yield row
            count += 1


def stream_market_listings(offset=0, limit=None):
    filepath = os.path.join(DATASET_BASE_PATH, "market", "listings.tsv")
    if not os.path.exists(filepath):
        return

    _load_market_scrapes()
    count = 0
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for i, row in enumerate(reader):
            if i < offset:
                continue
            if limit and count >= limit:
                break

            sid = row.get("mscrape_id")
            row["iso_timestamp"] = get_scrape_timestamp(sid)
            yield row
            count += 1
