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

function getFallbackResources(riskLevel, emotion) {
  if (riskLevel === "high") {
    return [
      {
        title: "988 Suicide & Crisis Lifeline",
        type: "helpline",
        description: "Call or text 988 if you need immediate emotional support.",
        url: "https://988lifeline.org/"
      },
      {
        title: "SAMHSA National Helpline",
        type: "helpline",
        description: "Call 1-800-662-HELP (4357) for treatment referral and support.",
        url: "https://www.samhsa.gov/find-help/helplines/national-helpline"
      },
      {
        title: "Reach out to someone you trust",
        type: "support",
        description: "Contact a trusted friend, family member, counselor, or emergency services if you are in danger.",
        url: ""
      }
    ];
  }

  if (emotion === "sadness") {
    return [
      {
        title: "Try journaling for 5 minutes",
        type: "tip",
        description: "Writing down your thoughts can help you process what you’re feeling.",
        url: ""
      },
      {
        title: "Take a short walk outside",
        type: "tip",
        description: "A small physical reset can sometimes help lighten emotional heaviness.",
        url: ""
      },
      {
        title: "Talk to someone you trust",
        type: "support",
        description: "A short conversation with someone safe can help you feel less alone.",
        url: ""
      }
    ];
  }

  if (emotion === "anxiety") {
    return [
      {
        title: "Box breathing",
        type: "exercise",
        description: "Breathe in for 4, hold for 4, out for 4, hold for 4. Repeat slowly.",
        url: ""
      },
      {
        title: "Step away from screens briefly",
        type: "tip",
        description: "Take a short break to reduce overstimulation and reset.",
        url: ""
      },
      {
        title: "Use the 5-4-3-2-1 grounding technique",
        type: "exercise",
        description: "Notice 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.",
        url: ""
      }
    ];
  }

  if (emotion === "anger") {
    return [
      {
        title: "Pause before reacting",
        type: "tip",
        description: "A brief pause can help you respond more calmly.",
        url: ""
      },
      {
        title: "Take 5 slow breaths",
        type: "exercise",
        description: "Slowing your breathing may help reduce intensity in the moment.",
        url: ""
      },
      {
        title: "Step away for a short break",
        type: "tip",
        description: "Give yourself some space before continuing the situation.",
        url: ""
      }
    ];
  }

  if (emotion === "stress") {
    return [
      {
        title: "Break one task into smaller steps",
        type: "tip",
        description: "Smaller tasks feel more manageable than one large task.",
        url: ""
      },
      {
        title: "Drink water and stretch",
        type: "tip",
        description: "A quick body reset can help when stress builds up.",
        url: ""
      },
      {
        title: "Write down the top 3 things on your mind",
        type: "exercise",
        description: "This can help reduce mental overload and clarify priorities.",
        url: ""
      }
    ];
  }

  return [
    {
      title: "Take 3 slow deep breaths",
      type: "tip",
      description: "Pause for a moment and focus only on your breathing.",
      url: ""
    },
    {
      title: "Drink water",
      type: "tip",
      description: "Small physical resets can support emotional grounding.",
      url: ""
    },
    {
      title: "Write down one thing bothering you",
      type: "exercise",
      description: "Naming the thought can make it feel more manageable.",
      url: ""
    }
  ];
}

function renderResources(resources = []) {
  resourceList.innerHTML = "";

  if (!resources.length) {
    const emptyState = document.createElement("div");
    emptyState.classList.add("empty-resource");
    emptyState.textContent = "No resources available right now.";
    resourceList.appendChild(emptyState);
    return;
  }

  resources.forEach((resource) => {
    const item = document.createElement("div");
    item.classList.add("resource-item");

    const top = document.createElement("div");
    top.classList.add("resource-top");

    const badge = document.createElement("span");
    badge.classList.add("resource-type-badge");
    badge.textContent = resource.type || "resource";

    top.appendChild(badge);

    const title = document.createElement("h3");
    title.classList.add("resource-title");
    title.textContent = resource.title || "Helpful Resource";

    const description = document.createElement("p");
    description.classList.add("resource-description");
    description.textContent = resource.description || "Helpful support content.";

    item.appendChild(top);
    item.appendChild(title);
    item.appendChild(description);

    if (resource.url) {
      const link = document.createElement("a");
      link.classList.add("resource-link");
      link.href = resource.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open resource ↗";
      item.appendChild(link);
    }

    resourceList.appendChild(item);
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
    const resources = data.resources || getFallbackResources(riskLevel, emotion);

    addMessage(reply, "bot");
    moodValue.textContent = emotion;
    riskValue.textContent = riskLevel;
    renderResources(resources);

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
    const resources = data.resources || getFallbackResources(riskLevel, emotion);

    addMessage(reply, "bot");
    moodValue.textContent = emotion;
    riskValue.textContent = riskLevel;
    renderResources(resources);

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

renderResources(getFallbackResources("low", "unknown"));