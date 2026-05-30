import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import uuid
import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from rag_engine import answer_question

app = FastAPI(title="Chem-fig API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("temp_uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

_molscribe_model = None

def get_molscribe():
    global _molscribe_model
    if _molscribe_model is None:
        from chem_solver import load_molscribe
        _molscribe_model = load_molscribe()
    return _molscribe_model


@app.post("/ask")
async def ask(
    question: str = Form(default=""),
    image: Optional[UploadFile] = File(default=None)
):
    try:
        if image and image.filename:
            ext = Path(image.filename).suffix or ".png"
            temp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"

            with open(temp_path, "wb") as f:
                shutil.copyfileobj(image.file, f)

            try:
                from chem_solver import (
                    get_smiles,
                    extract_text_from_image,
                    parse_reagents,
                    analyze_smiles,
                    solve_with_llm
                )

                model = get_molscribe()
                smiles = get_smiles(model, str(temp_path))

                if not smiles:
                    return JSONResponse(content={
                        "answer": "Could not extract text from image. Please upload a clearer image.",
                        "molecules": []
                    })

                ocr_texts = extract_text_from_image(str(temp_path))
                reagents, labels, other = parse_reagents(ocr_texts)
                mol_info = analyze_smiles(smiles)

                # Pass user_question so solver knows what's being asked
                answer, molecules = solve_with_llm(
                    smiles, reagents, labels, mol_info,
                    str(temp_path),
                    user_question=question.strip()
                )

                return {"answer": answer, "molecules": molecules}

            finally:
                if temp_path.exists():
                    temp_path.unlink()

        elif question.strip():
            answer = answer_question(question.strip())
            return {"answer": answer, "molecules": []}

        else:
            return JSONResponse(status_code=400, content={
                "answer": "Please provide a question or image.",
                "molecules": []
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={
            "answer": f"Server error: {str(e)}\n\nMake sure Ollama is running: ollama serve",
            "molecules": []
        })


@app.get("/health")
def health():
    return {"status": "running", "model": "mistral"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("run:app", host="127.0.0.1", port=8000, reload=True)