/*

import Gren.Kernel.Scheduler exposing (binding, succeed, rawSpawn)
import Gren.Kernel.Utils exposing (update)
import Dict exposing (foldl)

*/

var process = require("node:process");
var stream = require("node:stream");

var _ChildProcess_module = function () {
  return require("node:child_process");
};

var _ChildProcess_spawn = F3(function (sendInitToApp, sendExitToApp, options) {
  return __Scheduler_binding(function (callback) {
    var subproc;
    try {
      subproc = _ChildProcess_getSubProc(options);
    } catch (e) {
      callback(
        __Scheduler_succeed(
          __Scheduler_rawSpawn(
            sendExitToApp(typeof e.errno === "undefined" ? -1 : e.errno),
          ),
        ),
      );

      return;
    }

    var proc = __Scheduler_rawSpawn(
      sendInitToApp({
        __$processId: __Scheduler_rawSpawn(
          __Scheduler_binding(function () {
            return function () {
              subproc.kill();
            };
          }),
        ),
        __$streams:
          options.__$connection.__$kind !== 1
            ? {}
            : {
                __$input: stream.Writable.toWeb(subproc.stdin),
                __$output: stream.Readable.toWeb(subproc.stdout),
                __$error: stream.Readable.toWeb(subproc.stderr),
              },
      }),
    );

    subproc.on("exit", function (code) {
      __Scheduler_rawSpawn(sendExitToApp(code));
    });

    callback(__Scheduler_succeed(proc));
  });
});

function _ChildProcess_getSubProc(options) {
  var childProcess = _ChildProcess_module();

  var workingDir = options.__$workingDirectory;
  var env = options.__$environmentVariables;
  var shell = options.__$shell;
  var cmd = [options.__$program].concat(options.__$arguments).join(" ");

  var subproc = childProcess.spawn(cmd, {
    cwd: _ChildProcess_handleCwd(workingDir),
    env: _ChildProcess_handleEnv(env),
    timeout: options.__$runDuration,
    shell: _ChildProcess_handleShell(shell),
    stdio:
      options.__$connection.__$kind === 0
        ? "inherit"
        : options.__$connection.__$kind === 1
          ? "pipe"
          : "ignore",
    detached:
      options.__$connection.__$kind === 3 && process.platform === "win32",
  });

  if (options.__$connection.__$kind === 3) {
    subproc.unref();
  }

  return subproc;
}

function _ChildProcess_handleCwd(cwd) {
  return cwd.__$inherit ? process.cwd() : cwd.__$override;
}

function _ChildProcess_handleEnv(env) {
  return env.__$option === 0
    ? process.env
    : env.__$option === 1
      ? __Utils_update(process.env, _ChildProcess_dictToObj(env.__$value))
      : _ChildProcess_dictToObj(env.__$value);
}

function _ChildProcess_handleShell(shell) {
  return shell.__$choice === 0
    ? false
    : shell.__$choice === 1
      ? true
      : shell.__$value;
}

function _ChildProcess_dictToObj(dict) {
  return A3(
    __Dict_foldl,
    F3(function (key, value, acc) {
      acc[key] = value;
      return acc;
    }),
    {},
    dict,
  );
}
