// A signal sent from outside the process, which upstream left as a TODO: the
// app installs its listener, says `ready`, and is sent the signal then.
import * as assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import * as path from "node:path";
import { describe, it } from "node:test";

const app = path.resolve(import.meta.dirname, "../bin/app");

function signalled(arg, signal) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [app, arg]);
    let stdout = "";
    let sent = false;
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
      if (!sent && stdout.includes("ready\n")) {
        sent = true;
        proc.kill(signal);
      }
    });
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code, stdout }));
  });
}

describe("Signals", () => {
  it("SIGINT is delivered to its listener", async () => {
    const { code, stdout } = await signalled("SIGINT", "SIGINT");
    assert.equal(stdout, "ready\nSIGINT\n");
    assert.equal(code, 101);
  });

  it("SIGTERM is delivered to its listener", async () => {
    const { code, stdout } = await signalled("SIGTERM", "SIGTERM");
    assert.equal(stdout, "ready\nSIGTERM\n");
    assert.equal(code, 102);
  });

  it("a task main ends when its task has", async () => {
    const { code, stdout } = await new Promise((resolve) =>
      execFile(process.execPath, [app, "Done"], (error, stdout) => resolve({ code: error ? error.code : 0, stdout })),
    );
    assert.equal(stdout, "Done\n");
    assert.equal(code, 0);
  });
});
