# Codex HTTP

本项目是一个本地 HTTP 服务，用来包装已经安装好的 `codex` CLI。

## 运行要求

- macOS 或 Linux。
- Node.js `>=20`。
- 已安装 `codex` CLI，并且服务进程的 `PATH` 中可以找到它。
- Codex CLI 已完成认证，并且可以非交互式运行 `codex exec`。

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

## 调用 Codex

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

只有当你需要让 Codex 在服务工作空间的某个子目录中运行时，才需要传 `cwd`：

```json
{
  "prompt": "Inspect this package",
  "cwd": "./packages/example"
}
```

工作空间边界是有意设计的。这个服务会代表 HTTP 调用方执行 `codex exec`，所以 `cwd` 被限制在服务工作空间内，避免通过 API 暴露服务器上的任意目录。

每个请求都会启动一个后台 `codex exec` 子进程。请求完成后，该子进程会退出。如果执行时间超过 10 分钟，服务会终止子进程并返回超时响应。

响应示例：

```json
{
  "ok": true,
  "exitCode": 0,
  "output": "pong"
}
```

默认情况下，响应会尽量保持简洁，适合作为业务接口使用。原始 CLI 日志默认不会返回，因为 Codex 会把运行细节写入 stderr。

如果需要查看原始 stdout 和 stderr，可以使用 `debug=1`：

```sh
curl -sS -X POST 'http://127.0.0.1:8787/codex?debug=1' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Reply with exactly: pong"}'
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
