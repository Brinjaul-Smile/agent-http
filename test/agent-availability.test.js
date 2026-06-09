const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  DEFAULT_KNOWN_AGENTS,
  getAgentAvailability,
} = require("../src/agent-availability");

function writeFakeCommand(binDir, command) {
  const file = path.join(binDir, command);
  fs.writeFileSync(file, "#!/bin/sh\n", { mode: 0o755 });
  return file;
}

test("getAgentAvailability reports installed and supported known agents", async () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-http-bin-"));
  writeFakeCommand(binDir, "codex");
  writeFakeCommand(binDir, "gemini");

  const agents = await getAgentAvailability(
    {
      codex: {
        command: "codex",
        supported: true,
      },
      gemini: {
        command: "gemini",
        supported: false,
      },
      opencode: {
        command: "opencode",
        supported: false,
      },
    },
    { PATH: binDir },
  );

  assert.deepEqual(agents, [
    {
      name: "codex",
      command: "codex",
      available: true,
      supported: true,
    },
    {
      name: "gemini",
      command: "gemini",
      available: true,
      supported: false,
    },
    {
      name: "opencode",
      command: "opencode",
      available: false,
      supported: false,
      error: "opencode CLI not found in PATH",
    },
  ]);
});

test("DEFAULT_KNOWN_AGENTS includes Pi coding agent", () => {
  assert.deepEqual(DEFAULT_KNOWN_AGENTS.pi, {
    command: "pi",
    supported: false,
  });
});
