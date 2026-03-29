import re
from pathlib import Path
from typing import List
from pypdf import PdfReader
import pandas as pd


def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def load_pdf_text(file_path: str) -> str:
    reader = PdfReader(file_path)
    pages = []
    for page in reader.pages:
        extracted = page.extract_text() or ""
        extracted = clean_text(extracted)
        if extracted:
            pages.append(extracted)
    return "\n".join(pages)


def load_csv_text(file_path: str, max_rows: int = 500) -> str:
    df = pd.read_csv(file_path)
    rows = []

    # Keep it generic so it works even if columns differ
    usable_columns = [col for col in df.columns if df[col].dtype == "object"]

    for _, row in df.head(max_rows).iterrows():
        parts = []
        for col in usable_columns:
            value = str(row[col]).strip()
            if value and value.lower() != "nan":
                parts.append(f"{col}: {value}")
        if parts:
            rows.append(" | ".join(parts))

    return "\n".join(rows)


def load_document_text(file_path: str) -> str:
    suffix = Path(file_path).suffix.lower()

    if suffix == ".pdf":
        return load_pdf_text(file_path)
    elif suffix == ".csv":
        return load_csv_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 75) -> List[str]:
    words = text.split()
    chunks = []

    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunk = " ".join(chunk_words).strip()
        if chunk:
            chunks.append(chunk)
        start += max(chunk_size - overlap, 1)

    return chunks