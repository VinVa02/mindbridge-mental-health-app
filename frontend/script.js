const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");

const recordSttBtn = document.getElementById("record-stt-btn");
const playTtsBtn = document.getElementById("play-tts-btn");
const recordStsBtn = document.getElementById("record-sts-btn");
const recordingStatus = document.getElementById("recording-status");

const moodValue = document.getElementById("mood-value");
const riskValue = document.getElementById("risk-value");
const resourceList = document.getElementById("resource-list");

let lastBotReply = "";
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

    if (!response.ok) {
      throw new Error("Failed to send chat message");
    }

    const data = await response.json();

    const reply = data.reply || "I’m here with you.";
    const emotion = data.emotion || "unknown";
    const riskLevel = data.risk_level || "low";

    addMessage(reply, "bot");

    moodValue.textContent = emotion;
    riskValue.textContent = riskLevel;
    updateResources(riskLevel, emotion);

    lastBotReply = reply;
  } catch (error) {
    console.error("Chat error:", error);
    addMessage("Sorry, I couldn’t connect to the server.", "bot");
  }
}

async function requestTtsAndPlay(text) {
  if (!text) return;

  try {
    recordingStatus.textContent = "Generating TTS audio...";

    const response = await fetch("http://127.0.0.1:8001/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error("Failed to get TTS audio");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      recordingStatus.textContent = "Idle";
    };

    await audio.play();
  } catch (error) {
    console.error("TTS error:", error);
    recordingStatus.textContent = "TTS failed";
  }
}

async function sendAudioForStt(audioBlob) {
  try {
    recordingStatus.textContent = "Sending audio to STT...";

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    const response = await fetch("http://127.0.0.1:8001/api/stt", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error("Failed STT request");
    }

    const data = await response.json();
    const transcript = data.transcript || "";

    messageInput.value = transcript;
    recordingStatus.textContent = "Transcript ready";
  } catch (error) {
    console.error("STT error:", error);
    recordingStatus.textContent = "STT failed";
  }
}

async function sendAudioForSts(audioBlob) {
  try {
    recordingStatus.textContent = "Sending audio to speech-to-speech...";

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    const response = await fetch("http://127.0.0.1:8001/api/sts", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error("Failed STS request");
    }

    const convertedBlob = await response.blob();
    const audioUrl = URL.createObjectURL(convertedBlob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      recordingStatus.textContent = "Idle";
    };

    await audio.play();
  } catch (error) {
    console.error("STS error:", error);
    recordingStatus.textContent = "STS failed";
  }
}

async function startRecording(mode) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    currentMode = mode;
    audioChunks = [];

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      stream.getTracks().forEach((track) => track.stop());

      if (currentMode === "stt") {
        await sendAudioForStt(audioBlob);
      } else if (currentMode === "sts") {
        await sendAudioForSts(audioBlob);
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

playTtsBtn.addEventListener("click", async () => {
  await requestTtsAndPlay(lastBotReply);
});

recordSttBtn.addEventListener("click", async () => {
  await startRecording("stt");
});

recordStsBtn.addEventListener("click", async () => {
  await startRecording("sts");
});

updateResources("low", "unknown");