"""
RAG Engine — NCERT Chemistry Q&A
Uses numpy cosine similarity instead of faiss (works on M1 Mac)
"""

import pickle
import numpy as np
import requests
from sentence_transformers import SentenceTransformer

# ── Load embedding model ──────────────────────────────────────────────────────
print("📚 Loading RAG engine...")
embed_model = SentenceTransformer("all-MiniLM-L6-v2")

# ── Load vector store ─────────────────────────────────────────────────────────
try:
    with open("../vector_store/ncert_vectors.pkl", "rb") as f:
        texts, embeddings = pickle.load(f)
    embeddings = np.array(embeddings)
    print(f"✅ Vector store loaded: {len(texts)} chunks")
except FileNotFoundError:
    print("⚠️  Vector store not found. Run build_vector_store.py first.")
    texts, embeddings = [], np.array([])


# ── Cosine similarity search (replaces faiss) ─────────────────────────────────
def cosine_similarity(a, b):
    a = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-9)
    b = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-9)
    return np.dot(a, b.T)


def retrieve_context(question: str, k: int = 4) -> str:
    if len(texts) == 0:
        return "No context available. Please build the vector store first."

    q_embed = embed_model.encode([question])
    sims = cosine_similarity(q_embed, embeddings)[0]
    top_k = np.argsort(sims)[::-1][:k]
    chunks = [texts[i] for i in top_k]
    return "\n\n".join(chunks)


# ── Call Ollama ───────────────────────────────────────────────────────────────
def ask_ollama(prompt: str) -> str:
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "mistral",   # unified model across whole project
                "prompt": prompt,
                "stream": False
            },
            timeout=120
        )
        return response.json().get("response", "No response from Ollama.")
    except Exception as e:
        return f"❌ Ollama error: {e}\n\nMake sure Ollama is running:\n  ollama serve"


# ── Main answer function ──────────────────────────────────────────────────────
def answer_question(question: str) -> str:
    context = retrieve_context(question)

    prompt = f"""You are an expert chemistry teacher with deep knowledge of NCERT chemistry.

Use the context below to answer the question. If the context is not enough, use your chemistry knowledge.
Always give a clear, structured answer with steps where needed.

NCERT Context:
{context}

Question:
{question}

Answer (be clear and educational):"""

    return ask_ollama(prompt)
