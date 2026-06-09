const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_KNOWN_AGENTS = {
  codex: {
    command: "codex",
    supported: true,
  },
  claude: {
    command: "claude",
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
  pi: {
    command: "pi",
    supported: false,
  },
  "cursor-agent": {
    command: "cursor-agent",
    supported: false,
  },
  aider: {
    command: "aider",
    supported: false,
  },
  amp: {
    command: "amp",
    supported: false,
  },
  auggie: {
    command: "auggie",
    supported: false,
  },
  goose: {
    command: "goose",
    supported: false,
  },
  qwen: {
    command: "qwen",
    supported: false,
  },
};

function normalizeAgentConfig(config) {
  if (typeof config === "string") {
    return {
      command: config,
      supported: false,
    };
  }

  return {
    command: config.command,
    supported: Boolean(config.supported),
  };
}

async function isExecutable(filePath) {
  try {
    await fs.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(command, env = process.env) {
  const pathValue = env.PATH || "";
  const directories = pathValue.split(path.delimiter).filter(Boolean);

  for (const directory of directories) {
    const candidate = path.join(directory, command);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function getAgentAvailability(agents, env = process.env) {
  const entries = await Promise.all(
    Object.entries(agents).map(async ([name, config]) => {
      const { command, supported } = normalizeAgentConfig(config);
      const path = await findExecutable(command, env);
      const status = {
        name,
        command,
        available: Boolean(path),
        supported,
      };

      if (!path) {
        status.error = `${command} CLI not found in PATH`;
      }

      return status;
    }),
  );

  return entries;
}

module.exports = {
  DEFAULT_KNOWN_AGENTS,
  findExecutable,
  getAgentAvailability,
  normalizeAgentConfig,
};
