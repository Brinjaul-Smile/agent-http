const assert = require("node:assert/strict");
const test = require("node:test");

const { RequestError } = require("../src/codex-runner");
const { createServer } = require("../src/server");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://${address.address}:${address.port}`);
    });
    server.on("error", reject);
  });
}

async function withServer(runner, callback) {
  const server = createServer({ runner });
  const baseUrl = await listen(server);

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /health returns ok", async () => {
  await withServer(async () => ({ ok: true }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  });
});

test("POST /codex returns runner result", async () => {
  await withServer(
    async (body) => ({
      ok: true,
      exitCode: 0,
      output: `received:${body.prompt}`,
      stdout: "stdout",
      stderr: "stderr",
    }),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/codex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "hello" }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        ok: true,
        exitCode: 0,
        output: "received:hello",
      });
    },
  );
});

test("POST /runs dispatches to requested runner", async () => {
  const runners = {
    codex: async () => {
      throw new Error("codex runner should not be called");
    },
    claude: async (body) => ({
      ok: true,
      exitCode: 0,
      output: `claude:${body.prompt}`,
      stdout: "stdout",
      stderr: "stderr",
    }),
  };

  const server = createServer({ runners });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "claude", prompt: "hello" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      ok: true,
      exitCode: 0,
      output: "claude:hello",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /runs rejects unknown agent", async () => {
  const server = createServer({
    runners: {
      codex: async () => ({ ok: true }),
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "missing", prompt: "hello" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      ok: false,
      error: "agent must be one of: codex",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /runs default runner list includes claude", async () => {
  const server = createServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "missing", prompt: "hello" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      ok: false,
      error: "agent must be one of: codex, claude",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /codex returns debug output when requested", async () => {
  await withServer(
    async (body) => ({
      ok: true,
      exitCode: 0,
      output: `received:${body.prompt}`,
      stdout: "stdout",
      stderr: "stderr",
    }),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/codex?debug=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "hello" }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        ok: true,
        exitCode: 0,
        output: "received:hello",
        debug: {
          stdout: "stdout",
          stderr: "stderr",
        },
      });
    },
  );
});

test("POST /codex formats failed runner result without debug by default", async () => {
  await withServer(
    async () => ({
      ok: false,
      error: "codex exited with code 7",
      exitCode: 7,
      output: "",
      stdout: "stdout",
      stderr: "stderr",
    }),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/codex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "hello" }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        ok: false,
        error: "codex exited with code 7",
        exitCode: 7,
        output: "",
      });
    },
  );
});

test("POST /codex returns 400 for invalid JSON", async () => {
  await withServer(async () => ({ ok: true }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/codex`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, "invalid JSON body");
  });
});

test("POST /codex maps request validation errors to 400", async () => {
  await withServer(
    async () => {
      throw new RequestError("prompt must be a non-empty string");
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/codex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "" }),
      });
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.ok, false);
      assert.equal(body.error, "prompt must be a non-empty string");
    },
  );
});

test("unknown routes return 404", async () => {
  await withServer(async () => ({ ok: true }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, { ok: false, error: "not found" });
  });
});

test("unsupported /codex methods return 405", async () => {
  await withServer(async () => ({ ok: true }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/codex`, { method: "GET" });
    const body = await response.json();

    assert.equal(response.status, 405);
    assert.equal(body.ok, false);
    assert.equal(body.error, "method not allowed");
  });
});
