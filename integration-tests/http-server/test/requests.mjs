// Upstream's requests, on node's own `fetch` and `node:test` rather than
// supertest and mocha, so that nothing needs installing. The server is started
// here, on a free port, and stopped when the file's tests are done.
import * as assert from "node:assert";
import { spawn } from "node:child_process";
import * as net from "node:net";
import * as path from "node:path";
import { after, before, describe, it } from "node:test";

const here = path.resolve(import.meta.dirname, "..");
let server;
let url;

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

before(async () => {
  const port = await freePort();
  url = `http://localhost:${port}`;
  server = spawn(process.execPath, [path.join(here, "app"), String(port)], { cwd: here });
  await new Promise((resolve, reject) => {
    let out = "";
    server.stdout.on("data", (d) => {
      out += d.toString();
      if (out.includes("Server started")) resolve();
    });
    server.on("exit", (code) => reject(new Error(`app exited ${code} before it started`)));
  });
});

after(() => server.kill());

describe("Requests", () => {
  it("responding with custom body", async () => {
    const res1 = await fetch(`${url}/`);
    assert.equal(res1.status, 200);
    assert.equal(await res1.text(), "Welcome!");

    const res2 = await fetch(`${url}/hello`);
    assert.equal(res2.status, 200);
    assert.equal(await res2.text(), "Hello to you too!");
  });

  it("responding with custom status", async () => {
    const res1 = await fetch(`${url}/`);
    assert.equal(res1.status, 200);

    const res2 = await fetch(`${url}/not/found`);
    assert.equal(res2.status, 404);
  });

  it("setting custom headers", async () => {
    const res = await fetch(`${url}/`);
    assert.equal(res.headers.get("x-custom-header"), "hey there");
  });

  it("responding to non-GET requests", async () => {
    const res1 = await fetch(`${url}/`, { method: "POST", body: "some data" });
    assert.equal(res1.headers.get("content-type"), "text/html");
    assert.equal(await res1.text(), "You posted: some data");

    const res2 = await fetch(`${url}/howdy`, { method: "PUT" });
    assert.equal(res2.headers.get("content-type"), "text/html");
    assert.equal(await res2.text(), `Not found: PUT ${url}/howdy`);
  });

  // Can't actually test an unknown method, because node:http doesn't support
  // custom methods. See https://github.com/nodejs/node-v0.x-archive/issues/3192
  // and https://github.com/nodejs/http-parser/issues/309

  it("handling json", async () => {
    const res = await fetch(`${url}/name`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Jane" }),
    });
    assert.equal(await res.text(), "Hello, Jane");
  });

  it("responding to stream requests", async () => {
    const form = new FormData();
    form.append("test.txt", new Blob([Buffer.from("abc123")], { type: "text/plain" }), "test.txt");
    const res = await fetch(`${url}/`, { method: "POST", body: form });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /test.txt/);
    assert.match(text, /abc123/);
  });

  it("handling unicode", async () => {
    const res = await fetch(`${url}/`, { method: "POST", body: "snow ❄ flake" });
    assert.equal(res.headers.get("content-type"), "text/html");
    assert.equal(await res.text(), "You posted: snow ❄ flake");
  });

  it("responding with bytes", async () => {
    const res = await fetch(`${url}/george.jpeg`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");
  });
});
