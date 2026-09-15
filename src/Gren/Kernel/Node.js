/*

import Gren.Kernel.Platform exposing (export)
import Gren.Kernel.Scheduler exposing (binding, rawSpawn)

*/

var process = require("node:process");

var _Node_log = F2(function (text, args) {
  // This function is used for simple applications where the main function returns String
  // NOTE: this function needs __Platform_export available to work
  console.log(text);
  return {};
});

// Subs

var _Node_attachEmptyEventLoopListener = function (selfMsg) {
  return __Scheduler_binding(function (_callback) {
    var listener = function () {
      __Scheduler_rawSpawn(selfMsg);
    };

    process.on("beforeExit", listener);

    return function () {
      process.off("beforeExit", listener);
    };
  });
};

var _Node_attachSignalInterruptListener = function (selfMsg) {
  return __Scheduler_binding(function (_callback) {
    var listener = function () {
      __Scheduler_rawSpawn(selfMsg);
    };

    process.on("SIGINT", listener);

    return function () {
      process.off("SIGINT", listener);
    };
  });
};

var _Node_attachSignalTerminateListener = function (selfMsg) {
  return __Scheduler_binding(function (_callback) {
    var listener = function () {
      __Scheduler_rawSpawn(selfMsg);
    };

    process.on("SIGTERM", listener);

    return function () {
      process.off("SIGTERM", listener);
    };
  });
};
