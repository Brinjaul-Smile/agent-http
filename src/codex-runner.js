const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { findExecutable } = require("./agent-availability");
const { waitForChild } = require("./process-runner");

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_WORKSPACE_ROOT = path.resolve(__dirname, "..");

class RequestError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "RequestError";
    this.statusCode = statusCode;
  }
}

function validatePrompt(body) {
  if (!body || typeof body.prompt !== "string" || body.prompt.trim() === "") {
    throw new RequestError("prompt must be a non-empty string");
  }

  return body.prompt;
}

function resolveWorkspaceCwd(inputCwd, workspaceRoot = DEFAULT_WORKSPACE_ROOT) {
  const root = path.resolve(workspaceRoot);
  const requested = inputCwd ? path.resolve(inputCwd) : root;
  const relative = path.relative(root, requested);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return requested;
  }

  throw new RequestError("cwd must be inside workspace");
}

async function readOutputFile(outputPath) {
  try {
    return await fs.readFile(outputPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

async function cleanupFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function runCodex(body, options = {}) {
  const workspaceRoot = options.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const prompt = validatePrompt(body);
  const cwd = resolveWorkspaceCwd(body.cwd, workspaceRoot);
  const env = options.env || process.env;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-http-"));
  const outputPath = path.join(tempDir, "last-message.txt");

  if (!(await findExecutable("codex", env))) {
    throw new RequestError("codex CLI not found in PATH", 503);
  }

  const child = spawn(
    "codex",
    ["exec", "--skip-git-repo-check", "-C", cwd, "-o", outputPath, "-"],
    {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  let childResult;
  try {
    childResult = await waitForChild(child, prompt, timeoutMs);
    const output = await readOutputFile(outputPath);

    if (childResult.timedOut) {
      return {
        ok: false,
        error: "codex execution timed out",
        exitCode: childResult.exitCode,
        signal: childResult.signal,
        timedOut: true,
        output,
        stdout: childResult.stdout,
        stderr: childResult.stderr,
      };
    }

    if (childResult.exitCode !== 0) {
      return {
        ok: false,
        error: `codex exited with code ${childResult.exitCode}`,
        exitCode: childResult.exitCode,
        signal: childResult.signal,
        output,
        stdout: childResult.stdout,
        stderr: childResult.stderr,
      };
    }

    return {
      ok: true,
      exitCode: childResult.exitCode,
      output,
      stdout: childResult.stdout,
      stderr: childResult.stderr,
    };
  } finally {
    await cleanupFile(outputPath);
    await fs.rmdir(tempDir).catch(() => {});
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_WORKSPACE_ROOT,
  RequestError,
  resolveWorkspaceCwd,
  runCodex,
  validatePrompt,
};
