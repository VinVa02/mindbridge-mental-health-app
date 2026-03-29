from app.database import resource_collection


def get_matching_resources(emotion: str, risk_level: str, limit: int = 5):
    query = {
        "$or": [
            {"moods": emotion},
            {"risk_levels": risk_level}
        ]
    }

    resources = []
    for item in resource_collection.find(query).limit(limit):
        resources.append({
            "id": str(item["_id"]),
            "title": item["title"],
            "type": item["type"],
            "url": item["url"],
            "description": item.get("description", ""),
            "moods": item.get("moods", []),
            "risk_levels": item.get("risk_levels", [])
        })

    return resources