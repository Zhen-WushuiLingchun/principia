# The Principia (Alpha) - Developer Documentation

This document is intended for developers who wish to understand the internal architecture of **The Principia**, contribute to its codebase, or extend its capabilities.

---

## 1. Architecture Overview

The Principia follows a **Hybrid Client-Server Architecture** designed to balance interactivity with powerful AI processing.

### High-Level Diagram

```mermaid
graph TD
    User[User / Browser] <--> |HTTP/WebSocket| Frontend[React + Vite App]
    Frontend <--> |REST API| Backend[Flask Proxy Server]
    Backend <--> |API Calls| Reasoner[Reasoning LLM (DeepSeek/o1)]
    Backend <--> |API Calls| VisionCoder[Vision/Coder LLM (Gemini/GPT-4o)]
    
    subgraph Browser
        Frontend
        LocalStorage[API Config Store]
        Canvas[WebGL/Three.js Renderer]
    end
    
    subgraph Server (Local/Cloud)
        Backend
    end
```

### 1.1 Frontend (The "Shell")
* **Tech Stack**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion.
* **Role**: Handles user input (text/handwriting), state management, and renders the simulation.
* **Key Components**:
    * `App.tsx`: Main state container (content, settings, mode).
    * `Editor.tsx`: Text input area.
    * `HandwritingCanvas.tsx`: `react-canvas-draw` wrapper for ink capture.
    * `Renderer.tsx`: Renders Markdown/LaTeX and manages the "Interactive Badges" (AI triggers).
    * `InteractiveBadge.tsx`: The UI component that triggers the AI analysis flow.
* **Simulation Runtime**: The frontend executes AI-generated JavaScript code in a sandboxed environment (using `new Function` or `iframe`), providing it with access to `Three.js` or HTML5 Canvas contexts.

### 1.2 Backend (The "Proxy")
* **Tech Stack**: Python, Flask, Flask-CORS.
* **Role**: Acts as a secure proxy and orchestrator for AI calls. It simplifies the frontend logic by encapsulating the prompt engineering and multi-model coordination.
* **Why a Backend?** * While frontend could call LLMs directly, a backend allows for better prompt management, potential caching, and easier switch between different model providers without updating the client code.
* **Key Endpoints**:
    * `/api/analyze`: The core "Dual-Brain" pipeline (Explanation + Visualization).
    * `/api/ocr`: Handles handwriting-to-LaTeX conversion.
    * `/api/convert`: Intelligent document format conversion (Markdown <-> LaTeX).

---

## 2. The "Dual-Brain" AI Pipeline

The core innovation of The Principia is splitting the cognitive load between two specialized model types. This logic resides mainly in `app.py`.

### Phase 1: The Physicist (Reasoning)
* **Input**: User's raw text/LaTeX context + Full document context.
* **Goal**: Understand the *physics principles*.
* **Prompt Strategy**: "You are an expert physics tutor... Analyze the concept... Provide a brief explanation... Detect language."
* **Model**: DeepSeek-V3, OpenAI o1 (High reasoning capability).

### Phase 2: The Engineer (Visualization)
* **Input**: The *Explanation* from Phase 1 + Original Context.
* **Goal**: Write *executable code*.
* **Prompt Strategy**: "You are an expert frontend developer... Create a dynamic simulation... Use `requestAnimationFrame`... Extract specific parameters (mass=5kg) from context."
* **Model**: Gemini 2.0 Flash, GPT-4o (High coding & multimodal capability).

---

## 3. Implementation Details

### 3.1 Handwriting Recognition (`/api/ocr`)
* Accepts a Base64 image.
* Sends it to a Vision model (Gemini/GPT-4o).
* **Note**: The backend prompt is tuned to generate **KaTeX** compatible syntax for fast frontend rendering, although the downloadable output is targeted to be valid **XeLaTeX**.
* Returns raw LaTeX code which is appended to the editor.

### 3.2 Dynamic Simulation Injection
* The backend returns a JSON object containing `visualization`: a raw HTML/JS string.
* The frontend (`InteractiveBadge.tsx`) injects this into an `iframe` or renders it directly.
* **Security Note**: Currently, the code runs with user privileges. For a production release, stricter sandboxing (e.g., WebWorkers or isolated iframes with CSP) is required.

### 3.3 Internationalization (i18n)
* We do not use standard i18n libraries (like `react-i18next`) for the *content*.
* Instead, we use **AI-Native i18n**: The AI detects the language of the user's notes and generates the simulation UI (labels, buttons) in the same language dynamically.

### 3.4 Intelligent Document Format Conversion (`/api/convert`)
* **Function**: Seamlessly switch between Markdown (Web/Note-taking standard) and LaTeX (Academic paper standard).
* **AI Refactoring**: Unlike simple regex replacement, we use LLMs (Reasoning Model) to understand the document's semantic structure.
    * **MD -> TEX**: AI automatically identifies Markdown hierarchy (`#`, `##`) and converts them to LaTeX section commands (`\section`, `\subsection`), and converts lists to `itemize`/`enumerate` environments, while preserving the integrity of mathematical formulas.
    * **TEX -> MD**: AI "downsamples" complex LaTeX packages and environments into clean Markdown syntax for easy reading on the Web or migration to Notion/Obsidian.
* **Context Awareness**: During conversion, AI intelligently handles format nesting to ensure the converted document is not only syntactically correct but also beautifully formatted.

---

## 4. Contributing Guide

If you want to extend The Principia, here is the recommended workflow:

### 4.1 Setup
1.  Follow the `BUILD_GUIDE.md` to set up the environment.
2.  Use VS Code with Prettier and ESLint extensions.

### 4.2 Key Areas for Improvement
* **Prompt Engineering**: Tweak the prompts in `app.py` to get better simulations. Try adding "Chain of Thought" or specific physics constraints.
* **Simulation Engine**: Currently, we rely on the AI to write raw WebGL/Canvas code. A better approach might be to build a high-level **"The Principia DSL"** (Domain Specific Language) or a library of pre-built React Physics Components (Spring, Particle, Field) that the AI simply *configures* rather than writing from scratch.
* **State Management**: Move from `useState` to `Zustand` or `Redux` if the app complexity grows (e.g., multi-tab simulations).

---

## 5. Future Outlook & Expansion

The Principia is currently a standalone web prototype, but the "Generative Engine" core has vast potential.

### 5.1 Obsidian/VS Code Plugin
* **Concept**: Bring The Principia directly into your note-taking app.
* **Implementation**: Port the React frontend to an Obsidian Plugin. Use the existing Python backend (or rewrite logic in JS/WASM) to process the active note.
* **Benefit**: "Live Physics Notes" - your equations come to life as you type them.

### 5.2 Native Tablet App (iPad/Android)
* **Concept**: A "Super Notebook" for students.
* **Implementation**: React Native or Flutter.
* **Feature**: Deep integration with Apple Pencil / S-Pen. Real-time handwriting analysis (no "Recognize" button needed, just continuous background processing).

### 5.3 "Principia Edu" Platform
* **Concept**: A teacher's tool.
* **Feature**: Teachers write a lesson plan in text, and The Principia generates a full slide deck with interactive, playable simulations embedded in every slide.

### 5.4 The "Physics Kernel" (WASM)
* **Optimization**: Instead of relying on Python for the "Proxy", we could move the prompt engineering logic entirely to the client side or compile a Rust-based physics engine to WebAssembly.
* **Goal**: Offline-first capability (using local LLMs like Llama 3 running in the browser via WebGPU).

---

## 6. API Reference

### POST `/api/analyze`
**Request:**
```json
{
  "context": "F=ma",
  "fullContext": "Newton's Second Law...",
  "reasoningConfig": { ... },
  "visionConfig": { ... }
}
```
**Response:**
```json
{
  "explanation": "Newton's second law states...",
  "visualization": "<div id='sim'>...</div><script>...</script>"
}
```

### POST `/api/convert`
**Request:**
```json
{
  "content": "# Title...",
  "targetFormat": "tex",
  "reasoningConfig": { ... }
}
```