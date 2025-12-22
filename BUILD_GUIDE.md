# Build & Deployment Guide

This guide describes how to build The Principia for production deployment.

## Prerequisites

-   **Python 3.10+**
-   **Node.js 18+** & **npm**

## Build Process

The project is structured to serve the React frontend through the Flask backend. This requires building the frontend static assets first.

### 1. Build Frontend

Navigate to the frontend directory and run the build script:

```bash
cd principia
npm install  # Install dependencies if not already done
npm run build
```

**What this does:**
-   Compiles TypeScript code.
-   Bundles React assets using Vite.
-   Outputs static files (HTML, CSS, JS, Fonts) to `principia/dist/`.

### 2. Prepare Backend

Ensure Python dependencies are installed:

```bash
cd ..  # Return to project root
pip install -r requirements.txt
```

### 3. Production Directory Structure

After building, your directory should look like this:

```
project-root/
├── app.py
├── requirements.txt
└── principia/
    └── dist/          <-- Created by npm run build
        ├── index.html
        ├── assets/
        └── ...
```

## Running in Production

The `app.py` is configured to serve static files from `principia/dist`.

To run the server:

```bash
python app.py
```

For a robust production deployment, consider using a WSGI server like `gunicorn` (Linux/Mac) or `waitress` (Windows) instead of the built-in Flask development server.

**Example with Waitress (Windows):**
```bash
pip install waitress
waitress-serve --port=8000 app:app
```

**Example with Gunicorn (Linux):**
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

## Troubleshooting

-   **Missing Assets**: If the page loads but is blank or missing styles, ensure `npm run build` completed successfully and the `principia/dist` folder exists.
-   **CORS Errors**: The backend handles CORS, but ensure your API Base URLs in Settings are reachable from the client browser.
