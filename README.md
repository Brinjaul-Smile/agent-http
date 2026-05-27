# Codex HTTP

Local HTTP wrapper for the installed `codex` CLI.

## Requirements

- macOS or Linux.
- Node.js `>=20`.
- Installed `codex` CLI available in the service process `PATH`.
- Codex CLI authentication already configured for non-interactive `codex exec`.

## Start

```sh
npm start
```

The server listens on:

```text
http://127.0.0.1:8787
```

Override with `HOST` and `PORT` if needed.

## Health

```sh
curl http://127.0.0.1:8787/health
```

Response:

```json
{"ok":true}
```

## Run Codex

```sh
curl -sS -X POST http://127.0.0.1:8787/codex \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Reply with exactly: pong"}'
```

Request body:

```json
{
  "prompt": "Reply with exactly: pong",
  "cwd": "/Volumes/D/web/codex-http"
}
```

Fields:

- `prompt` is required.
- `cwd` is optional and must be inside this workspace. It defaults to this project directory.

Each request starts one background `codex exec` child process. That child process exits when the request finishes. If execution takes longer than 10 minutes, the server terminates the child process and returns a timeout response.

Example response:

```json
{
  "ok": true,
  "exitCode": 0,
  "output": "pong"
}
```

By default, the response is kept small for business use. Raw CLI logs are hidden because Codex writes runtime details to stderr.

Use `debug=1` when you need raw stdout and stderr:

```sh
curl -sS -X POST 'http://127.0.0.1:8787/codex?debug=1' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Reply with exactly: pong"}'
```

Debug response:

```json
{
  "ok": true,
  "exitCode": 0,
  "output": "pong",
  "debug": {
    "stdout": "pong\n",
    "stderr": "OpenAI Codex v0.134.0\n..."
  }
}
```

## Test

```sh
npm test
```
