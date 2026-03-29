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

function renderMessages(messages) {
  clearChatBox();

  if (!messages || messages.length === 0) {
    addMessage("Hi, I’m here with you. How are you feeling today?", "bot");
    return;
  }

  messages.forEach((msg) => {
    addMessage(msg.text, msg.sender);
  });
}

function renderResourceGroups(groups) {
  resourceGroups.innerHTML = "";

  if (!groups || groups.length === 0) {
    resourceGroups.innerHTML = `
      <div class="empty-resource-state">
        Resources matched to the current conversation will appear here.
      </div>
    `;
    return;
  }

  groups.forEach((group) => {
    const groupWrapper = document.createElement("div");
    groupWrapper.classList.add("resource-group");

    const title = document.createElement("div");
    title.classList.add("resource-group-title");
    title.textContent = group.group;

    groupWrapper.appendChild(title);

    group.items.forEach((item) => {
      const card = document.createElement("div");
      card.classList.add("resource-card");

      card.innerHTML = `
        <a class="resource-link" href="${item.url}" target="_blank" rel="noopener noreferrer">
          ${item.title}
        </a>
        <div class="resource-description">${item.description || ""}</div>
      `;

      groupWrapper.appendChild(card);
    });

    resourceGroups.appendChild(groupWrapper);
  });
}

async function loadSessions() {
  try {
    const response = await fetch("http://127.0.0.1:8001/api/chat-sessions");
    const data = await response.json();

    sessionList.innerHTML = "";

    (data.sessions || []).forEach((session) => {
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
  }
}

async function loadSessionMessages(sessionId) {
  try {
    const response = await fetch(`http://127.0.0.1:8001/api/chat-sessions/${sessionId}`);
    const data = await response.json();

    renderMessages(data.messages || []);

    const lastBotMessage = [...(data.messages || [])].reverse().find(
      (msg) => msg.sender === "bot"
    );

    if (lastBotMessage) {
      moodValue.textContent = lastBotMessage.emotion || "unknown";
      riskValue.textContent = lastBotMessage.risk_level || "low";
      renderResourceGroups(lastBotMessage.resources || []);
    } else {
      moodValue.textContent = "Unknown";
      riskValue.textContent = "Low";
      renderResourceGroups([]);
    }
  } catch (error) {
    console.error("Failed to load session messages:", error);
  }
}

async function sendChatMessage(message) {
  const response = await fetch("http://127.0.0.1:8001/api/chat", {
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

  const response = await fetch("http://127.0.0.1:8001/api/stt", {
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

  const response = await fetch("http://127.0.0.1:8001/api/tts", {
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

  recordingStatus.textContent = "Sending message...";

  try {
    const data = await sendChatMessage(message);

    if (!activeSessionId) {
      activeSessionId = data.session_id;
    }

    messageInput.value = "";
    await loadSessionMessages(activeSessionId);
    await loadSessions();

    moodValue.textContent = data.emotion || "unknown";
    riskValue.textContent = data.risk_level || "low";
    renderResourceGroups(data.resources || []);

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

    messageInput.value = transcript;
    recordingStatus.textContent = "Sending voice message...";
    const data = await sendChatMessage(transcript);

    if (!activeSessionId) {
      activeSessionId = data.session_id;
    }

    await loadSessionMessages(activeSessionId);
    await loadSessions();

    moodValue.textContent = data.emotion || "unknown";
    riskValue.textContent = data.risk_level || "low";
    renderResourceGroups(data.resources || []);

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
  moodValue.textContent = "Unknown";
  riskValue.textContent = "Low";
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

loadSessions();
renderResourceGroups([]);