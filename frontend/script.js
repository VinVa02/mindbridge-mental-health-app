const API_BASE = "http://127.0.0.1:8001";

const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const sessionList = document.getElementById("session-list");

const voiceChatBtn = document.getElementById("voice-chat-btn");
const recordingStatus = document.getElementById("recording-status");

const moodValue = document.getElementById("mood-value");
const riskValue = document.getElementById("risk-value");
const resourceList = document.getElementById("resource-list");

let activeSessionId = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function clearChatBox() {
  chatBox.innerHTML = "";
}

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

function normalizeType(type) {
  if (!type) return "Other";
  if (type === "helpline") return "Immediate Support";
  if (type === "support") return "Support Options";
  if (type === "article") return "Reading & Self-Help";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function groupResources(resources) {
  const grouped = {};

  resources.forEach((resource) => {
    const key = normalizeType(resource.type);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(resource);
  });

  return grouped;
}

function renderResourceGroups(resources = []) {
  resourceList.innerHTML = "";

  if (!resources || resources.length === 0) {
    resourceList.innerHTML = `
      <div class="empty-resource-state">
        Resources will appear based on the conversation.
      </div>
    `;
    return;
  }

  const grouped = groupResources(resources);
  const wrapper = document.createElement("div");
  wrapper.className = "resource-groups";

  Object.entries(grouped).forEach(([groupTitle, items]) => {
    const group = document.createElement("div");
    group.className = "resource-group";

    const title = document.createElement("div");
    title.className = "resource-group-title";
    title.textContent = groupTitle;

    group.appendChild(title);

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "resource-card";

      const link = document.createElement("a");
      link.className = "resource-link";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.title;

      const desc = document.createElement("div");
      desc.className = "resource-description";
      desc.textContent = item.description || "";

      card.appendChild(link);

      if (item.description) {
        card.appendChild(desc);
      }

      group.appendChild(card);
    });

    wrapper.appendChild(group);
  });

  resourceList.appendChild(wrapper);
}

function setMoodAndRisk(emotion = "Unknown", risk = "Low") {
  moodValue.textContent = emotion || "Unknown";
  riskValue.textContent = risk || "Low";
}

async function loadFallbackResources() {
  try {
    const response = await fetch(`${API_BASE}/api/resources`);
    if (!response.ok) throw new Error("Failed to load resources");

    const data = await response.json();
    renderResourceGroups(data.resources || []);
  } catch (error) {
    console.error("Failed to load fallback resources:", error);
    renderResourceGroups([]);
  }
}

async function loadSessions() {
  try {
    const response = await fetch(`${API_BASE}/api/chats`);
    if (!response.ok) {
      throw new Error("Failed to load chats");
    }

    const data = await response.json();
    sessionList.innerHTML = "";

    (data.chats || []).forEach((chat) => {
      const item = document.createElement("div");
      item.classList.add("session-item");

      if (chat.id === activeSessionId) {
        item.classList.add("active");
      }

      const previewText = (chat.user_message || "New Chat").length > 30
        ? `${chat.user_message.slice(0, 30)}...`
        : (chat.user_message || "New Chat");

      item.innerHTML = `
        <div class="session-main">
          <div class="session-title">${previewText}</div>
          <div class="session-meta">${chat.emotion || "unknown"} • ${chat.risk_level || "low"}</div>
        </div>
        <div class="session-actions">
          <button class="session-archive-btn" title="Archive">📦</button>
          <button class="session-delete-btn" title="Delete">🗑</button>
        </div>
      `;

      item.addEventListener("click", async () => {
        activeSessionId = chat.id;
        clearChatBox();
        addMessage(chat.user_message || "", "user");
        addMessage(chat.reply || "I’m here with you.", "bot");
        setMoodAndRisk(chat.emotion || "unknown", chat.risk_level || "low");
        renderResourceGroups(chat.resources || []);
        await loadSessions();
      });

      const archiveBtn = item.querySelector(".session-archive-btn");
      const deleteBtn = item.querySelector(".session-delete-btn");

      archiveBtn.addEventListener("click", async (event) => {
        event.stopPropagation();

        try {
          const response = await fetch(`${API_BASE}/api/chats/${chat.id}/archive`, {
            method: "PATCH"
          });

          if (!response.ok) {
            throw new Error("Failed to archive chat");
          }

          if (activeSessionId === chat.id) {
            activeSessionId = null;
            clearChatBox();
            addMessage("Hi, I’m here with you. How are you feeling today?", "bot");
            setMoodAndRisk("Unknown", "Low");
            renderResourceGroups([]);
          }

          await loadSessions();
        } catch (error) {
          console.error("Archive failed:", error);
        }
      });

      deleteBtn.addEventListener("click", async (event) => {
        event.stopPropagation();

        try {
          const response = await fetch(`${API_BASE}/api/chats/${chat.id}`, {
            method: "DELETE"
          });

          if (!response.ok) {
            throw new Error("Failed to delete chat");
          }

          if (activeSessionId === chat.id) {
            activeSessionId = null;
            clearChatBox();
            addMessage("Hi, I’m here with you. How are you feeling today?", "bot");
            setMoodAndRisk("Unknown", "Low");
            renderResourceGroups([]);
          }

          await loadSessions();
        } catch (error) {
          console.error("Delete failed:", error);
        }
      });

      sessionList.appendChild(item);
    });
  } catch (error) {
    console.error("Failed to load chats:", error);
    sessionList.innerHTML = "";
  }
}

async function sendChatMessage(message) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function sendAudioForStt(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");

  const response = await fetch(`${API_BASE}/api/stt`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`STT failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.transcript || "";
}

async function playTtsAudio(text) {
  const formData = new FormData();
  formData.append("text", text);

  const response = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS failed: ${response.status} ${errorText}`);
  }

  const audioBlob = await response.blob();

  if (!audioBlob || audioBlob.size === 0) {
    throw new Error("TTS returned empty audio");
  }

  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };

    audio.onerror = (event) => {
      URL.revokeObjectURL(audioUrl);
      reject(event);
    };

    audio.play().catch(reject);
  });
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  addMessage(message, "user");
  messageInput.value = "";
  recordingStatus.textContent = "Sending message...";

  try {
    const data = await sendChatMessage(message);

    activeSessionId = data.id;
    addMessage(data.reply || "I’m here with you.", "bot");
    setMoodAndRisk(data.emotion || "unknown", data.risk_level || "low");
    renderResourceGroups(data.resources || []);

    await loadSessions();
    recordingStatus.textContent = "Idle";
  } catch (error) {
    console.error("Chat error:", error);
    addMessage("Sorry, I couldn’t connect to the server.", "bot");
    recordingStatus.textContent = "Chat failed";
  }
}

async function handleVoiceChat(audioBlob) {
  try {
    recordingStatus.textContent = "Transcribing speech...";
    const transcript = await sendAudioForStt(audioBlob);

    if (!transcript.trim()) {
      throw new Error("No transcript received from STT");
    }

    addMessage(transcript, "user");
    recordingStatus.textContent = "Sending voice message...";

    const data = await sendChatMessage(transcript);

    activeSessionId = data.id;
    addMessage(data.reply || "I’m here with you.", "bot");
    setMoodAndRisk(data.emotion || "unknown", data.risk_level || "low");
    renderResourceGroups(data.resources || []);

    await loadSessions();

    recordingStatus.textContent = "Playing audio reply...";
    await playTtsAudio(data.reply || "I’m here with you.");

    messageInput.value = "";
    recordingStatus.textContent = "Idle";
  } catch (error) {
    console.error("Voice chat error:", error);
    addMessage("Sorry, voice chat failed.", "bot");
    recordingStatus.textContent = "Voice chat failed";
  }
}

async function startVoiceRecording() {
  if (isRecording) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    isRecording = true;
    voiceChatBtn.classList.add("recording");

    let mimeType = "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      mimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      stream.getTracks().forEach((track) => track.stop());
      isRecording = false;
      voiceChatBtn.classList.remove("recording");

      await handleVoiceChat(audioBlob);
    };

    mediaRecorder.start();
    recordingStatus.textContent = "Recording voice chat...";

    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, 5000);
  } catch (error) {
    console.error("Recording error:", error);
    isRecording = false;
    voiceChatBtn.classList.remove("recording");
    recordingStatus.textContent = "Microphone access failed";
  }
}

newChatBtn.addEventListener("click", async () => {
  activeSessionId = null;
  clearChatBox();
  addMessage("Hi, I’m here with you. How are you feeling today?", "bot");
  setMoodAndRisk("Unknown", "Low");
  renderResourceGroups([]);
  messageInput.value = "";
  await loadSessions();
});

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

voiceChatBtn.addEventListener("click", async () => {
  await startVoiceRecording();
});

async function initApp() {
  setMoodAndRisk("Unknown", "Low");
  await loadFallbackResources();
  await loadSessions();
}

initApp();