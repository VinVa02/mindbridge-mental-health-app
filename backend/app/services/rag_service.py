from app.database import resource_chunk_collection
from app.services.embedding_service import embed_text


def retrieve_relevant_chunks(query: str, top_k: int = 4):
    query_vector = embed_text(query)

    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": 20,
                "limit": top_k
            }
        },
        {
            "$project": {
                "_id": 1,
                "resource_id": 1,
                "title": 1,
                "chunk_index": 1,
                "text": 1,
                "topic_tags": 1,
                "risk_tags": 1,
                "score": {"$meta": "vectorSearchScore"}
            }
        }
    ]

    results = list(resource_chunk_collection.aggregate(pipeline))
    return results