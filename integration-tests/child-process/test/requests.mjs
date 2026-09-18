// Upstream's tests on `node:test` and node's own `child_process`, rather than
// mocha and clet, so that nothing needs installing.
import * as assert from "node:assert/strict";
import { execFile } from "node:child_process";
import * as path from "node:path";
import { describe, it } from "node:test";

const app = path.resolve(import.meta.dirname, "../bin/app");

function run(arg) {
  return new Promise((resolve) => {
    execFile(process.execPath, [app, arg], { cwd: path.dirname(app) }, (error, stdout, stderr) =>
      resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

describe("ChildProcess", () => {
  it("With Shell", async () => {
    const { code, stdout, stderr } = await run("ExecShell");
    assert.equal(code, 0, stderr);
    assert.equal(stdout.trim(), process.version);
    assert.doesNotMatch(stderr, /DeprecationWarning/);
  });

  it("No Shell", async () => {
    const { code, stdout, stderr } = await run("Exec");
    assert.equal(code, 0, stderr);
    assert.equal(stdout.trim(), process.version);
    assert.doesNotMatch(stderr, /DeprecationWarning/);
  });

  it("Program not found", async () => {
    const { stdout } = await run("NotFound");
    assert.equal(stdout.trim(), "Process Not Found");
  });
});
