import re
import math
from collections import Counter
import numpy as np

PUNCTUATION_MARKS = [',', '.', '!', '?', ';', ':', '-', '...']

def clean_text_for_stylometry(text):
    if not text:
        return ""
    # Strip HTML tags
    clean = re.sub(r'<[^>]+>', ' ', text)
    # Remove BBCode/quotes if any
    clean = re.sub(r'\[quote[^\]]*\].*?\[/quote\]', ' ', clean, flags=re.DOTALL | re.IGNORECASE)
    # Unescape HTML entities
    clean = clean.replace('&amp;', '&').replace('&#039;', "'").replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>')
    # Remove PGP signatures, keys, and headers while preserving the actual post message
    clean = re.sub(r'-----BEGIN PGP PUBLIC KEY BLOCK-----.*?-----END PGP PUBLIC KEY BLOCK-----', ' ', clean, flags=re.DOTALL)
    clean = re.sub(r'-----BEGIN PGP SIGNATURE-----.*?-----END PGP SIGNATURE-----', ' ', clean, flags=re.DOTALL)
    clean = re.sub(r'-----BEGIN PGP SIGNED MESSAGE-----', ' ', clean)
    clean = re.sub(r'Hash:\s*\w+', ' ', clean)
    clean = re.sub(r'Version:\s*GnuPG[^\n]*', ' ', clean)
    clean = re.sub(r'https?://\S+|ftp://\S+', ' ', clean)
    clean = re.sub(r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b', ' ', clean)
    clean = re.sub(r'[a-z2-7]{16,56}\.onion\b', ' ', clean)
    return clean.strip()

def split_into_sentences(text):
    if not text:
        return []
    # Split on sentence terminals
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if len(s.strip()) > 3]

def tokenize_words(text):
    if not text:
        return []
    return re.findall(r"\b[a-zA-Z']+\b", text.lower())

def calculate_yules_k(words):
    """
    Computes Yule's Characteristic Constant K:
    K = 10^4 * (sum(m^2 * V_m) - N) / (N^2)
    where V_m is the number of words occurring m times, and N is total words.
    Measures vocabulary richness independent of text length.
    """
    if not words or len(words) < 5:
        return 0.0
    N = len(words)
    freq = Counter(words)
    m_freq = Counter(freq.values())
    
    sum_m2_vm = sum((m ** 2) * count for m, count in m_freq.items())
    if N <= 1:
        return 0.0
    k = 10000.0 * (sum_m2_vm - N) / (N ** 2)
    return max(0.0, round(k, 2))

def compute_punctuation_vector(text, word_count):
    """
    Calculates normalized punctuation frequencies per 1,000 words.
    """
    if word_count == 0:
        return {p: 0.0 for p in PUNCTUATION_MARKS}
    scale = 1000.0 / word_count
    
    vec = {}
    # Check ellipses first
    ellipses_count = len(re.findall(r'\.{3,}', text))
    vec['...'] = round(ellipses_count * scale, 2)
    
    for p in [',', '.', '!', '?', ';', ':', '-']:
        count = text.count(p) - (ellipses_count * 3 if p == '.' else 0)
        vec[p] = round(max(0, count) * scale, 2)
    return vec

def compute_char_ngrams(text, n=4, top_k=50):
    """
    Extracts normalized character n-gram distribution.
    """
    clean = re.sub(r'\s+', ' ', text.lower())
    if len(clean) < n:
        return {}
    ngrams = [clean[i:i+n] for i in range(len(clean) - n + 1)]
    total = len(ngrams)
    if total == 0:
        return {}
    counts = Counter(ngrams)
    return {k: round(v / total, 5) for k, v in counts.most_common(top_k)}

def detect_language_profile(text):
    """
    Fast character and stopword based language verification.
    Evolution is >99.6% English. Returns 'en' or 'non-en'.
    """
    if not text:
        return "unknown"
    words = tokenize_words(text)
    if not words:
        return "unknown"
    common_english = {'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'}
    overlap = sum(1 for w in words if w in common_english)
    ratio = overlap / len(words)
    return "en" if ratio > 0.15 or len(words) < 10 else "non-en"

def extract_stylometric_profile(texts):
    """
    Extracts full stylometric profile from a collection of raw texts (posts) for a persona.
    """
    if isinstance(texts, str):
        texts = [texts]
        
    combined_raw = " ".join(texts)
    cleaned_texts = [clean_text_for_stylometry(t) for t in texts]
    cleaned_full = " ".join(t for t in cleaned_texts if t)
    
    sentences = []
    for t in cleaned_texts:
        sentences.extend(split_into_sentences(t))
        
    words = tokenize_words(cleaned_full)
    
    total_samples = len(texts)
    total_words = len(words)
    total_sentences = len(sentences)
    
    # Sentence length statistics
    if sentences:
        sent_lens = [len(tokenize_words(s)) for s in sentences]
        sent_lens = [l for l in sent_lens if l > 0]
        if sent_lens:
            avg_sent_len = round(float(np.mean(sent_lens)), 2)
            sent_len_var = round(float(np.var(sent_lens)), 2)
        else:
            avg_sent_len, sent_len_var = 0.0, 0.0
    else:
        avg_sent_len, sent_len_var = 0.0, 0.0
        
    # Word length statistics
    if words:
        word_lens = [len(w) for w in words]
        avg_word_len = round(float(np.mean(word_lens)), 2)
        ttr = round(len(set(words)) / len(words), 3)
    else:
        avg_word_len = 0.0
        ttr = 0.0
        
    yules_k = calculate_yules_k(words)
    punct_vec = compute_punctuation_vector(combined_raw, total_words)
    ngrams = compute_char_ngrams(cleaned_full, n=4, top_k=50)
    lang = detect_language_profile(cleaned_full)
    
    return {
        "provenance": "DERIVED",
        "sample_count": total_samples,
        "total_words": total_words,
        "total_sentences": total_sentences,
        "avg_sentence_len": avg_sent_len,
        "sentence_len_var": sent_len_var,
        "avg_word_len": avg_word_len,
        "type_token_ratio": ttr,
        "yules_k": yules_k,
        "language": lang,
        "punctuation_vector": punct_vec,
        "ngram_profile": ngrams
    }

def compare_stylometric_profiles(prof_a, prof_b):
    """
    Computes pairwise stylometric similarity between two profiles (0 to 100 scale).
    Uses cosine similarity of character n-grams and punctuation vectors,
    plus normalized variance delta.
    """
    # 1. Character N-Gram Cosine Similarity
    ngrams_a = prof_a.get("ngram_profile", {})
    ngrams_b = prof_b.get("ngram_profile", {})
    all_keys = set(ngrams_a.keys()).union(set(ngrams_b.keys()))
    
    if all_keys:
        vec_a = np.array([ngrams_a.get(k, 0.0) for k in all_keys])
        vec_b = np.array([ngrams_b.get(k, 0.0) for k in all_keys])
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a > 0 and norm_b > 0:
            ngram_sim = float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
        else:
            ngram_sim = 0.5
    else:
        ngram_sim = 0.5
        
    # 2. Punctuation Vector Cosine Similarity
    punct_a = prof_a.get("punctuation_vector", {})
    punct_b = prof_b.get("punctuation_vector", {})
    all_punct = set(punct_a.keys()).union(set(punct_b.keys()))
    if all_punct:
        pvec_a = np.array([punct_a.get(p, 0.0) for p in all_punct])
        pvec_b = np.array([punct_b.get(p, 0.0) for p in all_punct])
        pnorm_a = np.linalg.norm(pvec_a)
        pnorm_b = np.linalg.norm(pvec_b)
        if pnorm_a > 0 and pnorm_b > 0:
            punct_sim = float(np.dot(pvec_a, pvec_b) / (pnorm_a * pnorm_b))
        else:
            punct_sim = 0.5
    else:
        punct_sim = 0.5

    # 3. Yule's K relative difference
    yk_a = prof_a.get("yules_k", 0.0)
    yk_b = prof_b.get("yules_k", 0.0)
    max_yk = max(yk_a, yk_b, 1.0)
    yk_sim = 1.0 - min(1.0, abs(yk_a - yk_b) / max_yk)

    # 4. Average Sentence Length difference
    asl_a = prof_a.get("avg_sentence_len", 0.0)
    asl_b = prof_b.get("avg_sentence_len", 0.0)
    max_asl = max(asl_a, asl_b, 1.0)
    asl_sim = 1.0 - min(1.0, abs(asl_a - asl_b) / max_asl)
    
    # Combined weighted stylometric score (0 - 100)
    composite = (ngram_sim * 0.45) + (punct_sim * 0.25) + (yk_sim * 0.15) + (asl_sim * 0.15)
    score = round(max(0.0, min(100.0, composite * 100.0)), 1)
    
    return {
        "overall_stylometric_similarity": score,
        "signals": {
            "char_ngram_similarity": round(ngram_sim * 100, 1),
            "punctuation_similarity": round(punct_sim * 100, 1),
            "vocabulary_richness_alignment": round(yk_sim * 100, 1),
            "sentence_length_alignment": round(asl_sim * 100, 1)
        },
        "interpretation": "High Stylometric Concordance" if score >= 75 else ("Moderate Similarity" if score >= 50 else "Low Stylometric Concordance")
    }
