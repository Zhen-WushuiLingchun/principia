# User Manual

## Interface Overview

The Principia interface is divided into three main areas:
1.  **Left Panel (Editor)**: Where you type your notes in LaTeX or Markdown.
2.  **Middle Panel (Canvas)**: A digital whiteboard for handwriting and drawing.
3.  **Right Panel (Preview)**: A real-time formatted view of your notes.

## 1. Editor & Formatting

### Switching Modes
-   Click the **TEX / MD** toggle in the top navigation bar.
-   **Note**: Switching modes will trigger an AI conversion to rewrite your content in the new format while preserving headers, lists, and **colors**.

### Writing Content
-   **LaTeX Mode**: Use standard LaTeX syntax (e.g., `\section{}`, `\textbf{}`, `\textcolor{red}{}`).
-   **Markdown Mode**: Use standard Markdown (e.g., `#`, `**`, `<font color="red">`).
-   **Math**: In both modes, use `$...$` for inline math and `$$...$$` for display math.

## 2. Handwriting & OCR

### Tools
-   **Pen**: Draw strokes.
-   **Eraser**: Remove strokes.
-   **Color Palette**: Change pen color. The AI will detect this color during recognition.
-   **Background**: Toggle between Blank, Lined, or Grid backgrounds.
-   **Pages**: Use the `+` button to add new pages to your canvas.

### Recognition
1.  Write your equation or text on the canvas.
2.  Click the **Sparkle Icon** (Recognize) in the canvas toolbar.
3.  The AI will transcribe your handwriting into LaTeX and insert it into the Editor at your cursor position.
    -   *Tip*: Red strokes will be transcribed as `\textcolor{red}{...}`.

## 3. AI Analysis & Visualization

1.  **Select Text**: Highlight any text or equation in the Editor or Preview.
2.  **Click "Analyze"**: A floating badge will appear. Click it.
3.  **View Results**:
    -   **Explanation**: A concise physics/math explanation of the selected concept.
    -   **Visualization**: If applicable, an interactive simulation will load below the explanation. You can often adjust parameters using sliders.

## 4. Exporting

Click the **Export** button in the header to open the export dialog.
-   **Format**: Choose to export the main text as `.tex` or `.md`.
-   **Include PDF**: Check this to compile your handwriting pages into a PDF.
-   **Include Analysis**: Check this to include AI explanations and interactive HTML visualizations.
-   **Download**: Generates a `.zip` file with all assets organized.

## 5. Settings

Click the **Gear Icon** in the header to configure AI providers.
-   **Reasoning Model**: Used for Explanations, and Format Conversion.
-   **Vision Model**: Used for Handwriting OCR, Visualizations.
-   **Configuration**: Enter your `Base URL` and `API Key`. Compatible with OpenAI, Gemini, and other OpenAI-compatible endpoints.
