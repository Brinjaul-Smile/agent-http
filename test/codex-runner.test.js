const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  resolveWorkspaceCwd,
  runCodex,
  validatePrompt,
  RequestError,
} = require("../src/codex-runner");

function makeTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-test-"));
}

function writeFakeCodex(binDir, source) {
  const file = path.join(binDir, "codex");
  fs.writeFileSync(file, source, { mode: 0o755 });
  return file;
}

test("validatePrompt rejects missing prompt", () => {
  assert.throws(
    () => validatePrompt({}),
    /prompt must be a non-empty string/,
  );
});

test("resolveWorkspaceCwd rejects cwd outside workspace", () => {
  const workspaceRoot = makeTempWorkspace();

  assert.throws(
    () => resolveWorkspaceCwd("/tmp", workspaceRoot),
    /cwd must be inside workspace/,
  );
});

test("runCodex executes fake codex and returns output file content", async () => {
  const workspaceRoot = makeTempWorkspace();
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-bin-"));
  writeFakeCodex(
    binDir,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const outputPath = args[args.indexOf("-o") + 1];
let prompt = "";
process.stdin.on("data", chunk => prompt += chunk);
process.stdin.on("end", () => {
  fs.writeFileSync(outputPath, "final:" + prompt.trim());
  process.stdout.write("stdout text");
  process.stderr.write("stderr text");
});
`,
  );

  const result = await runCodex(
    { prompt: "hello", cwd: workspaceRoot },
    {
      workspaceRoot,
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
      timeoutMs: 5000,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.output, "final:hello");
  assert.equal(result.stdout, "stdout text");
  assert.equal(result.stderr, "stderr text");
});

test("runCodex returns non-zero fake codex failure", async () => {
  const workspaceRoot = makeTempWorkspace();
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-bin-"));
  writeFakeCodex(
    binDir,
    `#!/usr/bin/env node
process.stderr.write("failed badly");
process.exit(7);
`,
  );

  const result = await runCodex(
    { prompt: "hello", cwd: workspaceRoot },
    {
      workspaceRoot,
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
      timeoutMs: 5000,
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 7);
  assert.match(result.error, /codex exited with code 7/);
  assert.equal(result.stderr, "failed badly");
});

test("runCodex reports clear error when codex is not in PATH", async () => {
  const workspaceRoot = makeTempWorkspace();

  await assert.rejects(
    () =>
      runCodex(
        { prompt: "hello", cwd: workspaceRoot },
        {
          workspaceRoot,
          env: { ...process.env, PATH: "" },
          timeoutMs: 5000,
        },
      ),
    (error) => {
      assert.equal(error instanceof RequestError, true);
      assert.equal(error.statusCode, 503);
      assert.equal(error.message, "codex CLI not found in PATH");
      return true;
    },
  );
});

test("runCodex times out and terminates fake codex", async () => {
  const workspaceRoot = makeTempWorkspace();
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-bin-"));
  writeFakeCodex(
    binDir,
    `#!/usr/bin/env node
setTimeout(() => {}, 10000);
`,
  );

  const result = await runCodex(
    { prompt: "hello", cwd: workspaceRoot },
    {
      workspaceRoot,
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
      timeoutMs: 50,
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "codex execution timed out");
  assert.equal(result.timedOut, true);
});
