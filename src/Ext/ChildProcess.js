// ChildProcess's externs: `run` (m1b-extern.md §H8 step 5) and `spawn` with
// the child it answers (m1b-source.md §SO16).
//
// The options arrive flattened, since a record does not cross (D192), and the
// three outcomes are built by the Geng functions passed first.

var process = require("node:process");
var childProcess = require("node:child_process");
var stream = require("node:stream");

function toBytes(buffer) {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function run(
  makeSuccess,
  makeProgramError,
  makeInitError,
  program,
  args,
  shellChoice,
  shellValue,
  inheritCwd,
  cwd,
  envOption,
  envKeys,
  envValues,
  maxBuffer,
  runDuration,
  succeed,
  fail,
) {
  var given = {};
  for (var i = 0; i < envKeys.length; i++) {
    given[envKeys[i]] = envValues[i];
  }

  var shell =
    shellChoice === 0 ? false : shellChoice === 1 ? true : shellValue;

  var cmdOptions = {
    encoding: "buffer",
    timeout: runDuration,
    cwd: inheritCwd ? process.cwd() : cwd,
    env:
      envOption === 0
        ? process.env
        : envOption === 1
          ? Object.assign({}, process.env, given)
          : given,
    maxBuffer: maxBuffer,
    shell: shell,
  };

  function cmdCallback(err, stdout, stderr) {
    if (err == null) {
      succeed(makeSuccess(toBytes(stdout), toBytes(stderr)));
    } else if (typeof err.errno === "undefined") {
      // errno only exists on system errors, so the program was run. Its exit
      // code is a number only when it exited: a timeout or a signal leaves
      // `null`, and too much output leaves the string
      // ERR_CHILD_PROCESS_STDIO_MAXBUFFER. The kernel passed either on into an
      // `Int`; -1 is what `spawn` already reports for a process that has no
      // exit code to give (m1b-extern.md §H16).
      fail(
        makeProgramError(
          typeof err.code === "number" ? err.code : -1,
          toBytes(stdout),
          toBytes(stderr),
        ),
      );
    } else {
      fail(makeInitError(err.path, err.spawnargs, err.code));
    }
  }

  var subProc;

  if (shell) {
    subProc = childProcess.execFile(
      [program].concat(args).join(" "),
      cmdOptions,
      cmdCallback,
    );
  } else {
    subProc = childProcess.execFile(program, args, cmdOptions, cmdCallback);
  }

  return function () {
    subProc.kill();
  };
}

// SPAWN

// The task completes when node reports the process started, and fails with the
// program, the arguments and node's code when it reports that it could not be.
// A child is its node process and its exit code, once it has one, with the
// tasks still waiting for it. Without a shell the program and its arguments
// are passed apart, as `run` passes them: joined, they named a program that
// does not exist.
function spawn(
  build,
  makeError,
  program,
  args,
  shellChoice,
  shellValue,
  inheritCwd,
  cwd,
  envOption,
  envKeys,
  envValues,
  runDuration,
  kind,
  succeed,
  fail,
) {
  var given = {};
  for (var i = 0; i < envKeys.length; i++) {
    given[envKeys[i]] = envValues[i];
  }

  var shell =
    shellChoice === 0 ? false : shellChoice === 1 ? true : shellValue;

  var options = {
    cwd: inheritCwd ? process.cwd() : cwd,
    env:
      envOption === 0
        ? process.env
        : envOption === 1
          ? Object.assign({}, process.env, given)
          : given,
    timeout: runDuration,
    shell: shell,
    stdio: kind === 0 ? "inherit" : kind === 1 ? "pipe" : "ignore",
    detached: kind === 3 && process.platform === "win32",
  };

  var subproc;
  try {
    subproc = shell
      ? childProcess.spawn([program].concat(args).join(" "), [], options)
      : childProcess.spawn(program, args, options);
  } catch (e) {
    fail(makeError(program, args, e.code || ""));
    return;
  }

  var child = { subproc: subproc, exitCode: null, waiting: [] };
  var started = false;

  subproc.on("spawn", function () {
    started = true;
    if (kind === 3) {
      subproc.unref();
    }
    succeed(
      kind === 1
        ? build(
            child,
            true,
            stream.Writable.toWeb(subproc.stdin),
            stream.Readable.toWeb(subproc.stdout),
            stream.Readable.toWeb(subproc.stderr),
          )
        : build(child, false, null, null, null),
    );
  });

  subproc.on("error", function (e) {
    if (!started) {
      fail(makeError(program, args, e.code || ""));
    }
  });

  subproc.on("exit", function (code) {
    child.exitCode = typeof code === "number" ? code : -1;
    var waiting = child.waiting;
    child.waiting = [];
    waiting.forEach(function (answer) {
      answer(child.exitCode);
    });
  });
}

function waitForExit(child, succeed, fail) {
  if (child.exitCode !== null) {
    succeed(child.exitCode);
  } else {
    child.waiting.push(succeed);
  }
}

function kill(child, succeed, fail) {
  if (child.exitCode === null) {
    child.subproc.kill();
  }
  succeed();
}
