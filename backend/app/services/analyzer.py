def analyze_message(message: str):
    text = message.lower()

    if any(word in text for word in ["suicide", "kill myself", "end my life", "self-harm", "hurt myself"]):
        return {
            "emotion": "crisis",
            "risk_level": "high",
            "reply": "I'm really sorry you're feeling this way. You deserve immediate support. Please contact a trusted person, local emergency services, or a crisis helpline right now."
        }

    elif any(word in text for word in ["hopeless", "can't go on", "worthless", "empty", "alone"]):
        return {
            "emotion": "distress",
            "risk_level": "medium",
            "reply": "I'm sorry you're going through this. You are not alone. It may help to talk to someone you trust today."
        }

    elif any(word in text for word in ["stress", "stressed", "overwhelmed", "pressure"]):
        return {
            "emotion": "stress",
            "risk_level": "low",
            "reply": "It sounds like you're under a lot of pressure."
        }

    elif any(word in text for word in ["sad", "down", "upset", "crying", "depressed"]):
        return {
            "emotion": "sadness",
            "risk_level": "low",
            "reply": "I'm sorry you're feeling this way."
        }

    elif any(word in text for word in ["anxious", "anxiety", "nervous", "worried", "panic"]):
        return {
            "emotion": "anxiety",
            "risk_level": "low",
            "reply": "That sounds really difficult."
        }

    elif any(word in text for word in ["angry", "mad", "frustrated", "annoyed"]):
        return {
            "emotion": "anger",
            "risk_level": "low",
            "reply": "It sounds like something really frustrated you."
        }

    else:
        return {
            "emotion": "unknown",
            "risk_level": "low",
            "reply": "I'm here with you."
        }