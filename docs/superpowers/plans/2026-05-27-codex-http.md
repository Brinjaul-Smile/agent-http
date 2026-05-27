# Codex HTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local synchronous HTTP API that runs the installed `codex` CLI through `codex exec`.

**Architecture:** A small Node.js service uses built-in modules only. `src/server.js` owns HTTP parsing and responses, while `src/codex-runner.js` owns request validation, workspace containment, process spawning, timeout handling, and output-file reading.

**Tech Stack:** Node.js built-in `http`, `child_process`, `node:test`, and `assert`.

---

## File Structure

- `package.json`: project scripts for start and test.
- `src/codex-runner.js`: validates input and runs `codex exec`.
- `src/server.js`: creates the HTTP server and exposes `POST /codex`.
- `test/codex-runner.test.js`: validates request handling, cwd containment, CLI invocation, success, failure, and timeout.
- `test/server.test.js`: validates HTTP routing, JSON parsing, success response, and error responses with a fake runner.

## Task 1: Project Skeleton and Runner Tests

**Files:**
- Create: `package.json`
- Create: `src/codex-runner.js`
- Create: `test/codex-runner.test.js`

- [ ] **Step 1: Write failing runner tests**

Create `test/codex-runner.test.js` with tests for missing prompt, cwd escape rejection, successful fake CLI execution, non-zero fake CLI execution, and timeout.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `src/codex-runner.js` does not exist yet.

- [ ] **Step 3: Implement minimal runner**

Create `src/codex-runner.js` with `validatePrompt`, `resolveWorkspaceCwd`, and `runCodex`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS for runner tests.

## Task 2: HTTP Server Tests and Implementation

**Files:**
- Create: `src/server.js`
- Create: `test/server.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing server tests**

Create `test/server.test.js` with tests for `POST /codex`, invalid JSON, missing prompt, unknown route, and unsupported method.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `src/server.js` does not exist yet.

- [ ] **Step 3: Implement minimal HTTP server**

Create `src/server.js` with `createServer`, body-size limiting, JSON parsing, route handling, and CLI runner integration.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS for all tests.

## Task 3: Manual Smoke Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add usage docs**

Document `npm start`, the `POST /codex` request shape, default bind address, timeout, and the fact that each request starts a temporary `codex exec` child process that exits when the request completes.

- [ ] **Step 2: Run automated tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Start the server**

Run: `npm start`

Expected: server logs `Codex HTTP server listening on http://127.0.0.1:8787`.

- [ ] **Step 4: Call the health endpoint**

Run: `curl -i http://127.0.0.1:8787/health`

Expected: HTTP 200 with `{"ok":true}`.

- [ ] **Step 5: Call the Codex endpoint with a short prompt**

Run: `curl -sS -X POST http://127.0.0.1:8787/codex -H 'Content-Type: application/json' -d '{"prompt":"Reply with exactly: pong"}'`

Expected: JSON response containing `ok`, `exitCode`, `output`, `stdout`, and `stderr`.
