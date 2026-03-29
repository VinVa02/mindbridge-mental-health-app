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
const resourceGroups = document.getElementById("resource-groups");

let activeSessionId = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isSending = false;

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

function clearChatBox() {
  chatBox.innerHTML = "";
}

function addWelcomeState() {
  const welcome = document.createElement("div");
  welcome.className = "chat-welcome";
  welcome.innerHTML = `
    <div class="welcome-badge">MindBridge</div>
    <h2>How are you feeling today?</h2>
    <p>
      You can type or speak. I’ll listen, respond supportively,
      and suggest helpful resources when relevant.
    </p>
  `;
  chatBox.appendChild(welcome);
}

function addMessage(text, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);

  const bubbleDiv = document.createElement("div");
  bubbleDiv.classList.add("bubble");
  bubbleDiv.textContent = text;

  messageDiv.appendChild(bubbleDiv);
  chatBox.appendChild(messageDiv);
  scrollChatToBottom();
}

function addTypingMessage() {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", "bot");
  messageDiv.id = "typing-indicator";

  const bubbleDiv = document.createElement("div");
  bubbleDiv.classList.add("bubble");
  bubbleDiv.textContent = "MindBridge is responding...";

  messageDiv.appendChild(bubbleDiv);
  chatBox.appendChild(messageDiv);
  scrollChatToBottom();
}

function removeTypingMessage() {
  const typing = document.getElementById("typing-indicator");
  if (typing) typing.remove();
}

function renderMessages(messages) {
  clearChatBox();

  if (!messages || messages.length === 0) {
    addWelcomeState();
    addMessage("Hi, I’m here with you. How are you feeling today?", "bot");
    return;
  }

  messages.forEach((msg) => {
    addMessage(msg.text || "", msg.sender || "bot");
  });

  scrollChatToBottom();
}

function normalizeResources(resources) {
  if (!Array.isArray(resources)) return [];

  return resources.map((item) => ({
    id: item.id || "",
    title: item.title || "Untitled Resource",
    type: item.type || "resource",
    url: item.url || "",
    description: item.description || "",
    file_name: item.file_name || ""
  }));
}

function groupResourcesByType(resources) {
  const grouped = {};

  resources.forEach((item) => {
    const key = (item.type || "resource").toLowerCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  return Object.entries(grouped).map(([group, items]) => ({
    group,
    items
  }));
}

function formatGroupTitle(group) {
  if (!group) return "Resources";
  return group.charAt(0).toUpperCase() + group.slice(1);
}

function renderResourceGroups(resources) {
  resourceGroups.innerHTML = "";

  const normalized = normalizeResources(resources);

  if (normalized.length === 0) {
    resourceGroups.innerHTML = `
      <div class="empty-resource-state">
        Resources matched to the current conversation will appear here.
      </div>
    `;
    return;
  }

  const groups = groupResourcesByType(normalized);

  groups.forEach((group) => {
    const groupWrapper = document.createElement("div");
    groupWrapper.classList.add("resource-group");

    const title = document.createElement("div");
    title.classList.add("resource-group-title");
    title.textContent = formatGroupTitle(group.group);

    groupWrapper.appendChild(title);

    group.items.forEach((item) => {
      const card = document.createElement("div");
      card.classList.add("resource-card");

      const safeUrl = item.url && item.url.trim() ? item.url : "#";
      const metaLine = item.file_name
        ? `<div class="resource-description">${item.file_name}</div>`
        : "";
      const descriptionLine = item.description
        ? `<div class="resource-description">${item.description}</div>`
        : "";

      card.innerHTML = `
        <a class="resource-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">
          ${item.title}
        </a>
        ${metaLine}
        ${descriptionLine}
      `;

      groupWrapper.appendChild(card);
    });

    resourceGroups.appendChild(groupWrapper);
  });
}

function resetSidePanel() {
  moodValue.textContent = "Unknown";
  riskValue.textContent = "Low";
  renderResourceGroups([]);
}

function updateSidePanelFromResponse(data) {
  moodValue.textContent = data.emotion || "Unknown";
  riskValue.textContent = data.risk_level || "Low";
  renderResourceGroups(data.resources || []);
}

function updateUiBusyState(busy, statusText = "Idle") {
  isSending = busy;
  sendBtn.disabled = busy;
  voiceChatBtn.disabled = busy;
  messageInput.disabled = busy;
  recordingStatus.textContent = statusText;
  messageInput.placeholder = busy ? "Please wait..." : "Message MindBridge...";

  if (busy) {
    sendBtn.textContent = "Sending...";
  } else {
    sendBtn.textContent = "Send";
  }
}

async function loadSessions() {
  try {
    const response = await fetch(`${API_BASE}/api/chat-sessions`);

    if (!response.ok) {
      throw new Error(`Failed to load sessions: ${response.status}`);
    }

    const data = await response.json();
    const sessions = data.sessions || [];

    sessionList.innerHTML = "";

    if (sessions.length === 0) {
      sessionList.innerHTML = `
        <div class="empty-resource-state">
          No chats yet. Start a new conversation.
        </div>
      `;
      return;
    }

    sessions.forEach((session) => {
      const item = document.createElement("div");
      item.classList.add("session-item");

      if (session.id === activeSessionId) {
        item.classList.add("active");
      }

      item.innerHTML = `
        <div class="session-title">${session.title || "New Chat"}</div>
        <div class="session-meta">${session.message_count || 0} messages</div>
      `;

      item.addEventListener("click", async () => {
        activeSessionId = session.id;
        await loadSessionMessages(session.id);
        await loadSessions();
      });

      sessionList.appendChild(item);
    });
  } catch (error) {
    console.error("Failed to load sessions:", error);
    sessionList.innerHTML = `
      <div class="empty-resource-state">
        Unable to load chat history.
      </div>
    `;
  }
}

async function loadSessionMessages(sessionId) {
  try {
    const response = await fetch(`${API_BASE}/api/chat-sessions/${sessionId}`);

    if (!response.ok) {
      throw new Error(`Failed to load session: ${response.status}`);
    }

    const data = await response.json();
    const messages = data.messages || [];

    renderMessages(messages);

    const lastBotMessage = [...messages].reverse().find((msg) => msg.sender === "bot");

    if (lastBotMessage) {
      moodValue.textContent = lastBotMessage.emotion || "Unknown";
      riskValue.textContent = lastBotMessage.risk_level || "Low";
      renderResourceGroups(lastBotMessage.resources || []);
    } else {
      resetSidePanel();
    }
  } catch (error) {
    console.error("Failed to load session messages:", error);
    clearChatBox();
    addWelcomeState();
    addMessage("Sorry, I couldn’t load this conversation.", "bot");
    resetSidePanel();
  }
}

async function sendChatMessage(message) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      session_id: activeSessionId
    })
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
  audio.preload = "auto";

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error("Browser could not play the returned audio."));
    };

    audio.play().catch((err) => {
      URL.revokeObjectURL(audioUrl);
      reject(err);
    });
  });
}

async function sendMessage() {
  const message = messageInput.value.trim();

  if (!message || isSending) return;

  addMessage(message, "user");
  messageInput.value = "";
  autoResizeTextarea();

  updateUiBusyState(true, "Sending message...");
  addTypingMessage();

  try {
    const data = await sendChatMessage(message);

    removeTypingMessage();

    if (!activeSessionId) {
      activeSessionId = data.session_id;
    }

    addMessage(data.reply || "I’m here with you.", "bot");
    updateSidePanelFromResponse(data);

    await loadSessions();
  } catch (error) {
    console.error("Chat error:", error);
    removeTypingMessage();
    addMessage("Sorry, I couldn’t connect to the server.", "bot");
    recordingStatus.textContent = "Chat failed";
  } finally {
    updateUiBusyState(false, "Idle");
  }
}

async function handleVoiceChat(audioBlob) {
  if (isSending) return;

  try {
    updateUiBusyState(true, "Transcribing speech...");
    const transcript = await sendAudioForStt(audioBlob);

    if (!transcript.trim()) {
      throw new Error("No transcript received from STT");
    }

    addMessage(transcript, "user");

    updateUiBusyState(true, "Sending voice message...");
    addTypingMessage();

    const data = await sendChatMessage(transcript);

    removeTypingMessage();

    if (!activeSessionId) {
      activeSessionId = data.session_id;
    }

    addMessage(data.reply || "I’m here with you.", "bot");
    updateSidePanelFromResponse(data);
    await loadSessions();

    try {
      updateUiBusyState(true, "Playing audio reply...");
      await playTtsAudio(data.reply || "I’m here with you.");
    } catch (ttsError) {
      console.error("TTS playback error:", ttsError);
      addMessage("Your response was generated, but the audio reply could not play.", "bot");
    }

    messageInput.value = "";
    autoResizeTextarea();
  } catch (error) {
    console.error("Voice chat error:", error);
    removeTypingMessage();

    const errorMessage = error?.message || "";
    if (errorMessage.includes("STT failed")) {
      addMessage("Speech transcription failed on the server.", "bot");
    } else if (errorMessage.includes("No transcript received")) {
      addMessage("I could not hear enough speech to transcribe.", "bot");
    } else {
      addMessage("Sorry, voice chat failed.", "bot");
    }

    recordingStatus.textContent = "Voice chat failed";
  } finally {
    updateUiBusyState(false, "Idle");
  }
}

async function startVoiceRecording() {
  if (isRecording || isSending) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    isRecording = true;
    voiceChatBtn.classList.add("recording");
    recordingStatus.textContent = "Recording voice chat...";

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

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
      isRecording = false;
      voiceChatBtn.classList.remove("recording");
      recordingStatus.textContent = "Recording failed";
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      stream.getTracks().forEach((track) => track.stop());
      isRecording = false;
      voiceChatBtn.classList.remove("recording");

      await handleVoiceChat(audioBlob);
    };

    mediaRecorder.start();

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

async function initializeChatUi() {
  clearChatBox();
  addWelcomeState();
  addMessage("Hi, I’m here with you. How are you feeling today?", "bot");
  resetSidePanel();
  await loadSessions();
}

newChatBtn.addEventListener("click", async () => {
  activeSessionId = null;
  clearChatBox();
  addWelcomeState();
  addMessage("Hi, I’m here with you. How are you feeling today?", "bot");
  resetSidePanel();
  messageInput.value = "";
  autoResizeTextarea();
  recordingStatus.textContent = "Idle";
  await loadSessions();
});

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("input", autoResizeTextarea);

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

voiceChatBtn.addEventListener("click", async () => {
  await startVoiceRecording();
});

initializeChatUi();
autoResizeTextarea();