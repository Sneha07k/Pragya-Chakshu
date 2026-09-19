import os
import csv
from backend.config import DATASET_BASE_PATH
from backend.database.sqlite import get_connection

def stream_user_matches(limit=None):
    filepath = os.path.join(DATASET_BASE_PATH, 'forum-market', 'user-matching.tsv')
    if not os.path.exists(filepath):
        return
    
    count = 0
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            match_id = row.get('match_id')
            uid = row.get('uid')
            vid = row.get('vid')
            # Only yield rows that represent confirmed cross-platform matches
            if match_id and uid and vid and uid.isdigit() and vid.isdigit():
                if limit and count >= limit:
                    break
                yield {
                    'match_id': int(match_id),
                    'username': row.get('username', ''),
                    'uid': int(uid),
                    'vid': int(vid)
                }
                count += 1

def populate_ground_truth_table(limit=None):
    """
    Populates the SQLite ground_truth_matches table.
    Strictly designated as EVALUATION / REFERENCE DATA.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if already populated
    cursor.execute("SELECT COUNT(*) FROM ground_truth_matches")
    existing = cursor.fetchone()[0]
    if existing > 0:
        conn.close()
        return existing
    
    inserted = 0
    for match in stream_user_matches(limit=limit):
        cursor.execute("""
            INSERT INTO ground_truth_matches (match_id, username, uid, vid, used_in_evaluation)
            VALUES (?, ?, ?, ?, 0)
        """, (match['match_id'], match['username'], match['uid'], match['vid']))
        inserted += 1
    
    conn.commit()
    conn.close()
    return inserted
