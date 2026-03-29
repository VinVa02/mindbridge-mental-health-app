from pathlib import Path
from datetime import datetime, timezone

from app.database import resource_collection, resource_chunk_collection
from app.services.chunking_service import load_document_text, chunk_text
from app.services.embedding_service import embed_text

RAG_DIR = Path("rag_data")

FILE_METADATA = {
    "depression.pdf": {
        "title": "Depression",
        "publisher": "NIMH",
        "type": "pdf",
        "topic_tags": ["depression", "sadness", "low_mood"],
        "risk_tags": ["low", "medium", "high"]
    },
    "frequently-asked-questions-about-suicide.pdf": {
        "title": "Frequently Asked Questions About Suicide",
        "publisher": "NIMH",
        "type": "pdf",
        "topic_tags": ["suicide", "crisis", "warning_signs"],
        "risk_tags": ["medium", "high"]
    },
    "Im-So-Stressed-Out.pdf": {
        "title": "I'm So Stressed Out",
        "publisher": "NIMH",
        "type": "pdf",
        "topic_tags": ["stress", "anxiety", "coping"],
        "risk_tags": ["low", "medium"]
    },
    "post-traumatic-stress-disorder_1.pdf": {
        "title": "Post-Traumatic Stress Disorder",
        "publisher": "NIMH",
        "type": "pdf",
        "topic_tags": ["ptsd", "trauma", "anxiety"],
        "risk_tags": ["low", "medium", "high"]
    },
    "helping-children-and-adolescents-cope-with-traumatic-events.pdf": {
        "title": "Helping Children and Adolescents Cope With Traumatic Events",
        "publisher": "NIMH",
        "type": "pdf",
        "topic_tags": ["children", "adolescents", "trauma"],
        "risk_tags": ["low", "medium", "high"]
    },
    "5-action-steps-help-someone-having-thoughts-suicide.pdf": {
        "title": "5 Action Steps to Help Someone Having Thoughts of Suicide",
        "publisher": "NIMH",
        "type": "pdf",
        "topic_tags": ["suicide", "crisis", "support"],
        "risk_tags": ["high"]
    },
    "train.csv": {
        "title": "Mental Health Conversational Dataset",
        "publisher": "User Uploaded Dataset",
        "type": "csv",
        "topic_tags": ["conversation", "mental_health"],
        "risk_tags": ["low", "medium"]
    }
}


def infer_metadata(file_name: str) -> dict:
    default = {
        "title": file_name,
        "publisher": "Unknown",
        "type": "unknown",
        "topic_tags": ["general_mental_health"],
        "risk_tags": ["low", "medium"]
    }
    return FILE_METADATA.get(file_name, default)


def ingest_one_file(file_path: Path):
    file_name = file_path.name
    meta = infer_metadata(file_name)

    print(f"Ingesting: {file_name}")

    raw_text = load_document_text(str(file_path))
    if not raw_text.strip():
        print(f"Skipped empty file: {file_name}")
        return

    resource_doc = {
        "file_name": file_name,
        "title": meta["title"],
        "publisher": meta["publisher"],
        "type": meta["type"],
        "topic_tags": meta["topic_tags"],
        "risk_tags": meta["risk_tags"],
        "created_at": datetime.now(timezone.utc)
    }

    existing = resource_collection.find_one({"file_name": file_name})
    if existing:
        resource_id = existing["_id"]
        resource_chunk_collection.delete_many({"resource_id": resource_id})
        resource_collection.update_one(
            {"_id": resource_id},
            {"$set": resource_doc}
        )
    else:
        resource_id = resource_collection.insert_one(resource_doc).inserted_id

    chunks = chunk_text(raw_text, chunk_size=500, overlap=75)
    print(f"  Chunks created: {len(chunks)}")

    chunk_docs = []
    for idx, chunk in enumerate(chunks):
        embedding = embed_text(chunk)

        chunk_docs.append({
            "resource_id": resource_id,
            "file_name": file_name,
            "title": meta["title"],
            "publisher": meta["publisher"],
            "chunk_index": idx,
            "text": chunk,
            "topic_tags": meta["topic_tags"],
            "risk_tags": meta["risk_tags"],
            "embedding": embedding,
            "created_at": datetime.now(timezone.utc)
        })

    if chunk_docs:
        resource_chunk_collection.insert_many(chunk_docs)
        print(f"  Inserted chunk docs: {len(chunk_docs)}")


def run():
    if not RAG_DIR.exists():
        raise FileNotFoundError("rag_data folder not found")

    for file_path in RAG_DIR.iterdir():
        if file_path.is_file():
            ingest_one_file(file_path)

    print("Resource ingestion complete.")


if __name__ == "__main__":
    run()