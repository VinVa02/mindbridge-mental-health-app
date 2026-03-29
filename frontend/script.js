const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const playAudioBtn = document.getElementById("play-audio-btn");

const moodValue = document.getElementById("mood-value");
const riskValue = document.getElementById("risk-value");
const resourceList = document.getElementById("resource-list");

const historyList = document.getElementById("history-list");
const newChatBtn = document.getElementById("new-chat-btn");

let lastBotReply = "";
let currentChatMessages = [];
let chatHistory = [];

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

function clearChatBox() {
  chatBox.innerHTML = "";
}

function renderChat(messages) {
  clearChatBox();

  if (!messages || messages.length === 0) {
    addMessage("Hi, I’m here with you. How are you feeling today?", "bot");
    return;
  }

  messages.forEach((msg) => {
    addMessage(msg.text, msg.sender);
  });
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
  } else if (emotion === "sad") {
    resources = [
      "Try journaling for 5 minutes",
      "Take a short walk outside",
      "Talk to someone you trust"
    ];
  } else if (emotion === "anxiety") {
    resources = [
      "Practice box breathing for 2 minutes",
      "Step away from screens briefly",
      "Ground yourself using the 5-4-3-2-1 technique"
    ];
  } else {
    resources = [
      "Take 3 slow deep breaths",
      "Drink water",
      "Write down one thing bothering you"
    ];
  }

  resources.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    resourceList.appendChild(li);
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "Saved chat";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Saved chat";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function setActiveHistoryItem(activeIndex) {
  const items = document.querySelectorAll(".history-item");
  items.forEach((item, index) => {
    if (index === activeIndex) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

function renderHistoryList() {
  historyList.innerHTML = "";

  if (chatHistory.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.classList.add("history-empty");
    emptyDiv.textContent = "No saved chats yet.";
    historyList.appendChild(emptyDiv);
    return;
  }

  chatHistory.forEach((chat, index) => {
    const historyItem = document.createElement("div");
    historyItem.classList.add("history-item");

    const title = document.createElement("div");
    title.classList.add("history-title");
    title.textContent = chat.title;

    const subtitle = document.createElement("div");
    subtitle.classList.add("history-subtitle");
    subtitle.textContent = `${chat.emotion || "unknown"} • ${formatTimestamp(chat.timestamp)}`;

    historyItem.appendChild(title);
    historyItem.appendChild(subtitle);

    historyItem.addEventListener("click", () => {
      currentChatMessages = chat.messages;
      renderChat(currentChatMessages);

      moodValue.textContent = chat.emotion || "Unknown";
      riskValue.textContent = chat.risk_level || "Low";
      updateResources(chat.risk_level || "low", chat.emotion || "unknown");

      lastBotReply = chat.reply || "";
      setActiveHistoryItem(index);
    });

    historyList.appendChild(historyItem);
  });
}

async function loadHistory() {
  try {
    const response = await fetch("http://127.0.0.1:8001/api/chats");

    if (!response.ok) {
      throw new Error("Failed to fetch chat history");
    }

    const data = await response.json();
    const chats = data.chats || [];

    chatHistory = chats.map((item) => ({
      id: item.id,
      title: item.user_message
        ? `${item.user_message.slice(0, 25)}${item.user_message.length > 25 ? "..." : ""}`
        : "Previous chat",
      messages: [
        { sender: "user", text: item.user_message || "" },
        { sender: "bot", text: item.reply || "" }
      ],
      emotion: item.emotion || "unknown",
      risk_level: item.risk_level || "low",
      reply: item.reply || "",
      timestamp: item.timestamp || ""
    }));

    renderHistoryList();
  } catch (error) {
    console.error("Error loading history:", error);

    historyList.innerHTML = "";
    const errorDiv = document.createElement("div");
    errorDiv.classList.add("history-empty");
    errorDiv.textContent = "Could not load chat history.";
    historyList.appendChild(errorDiv);
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();

  if (!message) return;

  addMessage(message, "user");
  currentChatMessages.push({ sender: "user", text: message });
  messageInput.value = "";

  try {
    const response = await fetch("http://127.0.0.1:8001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    const data = await response.json();

    const reply = data.reply || "I’m here with you.";
    const emotion = data.emotion || "unknown";
    const riskLevel = data.risk_level || "low";

    addMessage(reply, "bot");
    currentChatMessages.push({ sender: "bot", text: reply });

    moodValue.textContent = emotion;
    riskValue.textContent = riskLevel;
    updateResources(riskLevel, emotion);
    lastBotReply = reply;

    await loadHistory();
  } catch (error) {
    console.error("Error:", error);
    addMessage("Sorry, I couldn’t connect to the server.", "bot");
  }
}

function startNewChat() {
  currentChatMessages = [];
  clearChatBox();
  addMessage("Hi, I’m here with you. How are you feeling today?", "bot");

  moodValue.textContent = "Unknown";
  riskValue.textContent = "Low";
  updateResources("low", "unknown");
  lastBotReply = "";
  setActiveHistoryItem(-1);
}

newChatBtn.addEventListener("click", startNewChat);

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

updateResources("low", "unknown");
loadHistory();