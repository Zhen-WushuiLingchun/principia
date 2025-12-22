# Developer Guide

## Architecture Overview

The Principia follows a modern decoupled architecture consisting of a React-based frontend and a Flask-based backend.

### Frontend (`/principia`)
Built with **Vite + React + TypeScript**.

-   **Core Components**:
    -   `App.tsx`: The main application orchestrator, managing state for content, layout, and API interactions.
    -   `Editor.tsx`: Wraps the Monaco Editor for a robust coding experience (syntax highlighting for LaTeX/Markdown).
    -   `Renderer.tsx`: Handles the live preview using `react-markdown` and `react-latex-next`. Includes custom logic to render LaTeX colors in Markdown mode.
    -   `HandwritingCanvas.tsx`: A custom HTML5 Canvas implementation supporting multi-page handwriting, pressure sensitivity simulation, and eraser logic.
    -   `InteractiveBadge.tsx`: The UI for displaying AI analysis and hosting the iframe for interactive visualizations.
    -   `SettingsSidebar.tsx`: Manages user configuration for API endpoints and keys.

-   **State Management**:
    -   Local component state is used for UI toggles.
    -   Ref hooks (`useRef`) are used heavily for Canvas and Editor interactions to maintain performance.

### Backend (`app.py`)
Built with **Flask**.

-   **API Endpoints**:
    -   `/api/analyze` (POST): Handles "Reasoning" requests. Uses an LLM to explain concepts and generate HTML/JS simulation code.
    -   `/api/ocr` (POST): Handles "Vision" requests. Accepts base64 images and returns LaTeX transcription, with specific prompting for color detection.
    -   `/api/convert` (POST): Handles format conversion (LaTeX <-> Markdown). Contains specific prompt engineering to preserve structure and translate color syntax (e.g., `\textcolor` <-> HTML tags).
    -   `/`: Serves the static frontend build in production.

## Setup for Development

1.  **Environment**:
    -   Ensure `Node.js` and `Python` are installed.
    -   It is recommended to use a virtual environment for Python (`venv`).

2.  **Frontend Dev**:
    ```bash
    cd principia
    npm run dev
    ```
    This starts the Vite dev server with Hot Module Replacement (HMR).

3.  **Backend Dev**:
    ```bash
    python app.py
    ```
    Runs on port 8000 by default.

## Key Implementation Details

### Color Preservation Logic
One of the unique features is the preservation of text color during format conversion.
-   **Backend**: The `/api/convert` endpoint uses specialized prompts to instruct the LLM to map `\textcolor{color}{text}` in LaTeX to `<font color="color">text</font>` in Markdown (or keep it as compatible LaTeX syntax) and vice versa.
-   **Frontend**: The `Renderer` component uses regex replacement to render `\textcolor` commands even when in Markdown preview mode, ensuring a consistent WYSIWYG experience.

### AI Visualization
The visualization engine works by:
1.  Sending the context text to the LLM.
2.  Requesting a standalone HTML snippet containing a `<script>` block with a physics simulation loop (`requestAnimationFrame`).
3.  Injecting this HTML into a sandboxed `iframe` within the `InteractiveBadge` component.

## Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes.
4.  Push to the branch.
5.  Open a Pull Request.
