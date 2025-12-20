# The Principia (Alpha) - Local Build Guide

Welcome to **The Principia**, a generative engine that transforms text and handwriting into TeX and markdown formats, and simultaneously generates interactive simulations.

This guide will help you set up the project locally.

## Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js** (v18 or higher) & **npm**: [Download Here](https://nodejs.org/)
2.  **Python** (v3.8 or higher) & **pip**: [Download Here](https://www.python.org/)
3.  **Git**: [Download Here](https://git-scm.com/)

## Project Structure

~~~text
principia_alpha/
├── app.py              # Flask Backend (API Proxy & Logic)
├── requirements.txt    # Python Dependencies
├── principia/          # Frontend (React + Vite)
│   ├── src/            # Source Code
│   ├── public/         # Static Assets
│   ├── package.json    # Node Dependencies
│   └── ...
└── BUILD_GUIDE.md      # This file
~~~

## Step 1: Backend Setup (Python)

The backend is a Flask application that handles API requests to LLM providers (DeepSeek, OpenAI, Gemini) and serves the frontend build.

1.  Open a terminal in the `principia_alpha` folder.
2.  Create a virtual environment (optional but recommended):
    ~~~bash
    python -m venv venv
    # Windows:
    .\venv\Scripts\activate
    # Mac/Linux:
    source venv/bin/activate
    ~~~
3.  Install dependencies:
    ~~~bash
    pip install -r requirements.txt
    ~~~
4.  Start the backend server:
    ~~~bash
    python app.py
    ~~~
    You should see: `The Principia Backend Running on Port 8000`

5.  **Running in Production Environment**

    When deploying in an actual production environment, it is crucial to turn off Debug mode.

    In the last line of the `app.py` file, simply change `debug=True` to `debug=False`:

    ~~~python
    # Before change
    app.run(port=PORT, debug=True, use_reloader=False)

    # After change
    app.run(port=PORT, debug=False, use_reloader=False)
    ~~~

    **Why is this necessary?**
    1.  **Security**: Debug mode displays detailed stack traces in the browser when errors occur, potentially leaking sensitive information like server paths and code structure.
    2.  **Performance**: Debug mode enables additional debugging hooks which impact performance.
    3.  **Stability**: Certain behaviors in Debug mode (like auto-reloading) are not suitable for production environments.

    **Professional Recommendation:**
    If running on a real production server (such as AWS or a Linux VPS), it is generally recommended not to use `python app.py` directly (which is Flask's built-in development server), but to use a WSGI server like Gunicorn or Waitress:

    ~~~bash
    # Install waitress (Universal for Windows/Linux, easy to use)
    pip install waitress

    # Start command (replaces python app.py)
    waitress-serve --port=8000 app:app
    ~~~
    This way, even if `debug=True` is written in `app.py`, Waitress will ignore it and run in production mode.

## Step 2: Frontend Setup (React + Vite)

The frontend is a modern React application.

1.  Open a **new** terminal window.
2.  Navigate to the `principia` folder:
    ~~~bash
    cd principia_alpha/principia
    ~~~
3.  Install dependencies:
    ~~~bash
    npm install
    ~~~
4.  Build the frontend for production:
    ~~~bash
    npm run build
    ~~~
    *Note: The backend `app.py` is configured to serve the static files from `principia/dist`, which is created by this command.*

## Step 3: Running the Application

Once the backend is running and the frontend is built:

1.  Open your browser and go to: `http://localhost:8000`
2.  You should see the The Principia interface.

## Step 4: Configuration (Important!)
*(Note: You are now entering the usage phase; please open the web interface to proceed.)*

The Principia relies on external AI models. You need to configure your API keys in the application settings.

1.  Click the **Settings** icon (gear) in the top right corner.
2.  **Reasoning API (Explanation)**:
    * Recommended: **DeepSeek** or **OpenAI**.
    * Base URL: `https://api.deepseek.com/v1` (for DeepSeek)
    * API Key: Your API Key
    * Model: `deepseek-chat`
3.  **Multimodal API (Vision & Simulation)**:
    * Recommended: **Gemini** (Google) or compatible OpenAI Vision models.
    * Base URL: `https://generativelanguage.googleapis.com/v1beta/openai/` (for Gemini)
    * API Key: Your API Key
    * Model: `gemini-2.0-flash-exp` (or similar)
4.  Click **Save Configuration**.

## Troubleshooting

* **Port 8000 already in use**: Edit `app.py` and change `PORT = 8000` to another number.
* **API Errors**: Check the browser console (F12) and the terminal running `app.py` for error details. Ensure your API keys are valid and have sufficient quota.
* **Frontend changes not showing**: If you modify code in `principia/src`, you must run `npm run build` again to update the served files. For development with hot-reload, you can run `npm run dev` in the `principia` folder, but you'll access it via port 5173 (and might need to adjust CORS/proxy settings).

## Development Mode

If you want to develop the frontend with hot-reloading:

1.  Keep `python app.py` running on port 8000.
2.  In `principia/vite.config.ts`, ensure the proxy is set to target `http://localhost:8000`.
3.  Run `npm run dev` in the `principia` folder.
4.  Access via `http://localhost:5173`.
