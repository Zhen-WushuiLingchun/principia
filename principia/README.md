# Principia

A cross-platform desktop application for physics formula analysis and visualization.

## Features

- Handwritten formula recognition (OCR)
- Formula analysis and explanation
- Format conversion between different LaTeX formats
- Interactive visualization of physics models
- AI-powered analysis and insights

## Prerequisites

- Node.js 20+
- Python 3.11+
- PyInstaller (for building the backend)
- Electron (for desktop application)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd principia
   ```

2. **Install dependencies**
   ```bash
   # Install Python dependencies
   pip install -r requirements.txt
   
   # Install Node.js dependencies
   npm install
   ```

3. **Build the backend**
   ```bash
   # Windows
   pyinstaller --onefile --name app app.py --distpath electron
   
   # macOS
   pyinstaller --onefile --name app app.py --distpath electron
   
   # Linux
   pyinstaller --onefile --name app app.py --distpath electron
   ```

4. **Build the frontend**
   ```bash
   npm run build
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run electron:build
   ```

## Cross-Platform Support

The application supports the following platforms:
- Windows
- macOS
- Linux

## GitHub Actions

The project includes a GitHub Action workflow that automatically builds and tests the application on all supported platforms. The workflow is triggered on push and pull request events to the main branch.

## Project Structure

- `app.py` - Backend server with OCR, analysis, and conversion functionality
- `src/` - Frontend React application
- `electron/` - Electron main process and resources
- `scripts/` - Utility scripts

## License

MIT
