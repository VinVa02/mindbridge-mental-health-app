from app.database import resource_collection

resources = [
    {
        "title": "Caring for Your Mental Health",
        "type": "article",
        "url": "https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health",
        "description": "NIMH guidance on self-care, stress management, gratitude, sleep, and staying connected.",
        "moods": ["stress", "anxiety", "sadness", "distress", "unknown"],
        "risk_levels": ["low", "medium"]
    },
    {
        "title": "I'm So Stressed Out! Fact Sheet",
        "type": "article",
        "url": "https://www.nimh.nih.gov/health/publications/so-stressed-out-fact-sheet",
        "description": "NIMH fact sheet for stress, anxiety, and feeling overwhelmed.",
        "moods": ["stress", "anxiety"],
        "risk_levels": ["low", "medium"]
    },
    {
        "title": "Coping With Traumatic Events",
        "type": "article",
        "url": "https://www.nimh.nih.gov/health/topics/coping-with-traumatic-events",
        "description": "NIMH page on warning signs, coping, and finding help after trauma.",
        "moods": ["distress", "anxiety", "sadness", "loneliness"],
        "risk_levels": ["medium"]
    },
    {
        "title": "Find Support",
        "type": "support",
        "url": "https://www.samhsa.gov/find-support",
        "description": "SAMHSA resource hub for finding support with mental health, drugs, or alcohol.",
        "moods": ["stress", "anxiety", "sadness", "distress", "unknown"],
        "risk_levels": ["medium"]
    },
    {
        "title": "FindTreatment.gov",
        "type": "support",
        "url": "https://findtreatment.samhsa.gov/",
        "description": "Confidential treatment locator for mental health and substance use care in the U.S.",
        "moods": ["distress", "crisis", "sadness", "anxiety"],
        "risk_levels": ["medium", "high"]
    },
    {
        "title": "988 Suicide & Crisis Lifeline",
        "type": "helpline",
        "url": "https://988lifeline.org/",
        "description": "Call or text 988 for immediate emotional support and crisis counseling in the U.S.",
        "moods": ["crisis", "distress"],
        "risk_levels": ["high"]
    },
    {
        "title": "988 Lifeline Chat",
        "type": "helpline",
        "url": "https://chat.988lifeline.org/",
        "description": "Chat online with the 988 Suicide & Crisis Lifeline.",
        "moods": ["crisis", "distress"],
        "risk_levels": ["high"]
    },
    {
        "title": "SAMHSA National Helpline",
        "type": "helpline",
        "url": "https://www.samhsa.gov/find-help/helplines/national-helpline",
        "description": "24/7 treatment referral and information service. Call 1-800-662-HELP (4357).",
        "moods": ["distress", "crisis"],
        "risk_levels": ["high", "medium"]
    }
]


def seed():
    resource_collection.delete_many({})
    resource_collection.insert_many(resources)
    print(f"Inserted {len(resources)} resources into MongoDB.")


if __name__ == "__main__":
    seed()