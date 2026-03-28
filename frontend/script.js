const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const playAudioBtn = document.getElementById("play-audio-btn");

const moodValue = document.getElementById("mood-value");
const riskValue = document.getElementById("risk-value");
const resourceList = document.getElementById("resource-list");

let lastBotReply = "";

function addMessage(text, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);

  const bubbleDiv = document.createElement("div");
  bubbleDiv.classList.add("bubble");
  bubbleDiv.textContent = text;

  messageDiv.appendChild(bubbleDiv);
  chatBox.appendChild(messageDiv);

  chatBox.scrollTop = chatBox.scrollHeight;
}

function updateResources(riskLevel, emotion) {
  resourceList.innerHTML = "";

  let resources = [];

  if (riskLevel === "high") {
    resources = [
      "Reach out to a trusted friend or family member",
      "Contact a mental health professional immediately",
      "If in danger, call emergency services or crisis hotline"
    ];
  } else if (emotion === "sadness") {
    resources = [
      "Try journaling for 5 minutes",
      "Take a short walk outside",
      "Talk to someone you trust"
    ];
  } else if (emotion === "anxiety") {
    resources = [
      "Practice box breathing for 2 minutes",
      "Step away from screens briefly",
      "Ground yourself using 5-4-3-2-1 technique"
    ];
  } else if (emotion === "anger") {
    resources = [
      "Pause before reacting",
      "Take a few deep breaths",
      "Step away for a short break"
    ];
  } else if (emotion === "stress") {
    resources = [
      "Break one task into smaller steps",
      "Drink water and stretch for 2 minutes",
      "Write down the top 3 things on your mind"
    ];
  } else {
    resources = [
      "Take 3 slow deep breaths",
      "Drink water",
      "Write down one thing bothering you"
    ];
  }

  resources.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    resourceList.appendChild(li);
  });
}

async function sendMessage() {
  const message = messageInput.value.trim();

  if (!message) return;

  addMessage(message, "user");
  messageInput.value = "";

  try {
    const response = await fetch("http://127.0.0.1:8001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    const reply = data.reply || "I’m here with you.";
    const emotion = data.emotion || "unknown";
    const riskLevel = data.risk_level || "low";

    addMessage(reply, "bot");

    moodValue.textContent = emotion;
    riskValue.textContent = riskLevel;
    lastBotReply = reply;

    updateResources(riskLevel, emotion);
  } catch (error) {
    console.error("Error:", error);
    addMessage("Sorry, I couldn’t connect to the server.", "bot");
  }
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.addEventListener("click", () => {
    recognition.start();
  });

  recognition.onstart = () => {
    micBtn.textContent = "🎙️";
  };

  recognition.onend = () => {
    micBtn.textContent = "🎤";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value = transcript;
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
  };
} else {
  micBtn.disabled = true;
  micBtn.textContent = "❌";
}

playAudioBtn.addEventListener("click", () => {
  if (!lastBotReply) return;

  const utterance = new SpeechSynthesisUtterance(lastBotReply);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
});