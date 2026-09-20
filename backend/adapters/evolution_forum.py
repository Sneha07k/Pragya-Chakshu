import os
import csv
from backend.config import DATASET_BASE_PATH

_user_cache = None


def _load_user_cache():
    global _user_cache
    if _user_cache is not None:
        return
    _user_cache = {}
    filepath = os.path.join(DATASET_BASE_PATH, "forum", "user.tsv")
    if not os.path.exists(filepath):
        return
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            _user_cache[row.get("uid", "")] = row.get("username", "")


def get_username_by_uid(uid):
    _load_user_cache()
    return _user_cache.get(str(uid), f"Unknown_{uid}")


def stream_forum_posts(offset=0, limit=None):
    filepath = os.path.join(DATASET_BASE_PATH, "forum", "post.tsv")
    if not os.path.exists(filepath):
        return

    count = 0
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for i, row in enumerate(reader):
            if i < offset:
                continue
            if limit and count >= limit:
                break

            # Reconstruct time string to proper ISO format
            year = row.get("year", "")
            month = row.get("month", "").zfill(2)
            day = row.get("day", "").zfill(2)
            time = row.get("time", "")

            if year and month and day and time:
                row["iso_timestamp"] = f"{year}-{month}-{day}T{time}Z"
            else:
                row["iso_timestamp"] = "1970-01-01T00:00:00Z"

            yield row
            count += 1


def stream_forum_users(limit=None):
    filepath = os.path.join(DATASET_BASE_PATH, "forum", "user.tsv")
    if not os.path.exists(filepath):
        return

    count = 0
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            if limit and count >= limit:
                break
            yield row
            count += 1
