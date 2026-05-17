# Google AI Mode API Wrapper

A lightweight local wrapper for Google AI Mode using Node.js, Express and Playwright.

It exposes a small HTTP API and a simple web UI for creating Google AI Mode chats, sending prompts and reading responses.

> This project does not use an official Google AI Mode API.  
> It automates a Chromium browser session with Playwright.

## Features

- Local HTTP API
- Web UI at `http://localhost:3000`
- Multiple chat sessions
- Docker support
- Configurable browser locale, timezone and headless mode

## How it works

```text
Client / Web UI
      ↓
Express server
      ↓
Playwright
      ↓
Chromium
      ↓
Google AI Mode
```

## Quick start

```bash
docker compose up --build
```

Then open:

```text
http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/health
```

## API

The available endpoints are shown in the web UI and exposed at:

```text
http://localhost:3000/api
```

Main endpoints:

```text
GET    /health
GET    /api
POST   /chat/new
POST   /chat/:chatId/message
GET    /chat/:chatId/last
GET    /chat/:chatId/all
DELETE /chat/:chatId
```

## Configuration

Environment variables:

| Variable | Default | Description |
|---|---:|---|
| `PORT` | `3000` | HTTP server port |
| `HEADLESS` | `true` | Run Chromium in headless mode |
| `AIMODE_URL` | `https://www.google.com/aimode` | Initial Google AI Mode URL |
| `BROWSER_LOCALE` | `it-IT` | Browser locale |
| `BROWSER_TIMEZONE` | `Europe/Rome` | Browser timezone |
| `BROWSER_USER_AGENT` | unset | Optional custom user agent |

## Security note

This project is intended for local use.

Avoid exposing the API publicly unless you add authentication and proper access controls.

For local-only Docker binding, prefer:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

## Limitations

This wrapper depends on the Google AI Mode web interface and DOM selectors.

It may stop working if Google changes the page structure, blocks automation, requires verification, or changes availability by region/session.

## Project structure

```text
server.js          Express API server
aimodeClient.js    Playwright automation logic
selectors.js       DOM selectors
public/index.html  Web UI
Dockerfile         Docker image
docker-compose.yml Docker Compose config
```

## Disclaimer

This is an unofficial project and is not affiliated with Google.

Use responsibly and make sure your usage complies with applicable terms and laws.