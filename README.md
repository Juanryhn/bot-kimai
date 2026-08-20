# Kimai Telegram Bot

A small Telegram bot that parses natural-language timesheet instructions, uses a Groq completion model to extract structured timesheet entries, and creates timesheets in a Kimai instance.

## Features

- Accepts `/ask` commands in Telegram with free-form instructions (e.g. "from 8 to 10 research component X").
- Uses Groq chat completions to parse user intent into structured JSON entries.
- Creates timesheet entries in Kimai via Kimai HTTP API.
- Simple health-check HTTP endpoint.
- Rate limiting and owner-only access control.

## Prerequisites

- Node.js 18+ and npm
- A running Kimai instance with an API token
- A Telegram bot token
- Groq API key (used for model completions)

## Install

Install project dependencies:

```bash
npm install
```

Install developer tooling (optional):

```bash
npm install --save-dev prettier
```

## Development

This project runs as a webhook-based Telegram bot. The repository includes an HTTP handler at `/api/webhook` (see `api/webhook.ts`) and a `vercel.json` ready for deployment to Vercel.

Local development options:

- Use Vercel CLI to run locally: `vercel dev` (recommended when testing the full serverless behavior).
- Or run a simple TypeScript runner for quick tests: `npx tsx api/webhook.ts`.

The webhook endpoint path is `/api/webhook` and the server expects Telegram POSTs to be routed there.

## Build

Compile TypeScript and run the built output:

```bash
npm run build
npm start
```

## Configuration

This project uses environment variables and a local `kimai-conf.json` for activity mapping. Create a `.env` file or set environment variables in your host runtime.

Required environment variables:

- `TELEGRAM_BOT_TOKEN` — Telegram bot API token.
- `ALLOWED_TELEGRAM_USER_ID` — Telegram numeric user id allowed to use the bot (owner-only lock).
- `GROQ_API_KEY` — API key for the Groq client used to parse instructions.
- `KIMAI_URL` — Base URL of your Kimai instance (e.g. `https://kimai.example.com`).
- `KIMAI_USER` — Kimai user (not currently used for auth but validated at startup).
- `KIMAI_TOKEN` — Kimai API token used in `Authorization: Bearer ...` header.
- `KIMAI_DEFAULT_CUSTOMER` — Default customer id (integer) used when creating timesheets.
- `KIMAI_DEFAULT_PROJECT` — Default project id (integer) used when creating timesheets.
- `PORT` — (optional) port for the health-check HTTP server. Defaults to `3000`.
- `WEBHOOK_SECRET` — secret token used to validate incoming Telegram webhook requests. Set this to a random string and pass it when calling `setWebhook` so Telegram will include it in webhook requests.

Example `.env`:

```ini
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
ALLOWED_TELEGRAM_USER_ID=123456789
GROQ_API_KEY=your_groq_key
KIMAI_URL=https://kimai.example.com
KIMAI_USER=bot-user
KIMAI_TOKEN=your_kimai_token
KIMAI_DEFAULT_CUSTOMER=1
KIMAI_DEFAULT_PROJECT=2
PORT=3000
WEBHOOK_SECRET=your_random_secret
```

Activity mapping (`kimai-conf.json`)

- The bot expects a `kimai-conf.json` file in the repository root, or `/etc/secrets/kimai-conf.json` if present. It must contain an `activities` object mapping numeric activity IDs to descriptions. Example:

```json
{
  "activities": {
    "1": "Development",
    "2": "Research",
    "3": "Meeting"
  }
}
```

There is an example file `kimai-conf.example.json` in the repository — copy or rename it to `kimai-conf.json` and edit activity IDs as needed.

## Notes

- The bot is event-driven (Telegram webhook/polling via Telegraf) and acts as an integration service rather than a general REST API.
- The bot is webhook-driven using Telegraf's `webhookCallback`. Incoming Telegram updates are handled via the `/api/webhook` endpoint (see [api/webhook.ts](api/webhook.ts)).
- A `vercel.json` is included to deploy the webhook as a serverless function. The default route sends requests to `/api/webhook`.
- If you are specifically searching for the long-polling implementation of this project, see: https://github.com/Juanryhn/bot-kimai-long-polling
- The `/ask` command content is sent to the Groq model and must return a JSON object with an `entries` array matching the expected shape.
- The repository includes a basic rate limiter to prevent rapid repeated requests.

## Troubleshooting

- If the bot fails at startup, verify required environment variables are present. Missing variables cause an immediate error.
- If Kimai requests fail, check `KIMAI_URL` and `KIMAI_TOKEN` and confirm the API user has permission to create timesheets.
- If parsing fails, inspect the Groq response in logs and verify your `kimai-conf.json` activity mapping.

Deployment / setWebhook tips

- If you deploy to `https://your-domain.com`, register the webhook with Telegram using:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-domain.com/api/webhook&secret_token=$WEBHOOK_SECRET"
```

- Ensure `WEBHOOK_SECRET` matches the `secret_token` used in the `setWebhook` call so incoming requests are validated.

## License

See the `LICENSE` file in the repository root.
