# MagnetDow - High-Performance PikPak Torrent Downloader

A high-concurrency web service that allows users to download torrents via PikPak's API. Designed to bypass rate limits using account rotation and server-side queuing.

## 🚀 Features

*   **High Concurrency**: Handles thousands of simultaneous users via an in-memory task queue.
*   **Account Rotation**: automatically cycles through multiple PikPak accounts to distribute load.
*   **Real-time Progress**: WebSocket integration for live download status updates.
*   **Premium UI**: Glassmorphism design with a focus on privacy and speed.
*   **CAPTCHA Handling**: Built-in flow to pause and allow manual CAPTCHA resolution when PikPak blocks login.

## 🛠️ Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/akilaramal69-beep/magnetdow
    cd magnetdow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npx tsc
    ```

## 🐳 Docker Usage

1.  **Build and User Docker Compose:**
    ```bash
    docker-compose up -d --build
    ```
    The server will be available at `http://localhost:3000`.

2.  **Handling CAPTCHA with Docker:**
    -   When the container logs show the CAPTCHA URL, solve it in your browser.
    -   Create a `captcha_token.txt` file in the project root on your host machine.
    -   Paste the token inside.
    -   The container (which mounts this file) will detect it and retry login automatically.

## 🚦 Local Usage

1.  **Start the server:**
    ```bash
    npm start
    ```
    The server runs on `http://localhost:3000`.

2.  **Configuration:**
    Set the following environment variables (optional, defaults provided for testing):
    ```bash
    export PIKPAK_USERNAME="your_email"
    export PIKPAK_PASSWORD="your_password"
    ```

## ⚠️ CAPTCHA Handling

If PikPak detects "suspicious" login activity (common on VPS), the server will pause and prompt you:

```
⚠️  CAPTCHA REQUIRED TO LOGIN ⚠️
1. Open this URL in your browser: https://...
```

**To resolve:**
1.  Open the URL in your local browser and solve the CAPTCHA.
2.  Extract the `captcha_token` from the success URL or network tab.
3.  Create a file named `captcha_token.txt` in the root directory.
4.  Paste the token inside and save.
5.  The server will automatically detect the file and retry login.

## 📝 License

MIT
