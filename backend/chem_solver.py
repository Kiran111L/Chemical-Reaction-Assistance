"""
Chemical Reaction Image → Solver
Dynamically handles different question types
"""

import ssl
ssl._create_default_https_context = ssl._create_unverified_context

import re
import base64
import requests
from pathlib import Path
from io import BytesIO

# ── Cache EasyOCR ─────────────────────────────────────────────────────────────
_ocr_reader = None

def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        print("🔤 Loading EasyOCR (one time)...")
        _ocr_reader = easyocr.Reader(['en'], gpu=False)
        print("✅ EasyOCR ready")
    return _ocr_reader


def extract_text_from_image(image_path: str):
    print("🔤 Running OCR...")
    reader = get_ocr_reader()
    results = reader.readtext(image_path, detail=1)
    texts = [text.strip() for (_, text, conf) in results if conf > 0.2]
    print(f"✅ OCR found: {texts}")
    return texts


def parse_reagents(ocr_texts: list):
    common_reagents = [
        "NaBH4", "LiAlH4", "H2", "Pd", "HCl", "NaOH", "H2O",
        "KMnO4", "O3", "Br2", "HBr", "SOCl2", "PCC", "Jones",
        "CH3MgBr", "BH3", "mCPBA", "OsO4", "NBS", "DIBAL",
        "H2SO4", "HNO3", "AlCl3", "FeBr3", "Zn", "Fe", "Cu",
        "Na", "K", "NH3", "CH3OH", "ethanol", "acetone",
        "NO2", "NOz", "NO", "Cl", "Br", "OH", "COOH", "NH2",
        "CH3", "OCH3", "CN", "SO3H", "NaBH", "LiAIH", "LiAlH",
        "NaBH;", "LiAIH4", "NaBH4"
    ]
    found_reagents = []
    labels = []
    other = []
    for text in ocr_texts:
        clean = text.strip()
        if re.match(r'^\(?[A-Fa-f0-9]\)?\.?$', clean):
            labels.append(clean)
        elif any(r.lower() in clean.lower() for r in common_reagents):
            found_reagents.append(clean)
        else:
            other.append(clean)
    print(f"🧪 Reagents: {found_reagents}")
    print(f"🏷️  Labels: {labels}")
    return found_reagents, labels, other


# ── Draw molecule ─────────────────────────────────────────────────────────────
def smiles_to_image_b64(smiles: str, label: str = "", size=(300, 220)):
    try:
        from rdkit import Chem
        from rdkit.Chem import Draw
        mol = Chem.MolFromSmiles(smiles)
        if not mol:
            print(f"❌ Invalid SMILES: {smiles}")
            return None
        img = Draw.MolToImage(mol, size=size)
        buf = BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        print(f"✅ Drew: {smiles}")
        return {"smiles": smiles, "label": label, "image": f"data:image/png;base64,{b64}"}
    except Exception as e:
        print(f"Drawing error: {e}")
        return None


def extract_smiles_from_text(text: str):
    patterns = [
        r'SMILES[:\s]+([^\s\n`,;]{4,})',
        r'`([A-Za-z0-9@\[\]()=#\-+/\\\.%:]{5,})`',
    ]
    found = []
    for pattern in patterns:
        for m in re.findall(pattern, text):
            m = m.strip().rstrip('.,;)')
            if len(m) >= 4 and m not in found:
                found.append(m)
    return found


# ── Detect question type ──────────────────────────────────────────────────────
def detect_question_type(user_question: str, ocr_texts: list) -> str:
    q = user_question.lower()
    ocr_joined = " ".join(ocr_texts).lower()

    if any(w in q for w in ["iupac", "name", "identify", "what is", "what are"]):
        return "naming"
    elif any(w in q for w in ["complete", "reaction", "product", "predict", "give smiles"]):
        return "reaction"
    elif any(w in q for w in ["mechanism", "how does", "explain", "why"]):
        return "mechanism"
    elif any(w in q for w in ["difference", "compare", "which is"]):
        return "comparison"
    else:
        # Auto-detect from image content
        if any(w in ocr_joined for w in ["nabh", "lialh", "→", "->"]):
            return "reaction"
        return "general"


# ── Build smart prompt based on question type ─────────────────────────────────
def build_prompt(question_type: str, user_question: str, all_ocr: str,
                 reagents: list, labels: list) -> str:

    ocr_note = f'Text extracted from image via OCR: "{all_ocr}"'

    if question_type == "naming":
        return f"""You are an expert organic chemistry professor.

{ocr_note}

The student's question: "{user_question}"

The image contains chemical structures. Based on the OCR text and structures visible:
1. Identify each compound shown (i, ii, iii etc. or a, b, c)
2. Give the correct IUPAC name for each
3. Give the SMILES for each (format: SMILES: <smiles>)
4. Mention any functional groups present

Be accurate and concise."""

    elif question_type == "reaction":
        reagent_text = ", ".join(reagents) if reagents else "see image"
        label_text   = ", ".join(labels)   if labels   else "A, B"
        return f"""You are an expert organic chemistry professor.

{ocr_note}
Reagents on arrows: {reagent_text}
Product labels: {label_text}

The student's question: "{user_question}"

IMPORTANT: Reagents are on ARROWS — each reacts with the central drawn structure separately.
- NaBH4 = mild reducer (ketones/aldehydes → alcohols only)
- LiAlH4 = strong reducer (reduces esters, lactones, acids too)

Answer:
1. Starting material (name + SMILES: <smiles>)
2. Each product with mechanism (name + SMILES: <smiles>)
3. Key difference between products"""

    elif question_type == "mechanism":
        return f"""You are an expert organic chemistry professor.

{ocr_note}

The student's question: "{user_question}"

Explain the mechanism step by step:
1. Identify the reaction type
2. Show electron movement step by step
3. Identify intermediates
4. Give the final product with SMILES: <smiles>"""

    else:  # general / comparison
        return f"""You are an expert organic chemistry professor.

{ocr_note}

The student's question: "{user_question}"

Answer the question directly and accurately based on what's shown in the image.
If structures are involved, provide SMILES: <smiles> for each.
Be clear, concise and educational."""


# ── Stubs ─────────────────────────────────────────────────────────────────────
def analyze_smiles(smiles: str): return smiles
def load_molscribe(): return None

def get_smiles(model, image_path: str):
    texts = extract_text_from_image(image_path)
    return " | ".join(texts) if texts else ""


# ── Main solve function ───────────────────────────────────────────────────────
def solve_with_llm(smiles: str, reagents: list, labels: list,
                   mol_info: str, image_path: str, user_question: str = ""):

    print("🤖 Sending to Ollama/Mistral...")

    all_ocr = smiles
    ocr_texts = all_ocr.split(" | ")

    # Detect what the user is actually asking
    question_type = detect_question_type(user_question, ocr_texts)
    print(f"🎯 Question type detected: {question_type}")

    prompt = build_prompt(question_type, user_question, all_ocr, reagents, labels)

    molecule_images = []

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "mistral", "prompt": prompt, "stream": False},
            timeout=120
        )
        llm_answer = response.json().get("response", "No response from Ollama.")

        # Extract and draw SMILES from response
        smiles_list = extract_smiles_from_text(llm_answer)
        print(f"📝 SMILES found: {smiles_list}")

        drawn_labels = ["Compound 1", "Compound 2", "Compound 3", "Compound 4"]
        for i, s in enumerate(smiles_list[:4]):
            result = smiles_to_image_b64(s, drawn_labels[i] if i < len(drawn_labels) else f"Molecule {i+1}")
            if result:
                molecule_images.append(result)

        return llm_answer, molecule_images

    except Exception as e:
        return f"Ollama error: {e}\n\nMake sure Ollama is running: ollama serve", []