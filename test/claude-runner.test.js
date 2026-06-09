const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runClaude } = require("../src/claude-runner");

function makeTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-test-"));
}

function writeFakeClaude(binDir, source) {
  const file = path.join(binDir, "claude");
  fs.writeFileSync(file, source, { mode: 0o755 });
  return file;
}

test("runClaude executes fake claude and returns JSON result output", async () => {
  const workspaceRoot = makeTempWorkspace();
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-bin-"));
  writeFakeClaude(
    binDir,
    `#!/usr/bin/env node
let prompt = "";
process.stdin.on("data", chunk => prompt += chunk);
process.stdin.on("end", () => {
  process.stdout.write(JSON.stringify({ result: "final:" + prompt.trim() }));
  process.stderr.write("stderr text");
});
`,
  );

  const result = await runClaude(
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
  assert.equal(result.stdout, '{"result":"final:hello"}');
  assert.equal(result.stderr, "stderr text");
});
