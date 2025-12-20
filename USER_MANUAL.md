# The Principia (Alpha) - User Manual & Feature Guide

**The Principia** is a next-generation "Generative Physics Engine". Unlike traditional tools where you manually place objects, here you **describe** a phenomenon (in text or handwriting), and the AI **generates** an interactive simulation for you.

---

## Core Philosophy

> "Don't build the simulation. Describe the universe, and let the engine build it."
> *(Note: The AI said this, feels kinda reasonable?)*

The Principia combines **Reasoning Models** (to understand physics laws) with **Multimodal Models** (to generate code and recognize handwriting) to create a seamless "Idea-to-Simulation" workflow. *(Note: It's actually just a convenient note-taking project, but it really is quite convenient.)*

---

## Features & How to Use

### 1. The "Magic" Editor (Text Input)
On the left side of the screen is your primary workspace.
* **What to do**: Type any physics concept, problem, or scenario.
* **Examples**:
    * "A double pendulum with chaotic motion."
    * "Projectile motion of a ball thrown at 45 degrees."
    * "Lorentz attractor."
    * "A mass-spring damper system."
* **Markdown Support**: You can use Markdown headers, lists, and bold text to organize your notes.
* **LaTeX Support**: Write math formulas using `$ E=mc^2 $` (inline) or `$$F=ma$$` (block).

### 2. AI Handwriting Recognition
Switch to **Handwriting Mode** using the pen icon in the toolbar.
* **Canvas**: A drawing area appears on the left.
* **Write**: Use your mouse, stylus, or touch to write physics notes or formulas.
* **Recognize**: Click the "Recognize" button (Magic Wand). The AI will convert your handwriting into clean LaTeX/Markdown text and append it to the editor.

### 3. Generative Simulation (The "Play" Button)
This is the core feature.
* **Trigger**: Click the **Interactive Badge** (a small pulsing dot) that appears next to recognized formulas, OR simply describe a scene in the text.
* **Process**:
    1.  **Analysis**: The Reasoning AI explains the physics principles.
    2.  **Coding**: The Vision/Coding AI writes a custom JavaScript/Three.js simulation program in real-time.
    3.  **Execution**: The code is safely executed in the browser, rendering a 3D or 2D visualization on the right panel.
* **Interactivity**: The generated simulations often include **sliders** (GUI) to change parameters like mass, gravity, or velocity instantly.

### 4. Smart Export
You can export your work for academic or documentation purposes.
* **Formats**: 
    * **TEX**: Professional LaTeX format for papers.
    * **MD**: Markdown format for web/notes.
* **AI Conversion**: When switching formats, an AI agent intelligently rewrites the document structure to fit the target format perfectly (e.g., converting Markdown headers to `\section{}`).

### 5. Multi-Language Support
* **Global Adaptation**: The interface and AI responses adapt to your language preference (English/Chinese).
* **Context Aware**: If you write notes in Chinese, the generated simulation will automatically use Chinese labels and instructions.

---

## Architecture Overview

The Principia is built on a "Dual-Brain" architecture:

1.  **The Physicist (Reasoning Agent)**:
    * *Role*: Deeply understands physics concepts, derives formulas, and explains "Why".
    * *Powered by*: DeepSeek-V3, OpenAI o1.
    
2.  **The Engineer (Vision/Coder Agent)**:
    * *Role*: Visualizes the concepts, writes code, handles spatial reasoning and OCR.
    * *Powered by*: Gemini 2.0 Flash, GPT-4o.

---

## Privacy & Security

* **Bring Your Own Key (BYOK)**: The Principia does **not** store your API keys on any server. They are saved strictly in your browser's local storage (`localStorage`).
* **Direct Communication**: Your keys are sent directly from the backend proxy to the AI providers.

---

## Future Roadmap (Alpha -> Beta)
*(Note: Just take a look, written by AI. If it actually gets made, remember to let me play with it too.)*

* [ ] **Voice Input**: Describe simulations by speaking.
* [ ] **AR/VR Support**: View simulations in mixed reality.
* [ ] **Collaborative Mode**: Multiplayer physics sandbox.
* [ ] **Python/Jupyter Integration**: Export simulations as Python notebooks.