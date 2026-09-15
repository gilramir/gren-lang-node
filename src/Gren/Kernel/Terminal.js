/*

import Gren.Kernel.Scheduler exposing (binding, rawSpawn)

*/

var process = require("node:process");

var _Terminal_attachListener = function (sendToApp) {
  return __Scheduler_binding(function (_callback) {
    var listener = function (data) {
      __Scheduler_rawSpawn(
        sendToApp({
          __$columns: process.stdout.columns,
          __$rows: process.stdout.rows,
        }),
      );
    };

    process.stdout.on("resize", listener);

    return function () {
      process.stdout.off("resize", listener);
      process.stdout.pause();
    };
  });
};
