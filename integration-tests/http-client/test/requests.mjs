// Runs `server-app` on a free port, then `tests-app` against it, and makes one
// test of each line the client prints: `ok NAME` or `not ok NAME -- WHY`
// (src/Effectful.geng). A client that prints nothing, or exits non-zero with
// every line ok, fails the run as well.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as net from "node:net";
import * as path from "node:path";
import { describe, it } from "node:test";

const here = path.resolve(import.meta.dirname, "..");

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = spawn(process.execPath, [path.join(here, "server-app"), String(port)]);
    let out = "";
    server.stdout.on("data", (d) => {
      out += d.toString();
      if (out.includes("Server started")) resolve(server);
    });
    server.on("exit", (code) => reject(new Error(`server-app exited ${code} before it started`)));
  });
}

function runClient(port) {
  return new Promise((resolve) => {
    const client = spawn(process.execPath, [path.join(here, "tests-app"), String(port)]);
    let stdout = "";
    let stderr = "";
    client.stdout.on("data", (d) => (stdout += d.toString()));
    client.stderr.on("data", (d) => (stderr += d.toString()));
    client.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const port = await freePort();
const server = await startServer(port);
const result = await runClient(port);
server.kill();

const lines = result.stdout.split("\n").filter((l) => l.length > 0);

describe("HttpClient", () => {
  for (const line of lines) {
    const ok = line.startsWith("ok ");
    const [name, why] = line.replace(/^(not )?ok /, "").split(" -- ");
    it(name, () => {
      if (!ok) assert.fail(why ?? line);
    });
  }

  it("the client exits 0, having printed its checks", () => {
    assert.ok(lines.length > 0, `no checks printed\n${result.stderr}`);
    assert.equal(result.code, 0, result.stderr);
  });
});
