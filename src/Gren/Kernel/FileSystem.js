/*

import Gren.Kernel.Scheduler exposing (binding, rawSpawn)
import Gren.Kernel.FilePath exposing (fromString)
import FileSystem exposing (Changed, Moved)
import Maybe exposing (Just, Nothing)

*/

var fs = require("node:fs");

var _FileSystem_watch = F3(function (path, isRecursive, sendToSelf) {
  return __Scheduler_binding(function (_callback) {
    var watcher = null;

    try {
      watcher = fs.watch(
        path,
        { recursive: isRecursive },
        function (eventType, filename) {
          var maybePath = filename
            ? __Maybe_Just(__FilePath_fromString(filename))
            : __Maybe_Nothing;

          if (eventType === "rename") {
            __Scheduler_rawSpawn(sendToSelf(__FileSystem_Moved(maybePath)));
          } else if (eventType === "change") {
            __Scheduler_rawSpawn(sendToSelf(__FileSystem_Changed(maybePath)));
          }

          // other change types are ignored
        },
      );
    } catch (e) {
      // ignore errors
    }

    return function () {
      if (watcher) {
        watcher.close();
      }
    };
  });
});
