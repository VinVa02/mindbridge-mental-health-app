# 🧠 MindBridge — AI Mental Wellness & Crisis Support App

![Python](https://img.shields.io/badge/Python-3.10-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![Gemini](https://img.shields.io/badge/Gemini-AI-orange)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)
![Status](https://img.shields.io/badge/Status-Hackathon%20Project-success)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

---

## 🚀 Overview

**MindBridge** is an AI-powered mental wellness assistant built during a hackathon to provide **real-time emotional support, risk detection, and personalized mental health resources**.

It combines **LLMs, RAG (Retrieval-Augmented Generation), and voice synthesis** to deliver empathetic, context-aware conversations.

---

## 🎯 Problem Statement

Mental health support is often:

- ❌ Not instantly accessible  
- ❌ Lacking personalization  
- ❌ Reactive instead of proactive  
- ❌ Difficult to seek due to stigma  

There is a need for a **safe, intelligent, and accessible digital support system**.

---

## 💡 Solution

MindBridge provides:

- 💬 AI-powered empathetic chat  
- 🧠 Emotion & risk-level detection  
- 📚 Context-aware knowledge (RAG)  
- 🔊 Voice-enabled responses  
- 🧭 Smart resource recommendations  

---

## ✨ Features

### 🧠 Emotion Detection
- Detects mood: `stress`, `anxiety`, `sadness`, `crisis`, etc.
- Assigns intensity (1–5)
- Identifies risk levels: `low`, `medium`, `high`

---

### 💬 AI Support Chat
- Human-like empathetic responses  
- Avoids generic or robotic replies  
- Context-aware conversations  

---

### 📚 RAG-Based Intelligence
- Uses:
  - NIMH datasets
  - Mental health Q&A
  - Curated resources  
- Provides grounded, relevant responses  

---

### 🧭 Resource Recommendation
- Suggests articles & coping strategies  
- Based on user mood + risk level  

---

### 🔊 Text-to-Speech
- Converts responses into natural audio  
- Enhances accessibility  

---

### 🎨 UI
- ChatGPT-style interface  
- Sidebar sessions  
- Clean and minimal design  

---

## 🏗️ Architecture

User (JS, HTML, CSS) 
    ↕ voice input/output 
ElevenLabs (STT + TTS) 
    ↕ text 
Gemini API (emotion understanding + empathetic response) 
    ↕ data 
MongoDB Atlas (sessions, mood trends, resources) 
    ↕ hosted on

    
MVP architecture 

**Frontend 

Simple web app  

Chat UI + microphone button  

Optional “Listen to response” button  

**Backend 

Python/FastAPI  

Endpoint for user message  

Endpoint for TTS audio  

Crisis keyword/risk logic  

MongoDB logging  

**AI 

Gemini API for emotion-aware text response  

ElevenLabs for calm voice output  

**Database 

MongoDB Atlas for:  

session id  

user mood label  

response type  

crisis flag  

recommended resources  
