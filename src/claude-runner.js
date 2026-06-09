const { spawn } = require("node:child_process");

const { findExecutable } = require("./agent-availability");
const { waitForChild } = require("./process-runner");
const {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_WORKSPACE_ROOT,
  RequestError,
  resolveWorkspaceCwd,
  validatePrompt,
} = require("./codex-runner");

function parseClaudeOutput(stdout) {
  try {
    const payload = JSON.parse(stdout);
    return typeof payload.result === "string" ? payload.result : stdout;
  } catch {
    throw new RequestError("claude returned invalid JSON", 502);
  }
}

async function runClaude(body, options = {}) {
  const workspaceRoot = options.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const prompt = validatePrompt(body);
  const cwd = resolveWorkspaceCwd(body.cwd, workspaceRoot);
  const env = options.env || process.env;

  if (!(await findExecutable("claude", env))) {
    throw new RequestError("claude CLI not found in PATH", 503);
  }

  const child = spawn("claude", ["--bare", "-p", "--output-format", "json"], {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const childResult = await waitForChild(child, prompt, timeoutMs);

  if (childResult.timedOut) {
    return {
      ok: false,
      error: "claude execution timed out",
      exitCode: childResult.exitCode,
      signal: childResult.signal,
      timedOut: true,
      output: "",
      stdout: childResult.stdout,
      stderr: childResult.stderr,
    };
  }

  if (childResult.exitCode !== 0) {
    return {
      ok: false,
      error: `claude exited with code ${childResult.exitCode}`,
      exitCode: childResult.exitCode,
      signal: childResult.signal,
      output: "",
      stdout: childResult.stdout,
      stderr: childResult.stderr,
    };
  }

  return {
    ok: true,
    exitCode: childResult.exitCode,
    output: parseClaudeOutput(childResult.stdout),
    stdout: childResult.stdout,
    stderr: childResult.stderr,
  };
}

module.exports = {
  parseClaudeOutput,
  runClaude,
};
