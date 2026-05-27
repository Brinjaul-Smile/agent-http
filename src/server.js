const http = require("node:http");

const { RequestError, runCodex } = require("./codex-runner");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 1024 * 1024;

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.setEncoding("utf8");

    req.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(new RequestError("request body too large", 413));
        req.destroy();
        return;
      }

      body += chunk;
    });

    req.on("error", reject);

    req.on("end", () => {
      try {
        resolve(body === "" ? {} : JSON.parse(body));
      } catch {
        reject(new RequestError("invalid JSON body"));
      }
    });
  });
}

function formatCodexResult(result, includeDebug = false) {
  const response = {
    ok: result.ok,
  };

  if (result.error) {
    response.error = result.error;
  }

  if (Object.prototype.hasOwnProperty.call(result, "exitCode")) {
    response.exitCode = result.exitCode;
  }

  if (Object.prototype.hasOwnProperty.call(result, "output")) {
    response.output = result.output;
  }

  if (result.timedOut) {
    response.timedOut = true;
  }

  if (includeDebug) {
    response.debug = {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    };
  }

  return response;
}

function createServer(options = {}) {
  const runner = options.runner || runCodex;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || DEFAULT_HOST}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname !== "/codex") {
      sendJson(res, 404, { ok: false, error: "not found" });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "method not allowed" });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await runner(body);
      const statusCode = result.timedOut ? 504 : 200;
      sendJson(res, statusCode, formatCodexResult(result, url.searchParams.get("debug") === "1"));
    } catch (error) {
      if (error instanceof RequestError) {
        sendJson(res, error.statusCode, { ok: false, error: error.message });
        return;
      }

      sendJson(res, 500, {
        ok: false,
        error: error.message || "internal server error",
      });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  const host = process.env.HOST || DEFAULT_HOST;
  const port = Number(process.env.PORT || DEFAULT_PORT);

  server.listen(port, host, () => {
    console.log(`Codex HTTP server listening on http://${host}:${port}`);
  });
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  MAX_BODY_BYTES,
  createServer,
  formatCodexResult,
  readJsonBody,
  sendJson,
};
