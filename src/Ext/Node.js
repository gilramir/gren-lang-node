// Node's externs (m1b-extern.md §H8 step 5; the signal listeners,
// m1b-source.md §SO15). `log`, which a `main : String` is handed to, stays
// kernel code until `Platform` goes.

var stream = require("node:stream");
var process = require("node:process");

// The three streams are the web streams core's Stream kernel reads and writes,
// and they cross at type variables (D200), as the kernel's record held them.
function init(build, succeed, fail) {
  if (process.stdin.unref) {
    // Don't block program shutdown if this is the only
    // stream being listened to
    process.stdin.unref();
  }

  const stdinStream = stream.Readable.toWeb(process.stdin);
  const stdinProxy = !process.stdin.ref
    ? stdinStream
    : makeProxyOfStdin(stdinStream);

  succeed(
    build(
      typeof module !== "undefined" ? module.filename : process.execPath,
      process.platform,
      process.arch,
      process.argv,
      stream.Writable.toWeb(process.stdout),
      stream.Writable.toWeb(process.stderr),
      stdinProxy,
    ),
  );
}

function makeProxyOfStdin(stdinStream) {
  return new Proxy(stdinStream, {
    get(target, prop, receiver) {
      if (prop === "getReader") {
        // Make sure to keep program alive if we're waiting for
        // user input
        process.stdin.ref();

        const reader = Reflect.get(target, prop, receiver);
        return makeProxyOfReader(reader);
      }

      if (prop === "pipeThrough") {
        process.stdin.ref();
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

function makeProxyOfReader(reader) {
  return new Proxy(reader, {
    get(target, prop, receiver) {
      if (prop === "releaseLock") {
        process.stdin.unref();
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

function getPlatform(succeed, fail) {
  succeed(process.platform);
}

function getCpuArchitecture(succeed, fail) {
  succeed(process.arch);
}

// Keys and values as two arrays in the same order, which Geng pairs up.
function getEnvironmentVariables(build, succeed, fail) {
  var keys = [];
  var values = [];
  for (var key in process.env) {
    keys.push(key);
    values.push(process.env[key]);
  }
  succeed(build(keys, values));
}

function exitWithCode(code, succeed, fail) {
  process.exit(code);
}

function setExitCode(code, succeed, fail) {
  process.exitCode = code;
  succeed();
}

// SIGNALS

// Each delivery emits the one `msg` the listener was given into the caller's
// source (D71). Node's own handling of the signal, ending the process, is off
// while any listener for it is installed, as it always was.
function onSignal(signal, events, msg, succeed, fail) {
  var listener = function () {
    events.emit(msg);
  };
  process.on(signal, listener);
  succeed({ signal: signal, listener: listener });
}

function removeListener(handle, succeed, fail) {
  process.off(handle.signal, handle.listener);
  succeed();
}
