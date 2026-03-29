const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");

const recordSttBtn = document.getElementById("record-stt-btn");
const recordStsBtn = document.getElementById("record-sts-btn");
const recordingStatus = document.getElementById("recording-status");

const moodValue = document.getElementById("mood-value");
const riskValue = document.getElementById("risk-value");
const resourceList = document.getElementById("resource-list");

let mediaRecorder = null;
let audioChunks = [];
let currentMode = null;

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
      "If in danger, call emergency services or a crisis hotline"
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
      "Ground yourself using the 5-4-3-2-1 technique"
    ];
  } else if (emotion === "anger") {
    resources = [
      "Pause before reacting",
      "Take 5 slow breaths",
      "Step away for a short break"
    ];
  } else if (emotion === "stress") {
    resources = [
      "Break one task into smaller steps",
      "Drink water and stretch",
      "Write down the top 3 things on your mind"
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

async function sendChatMessage(message) {
  const response = await fetch("http://127.0.0.1:8001/api/chat", {
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

  addMessage(message, "user");
  messageInput.value = "";
  recordingStatus.textContent = "Sending message...";

  try {
    const data = await sendChatMessage(message);

    const reply = data.reply || "I’m here with you.";
    const emotion = data.emotion || "unknown";
    const riskLevel = data.risk_level || "low";

    addMessage(reply, "bot");
    moodValue.textContent = emotion;
    riskValue.textContent = riskLevel;
    updateResources(riskLevel, emotion);

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
    messageInput.value = transcript;

    recordingStatus.textContent = "Generating support reply...";
    const data = await sendChatMessage(transcript);

    const reply = data.reply || "I’m here with you.";
    const emotion = data.emotion || "unknown";
    const riskLevel = data.risk_level || "low";

    addMessage(reply, "bot");
    moodValue.textContent = emotion;
    riskValue.textContent = riskLevel;
    updateResources(riskLevel, emotion);

    recordingStatus.textContent = "Playing audio reply...";
    await playTtsAudio(reply);

    messageInput.value = "";
    recordingStatus.textContent = "Idle";
  } catch (error) {
    console.error("Voice chat error:", error);
    addMessage("Sorry, voice chat failed.", "bot");
    recordingStatus.textContent = "Voice chat failed";
  }
}

async function startRecording(mode) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    currentMode = mode;
    audioChunks = [];

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

      try {
        if (currentMode === "stt") {
          recordingStatus.textContent = "Sending audio to STT...";
          const transcript = await sendAudioForStt(audioBlob);
          messageInput.value = transcript;
          recordingStatus.textContent = transcript ? "Transcript ready" : "No speech detected";
        } else if (currentMode === "sts") {
          await handleVoiceChat(audioBlob);
        }
      } catch (error) {
        console.error(`${currentMode.toUpperCase()} error:`, error);
        recordingStatus.textContent = `${currentMode.toUpperCase()} failed`;
      }
    };

    mediaRecorder.start();
    recordingStatus.textContent = `Recording for ${mode.toUpperCase()}...`;

    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, 5000);
  } catch (error) {
    console.error("Recording error:", error);
    recordingStatus.textContent = "Microphone access failed";
  }
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

recordSttBtn.addEventListener("click", async () => {
  await startRecording("stt");
});

recordStsBtn.addEventListener("click", async () => {
  await startRecording("sts");
});

updateResources("low", "unknown");