import os
import pickle
import numpy as np
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

BOOKS_FOLDER = "../books"
VECTOR_FOLDER = "../vector_store"
os.makedirs(VECTOR_FOLDER, exist_ok=True)

texts = []

def extract_text_from_pdf(path):
    reader = PdfReader(path)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"
    return full_text

for file in os.listdir(BOOKS_FOLDER):
    if file.endswith(".pdf"):
        print("Processing:", file)
        text = extract_text_from_pdf(os.path.join(BOOKS_FOLDER, file))

        # Chunk text
        chunks = [text[i:i+500] for i in range(0, len(text), 500)]
        texts.extend(chunks)

print("Creating embeddings...")
embeddings = model.encode(texts)

with open(f"{VECTOR_FOLDER}/ncert_vectors.pkl", "wb") as f:
    pickle.dump((texts, np.array(embeddings)), f)

print("Vector store created successfully.")