# Agent HTTP

本项目是一个本地 HTTP 服务，用来包装已经安装好的 agent CLI。当前支持：

- `codex`：通过 `codex exec` 运行。
- `claude`：通过 Claude Code 的非交互模式运行。

## 运行要求

- macOS 或 Linux。
- Node.js `>=20`。
- 已安装 `codex` CLI，并且服务进程的 `PATH` 中可以找到它。
- Codex CLI 已完成认证，并且可以非交互式运行 `codex exec`。
- 如需调用 Claude，需安装 `claude` CLI，并且服务进程的 `PATH` 中可以找到它。
- Claude CLI 已完成认证，并且可以非交互式运行 `claude -p`。

## 启动

```sh
npm start
```

服务默认监听：

```text
http://127.0.0.1:8787
```

如需修改监听地址或端口，可以通过 `HOST` 和 `PORT` 覆盖：

```sh
HOST=127.0.0.1 PORT=8787 npm start
```

## 健康检查

```sh
curl http://127.0.0.1:8787/health
```

响应：

```json
{"ok":true}
```

## Agent 可用性

`GET /agents` 可以发现当前机器上常见 agent CLI 是否能在服务进程的 `PATH` 中找到。这个接口只检查命令是否存在，不会真正调用模型。

返回字段里有两个状态：

- `name`：agent 名称，也就是 `POST /runs` 中的 `agent` 值。
- `available`：本机是否检测到了这个 CLI。
- `supported`：当前 HTTP 服务是否已经支持通过 `POST /runs` 调用这个 agent。

当前 `supported: true` 的 agent 只有 `codex` 和 `claude`。其他主流 CLI 即使被检测到，也会先显示为 `supported: false`，表示发现了但暂时不能通过 `/runs` 执行。

```sh
curl http://127.0.0.1:8787/agents
```

响应示例：

```json
{
  "ok": true,
  "agents": [
    {
      "name": "codex",
      "command": "codex",
      "available": true,
      "supported": true
    },
    {
      "name": "claude",
      "command": "claude",
      "available": false,
      "supported": true,
      "error": "claude CLI not found in PATH"
    },
    {
      "name": "gemini",
      "command": "gemini",
      "available": true,
      "supported": false
    }
  ]
}
```

默认会检测这些常见 agent 命令：`codex`、`claude`、`gemini`、`opencode`、`pi`、`cursor-agent`、`aider`、`amp`、`auggie`、`goose`、`qwen`。

## 通用调用

推荐使用 `POST /runs`，通过 `agent` 选择要调用的后端：

```sh
curl -sS -X POST http://127.0.0.1:8787/runs \
  -H 'Content-Type: application/json' \
  -d '{"agent":"codex","prompt":"Reply with exactly: pong"}'
```

请求体：

```json
{
  "agent": "codex",
  "prompt": "Reply with exactly: pong"
}
```

字段说明：

- `agent`：必填，可选值是 `codex` 或 `claude`。
- `prompt`：必填，要发送给 agent 的任务内容。
- `cwd`：选填，必须位于当前服务工作空间内。默认值是本服务项目目录。

调用 Claude：

```sh
curl -sS -X POST http://127.0.0.1:8787/runs \
  -H 'Content-Type: application/json' \
  -d '{"agent":"claude","prompt":"Reply with exactly: pong"}'
```

Claude runner 会执行：

```sh
claude --bare -p --output-format json
```

prompt 会通过 stdin 传入。响应会读取 Claude JSON 输出中的 `result` 字段作为统一的 `output`。

响应示例：

```json
{
  "ok": true,
  "exitCode": 0,
  "output": "pong"
}
```

如果对应 CLI 不存在，请求会返回 `503`：

```json
{
  "ok": false,
  "error": "claude CLI not found in PATH"
}
```

## 兼容调用 Codex

`POST /codex` 仍然保留，等价于 `POST /runs` 中指定 `agent: "codex"`：

```sh
curl -sS -X POST http://127.0.0.1:8787/codex \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Reply with exactly: pong"}'
```

请求体：

```json
{
  "prompt": "Reply with exactly: pong"
}
```

字段说明：

- `prompt`：必填，要发送给 Codex 的任务内容。
- `cwd`：选填，必须位于当前服务工作空间内。默认值是本服务项目目录。

只有当你需要让 agent 在服务工作空间的某个子目录中运行时，才需要传 `cwd`：

```json
{
  "agent": "claude",
  "prompt": "Inspect this package",
  "cwd": "./packages/example"
}
```

工作空间边界是有意设计的。这个服务会代表 HTTP 调用方执行本机 CLI，所以 `cwd` 被限制在服务工作空间内，避免通过 API 暴露服务器上的任意目录。

每个请求都会启动一个后台 CLI 子进程。请求完成后，该子进程会退出。如果执行时间超过 10 分钟，服务会终止子进程并返回超时响应。

响应示例：

```json
{
  "ok": true,
  "exitCode": 0,
  "output": "pong"
}
```

默认情况下，响应会尽量保持简洁，适合作为业务接口使用。原始 CLI 日志默认不会返回，因为 CLI 通常会把运行细节写入 stderr。

如果需要查看原始 stdout 和 stderr，可以使用 `debug=1`：

```sh
curl -sS -X POST 'http://127.0.0.1:8787/runs?debug=1' \
  -H 'Content-Type: application/json' \
  -d '{"agent":"claude","prompt":"Reply with exactly: pong"}'
```

调试响应示例：

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

## 测试

```sh
npm test
```
