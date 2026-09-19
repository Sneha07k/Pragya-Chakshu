import re
import uuid
import json

def strip_html(text):
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&amp;', '&').replace('&#039;', "'").replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>')
    return text.strip()

def extract_identifiers(text):
    if not text:
        return []
    identifiers = []
    
    # PGP blocks (Public keys & signed messages)
    pgp_matches = re.finditer(r'-----BEGIN PGP (?:PUBLIC KEY BLOCK|SIGNED MESSAGE)-----(.*?)-----END PGP (?:PUBLIC KEY BLOCK|SIGNATURE)-----', text, re.DOTALL)
    for m in pgp_matches:
        raw = m.group(0).strip()
        identifiers.append({
            'type': 'PGP_KEY',
            'raw_value': raw,
            'normalized_value': raw
        })
        
    # .onion URLs
    onion_matches = re.finditer(r'[a-z2-7]{16,56}\.onion', text, re.IGNORECASE)
    for m in onion_matches:
        identifiers.append({
            'type': 'ONION_URL',
            'raw_value': m.group(0),
            'normalized_value': m.group(0).lower()
        })
        
    # Bitcoin addresses (standard base58 check)
    btc_matches = re.finditer(r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b', text)
    for m in btc_matches:
        identifiers.append({
            'type': 'BTC_ADDRESS',
            'raw_value': m.group(0),
            'normalized_value': m.group(0)
        })
        
    # Email addresses
    email_matches = re.finditer(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
    for m in email_matches:
        identifiers.append({
            'type': 'EMAIL',
            'raw_value': m.group(0),
            'normalized_value': m.group(0).lower()
        })
        
    return identifiers

def normalize_post_event(post_dict, case_id, username):
    text = post_dict.get('text', '')
    clean_text = strip_html(text)
    identifiers = extract_identifiers(text)
    
    # Also check signature if available
    sig = post_dict.get('signature', '')
    if sig:
        identifiers.extend(extract_identifiers(sig))
    
    event_id = str(uuid.uuid4())
    
    payload = {
        'original_post': post_dict,
        'clean_text': clean_text,
        'identifiers': identifiers,
        'username': username
    }
    
    return {
        'event_id': event_id,
        'case_id': case_id,
        'event_type': 'post_observed',
        'timestamp_occurred': post_dict.get('iso_timestamp'),
        'provenance': 'RESEARCH',
        'source_dataset': 'Evolution_forum_post_tsv',
        'source_record_id': f"post:{post_dict.get('pid')}",
        'payload_json': json.dumps(payload)
    }

def normalize_vendor_event(vendor_dict, case_id):
    pgp_key = vendor_dict.get('pgp_key', '')
    identifiers = []
    if pgp_key and 'BEGIN PGP' in pgp_key:
        identifiers.append({
            'type': 'PGP_KEY',
            'raw_value': pgp_key.strip(),
            'normalized_value': pgp_key.strip()
        })
    
    rp = vendor_dict.get('return_policy', '')
    if rp:
        identifiers.extend(extract_identifiers(rp))
        
    event_id = str(uuid.uuid4())
    payload = {
        'vid': vendor_dict.get('vid'),
        'username': vendor_dict.get('username', ''),
        'rank': vendor_dict.get('rank', ''),
        'sales': vendor_dict.get('sales', ''),
        'approval_rating': vendor_dict.get('approval_rating', ''),
        'positive_feedback': vendor_dict.get('positive_feedback', ''),
        'neutral_feedback': vendor_dict.get('neutral_feedback', ''),
        'negative_feedback': vendor_dict.get('negative_feedback', ''),
        'identifiers': identifiers
    }
    
    return {
        'event_id': event_id,
        'case_id': case_id,
        'event_type': 'vendor_observed',
        'timestamp_occurred': vendor_dict.get('iso_timestamp'),
        'provenance': 'RESEARCH',
        'source_dataset': 'Evolution_market_vendors_tsv',
        'source_record_id': f"vendor:{vendor_dict.get('vid')}",
        'payload_json': json.dumps(payload)
    }

def normalize_listing_event(listing_dict, case_id):
    desc = listing_dict.get('description', '')
    clean_desc = strip_html(desc)
    identifiers = extract_identifiers(desc)
    
    event_id = str(uuid.uuid4())
    payload = {
        'lid': listing_dict.get('lid'),
        'vid': listing_dict.get('vid'),
        'title': listing_dict.get('title', ''),
        'price': listing_dict.get('price', ''),
        'clean_description': clean_desc,
        'cid': listing_dict.get('cid', ''),
        'ships_from': listing_dict.get('ships_from', ''),
        'ships_to': listing_dict.get('ships_to', ''),
        'product_class': listing_dict.get('product_class', ''),
        'identifiers': identifiers
    }
    
    return {
        'event_id': event_id,
        'case_id': case_id,
        'event_type': 'listing_observed',
        'timestamp_occurred': listing_dict.get('iso_timestamp'),
        'provenance': 'RESEARCH',
        'source_dataset': 'Evolution_market_listings_tsv',
        'source_record_id': f"listing:{listing_dict.get('lid')}",
        'payload_json': json.dumps(payload)
    }
