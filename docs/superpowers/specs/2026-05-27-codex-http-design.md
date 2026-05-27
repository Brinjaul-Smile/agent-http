# Codex HTTP Design

## Goal

Build a small local HTTP service that exposes the installed `codex` CLI through a synchronous API.

## Scope

- Use Node.js with the built-in `http` module.
- Require Node.js `>=20`.
- Support macOS and Linux when the `codex` CLI is installed, authenticated, and available in the service process `PATH`.
- Listen on `127.0.0.1:8787`.
- Do not implement authentication.
- Provide one endpoint: `POST /codex`.
- Execute `codex exec` non-interactively and wait for completion before returning the HTTP response.

## API

### `POST /codex`

Request body:

```json
{
  "prompt": "Explain this project",
  "cwd": "/Volumes/D/web/codex-http"
}
```

Fields:

- `prompt` is required and must be a non-empty string.
- `cwd` is optional. When omitted, it defaults to the service workspace.
- `cwd` must resolve inside `/Volumes/D/web/codex-http`.

Success response:

```json
{
  "ok": true,
  "exitCode": 0,
  "output": "Final Codex response"
}
```

Failure response:

```json
{
  "ok": false,
  "error": "Human-readable error",
  "exitCode": 1,
  "output": "Final Codex response if available"
}
```

By default, responses do not include raw CLI stdout or stderr. Those streams contain implementation logs that are not stable business-facing output.

Use `debug=1` to include raw process output:

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

## Execution Model

The server runs:

```sh
codex exec --skip-git-repo-check -C <cwd> -o <temp-output-file> -
```

The prompt is written to stdin. Arguments are passed through `spawn` without a shell, so request content is not shell-interpreted.

The `-o` output file is used as the primary final response source. Raw stdout and stderr are captured internally and returned only when the request includes `debug=1`.

## Limits

- Maximum request body: 1 MiB.
- Execution timeout: 10 minutes.
- Concurrent requests: initially allowed by Node's normal request handling. Each request starts one `codex exec` process.

## Error Handling

- Invalid JSON returns `400`.
- Missing or empty `prompt` returns `400`.
- `cwd` outside the workspace returns `400`.
- Unknown routes return `404`.
- Unsupported methods return `405`.
- Timeout returns `504` and terminates the child process.
- CLI spawn or runtime failures return `500` or the child exit code depending on how far execution got.

## Testing

- Unit test request validation and `cwd` containment.
- Integration-style test the HTTP endpoint with a fake `codex` executable placed first in `PATH`.
- Manual smoke test can run against the real installed `codex` CLI with a short prompt.
