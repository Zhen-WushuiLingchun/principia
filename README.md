# The Principia - AI-Powered Physics & Math Workspace

The Principia is a next-generation research and education workspace that combines the power of LaTeX/Markdown editing, handwriting recognition, and AI-driven physics simulation. It is designed to bridge the gap between static notes and dynamic understanding.

## Key Features

### 1. Dual-Mode Editor (LaTeX & Markdown)
- **Seamless Switching**: Toggle between LaTeX and Markdown modes instantly.
- **AI Conversion**: Built-in AI automatically converts your content between formats while preserving document structure, equations, and **text colors**.
- **Live Preview**: Real-time rendering of LaTeX math and Markdown formatting.

### 2. Intelligent Handwriting Recognition
- **Canvas Input**: Draw equations, diagrams, or notes directly on the digital canvas.
- **AI OCR**: Advanced vision models transcribe handwriting into editable LaTeX code.
- **Color Detection**: Automatically detects stroke colors (e.g., red for emphasis) and preserves them in the transcribed text using `\textcolor` or HTML tags.

### 3. AI Reasoning & Visualization
- **Deep Understanding**: Select any equation or concept to get an instant AI explanation.
- **Interactive Simulations**: The AI generates dynamic, interactive HTML5/JS physics simulations based on your notes (e.g., projectile motion, wave interference) that you can run directly in the workspace.

### 4. Comprehensive Export
- **Project Bundle**: Export your work as a ZIP file containing:
  - **Main Document**: Your notes in `.tex` or `.md` format.
  - **Handwriting**: A compiled PDF of your canvas pages.
  - **Visualizations**: Interactive HTML files of any generated simulations.
  - **Explanations**: AI-generated explanations in a separate section.

### 5. Customizable AI Backend
- **Model Agnostic**: Configure your own API endpoints and keys (compatible with OpenAI/Gemini formats) for both Reasoning and Vision tasks.

## Quick Start

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- An API Key for an LLM provider (e.g., OpenAI, Gemini, or a local LLM serving endpoint).

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/the-principia.git
    cd the-principia
    ```

2.  **Install Frontend Dependencies**:
    ```bash
    cd principia
    npm install
    ```

3.  **Install Backend Dependencies**:
    ```bash
    cd ..
    pip install -r requirements.txt
    ```

### Running the App

1.  **Start the Backend**:
    ```bash
    # From project root
    python app.py
    ```

2.  **Start the Frontend (Dev Mode)**:
    ```bash
    # From principia/ directory
    npm run dev
    ```

3.  **Access**: Open `http://localhost:5173` in your browser.

## Documentation

- [User Manual](USER_MANUAL.md) - Detailed usage instructions.
- [Developer Guide](DEVELOPER_GUIDE.md) - Architecture and contribution.
- [Build Guide](BUILD_GUIDE.md) - Production build and deployment.
