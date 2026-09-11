/*

import Sqlite exposing (GenericError, ForeignKeyError, UniqueConstraintError, DecodingError, MultipleResultsError)
import Gren.Kernel.FilePath exposing (toString)
import Gren.Kernel.Scheduler exposing (binding, succeed, fail)
import Gren.Kernel.Json exposing (wrap, unwrap)
import Json.Decode as Decode exposing (decodeValue)
import Result exposing (isOk)
import Sqlite.Encode as SqliteEncode exposing (toJson)
import Sqlite.Decode as SqliteDecode exposing (toJson)
import Maybe exposing (Just, Nothing)

*/

var sqlite = require("node:sqlite");

var _Sqlite_openInMemory = function (opts) {
  return _Sqlite_openImpl(opts, ":memory:");
};

var _Sqlite_open = F2(function (opts, path) {
  return _Sqlite_openImpl(opts, _FilePath_toString(path));
});

var _Sqlite_openImpl = function (opts, path) {
  return __Scheduler_binding(function (callback) {
    try {
      callback(
        __Scheduler_succeed(
          new sqlite.DatabaseSync(path, {
            readOnly: opts.__$readOnly,
            enableForeignKeyConstraints: opts.__$enableForeignKeySConstraints,
            allowExtension: opts.__$allowExtension,
            timeout: opts.__$timeout > 0 ? opts.__$timeout : 0,
          }),
        ),
      );
    } catch (e) {
      callback(_Sqlite_constructError(e));
    }
  });
};

var _Sqlite_close = function (db) {
  return __Scheduler_binding(function (callback) {
    try {
      db.close();
      callback(__Scheduler_succeed({}));
    } catch (e) {
      callback(_Sqlite_constructError(e));
    }
  });
};

var _Sqlite_backup = F3(function (destination, pages, db) {
  return __Scheduler_binding(function (callback) {
    try {
      sqlite
        .backup(db, _FilePath_toString(destination), {
          source: "main",
          target: "main",
          rate: pages,
        })
        .then(function (res) {
          callback(__Scheduler_succeed({}));
        })
        .catch(function (e) {
          callback(_Sqlite_constructError(e));
        });
    } catch (e) {
      callback(_Sqlite_constructError(e));
    }
  });
});

var _Sqlite_foldl = F4(function (query, db, func, acc) {
  return __Scheduler_binding(function (callback) {
    try {
      var acc_ = acc;
      const prepped = db.prepare(query.__$query);
      const params = __Json_unwrap(__SqliteEncode_toJson(query.__$parameters));
      const rowDecoder = __SqliteDecode_toJson(query.__$rowDecoder);

      for (const value of prepped.iterate(params)) {
        const jsonResult = A2(
          __Decode_decodeValue,
          rowDecoder,
          _Json_wrap(value),
        );

        if (__Result_isOk(jsonResult)) {
          acc_ = A2(func, jsonResult.a, acc_);
        } else {
          return callback(
            __Scheduler_fail(__Sqlite_DecodingError(jsonResult.a)),
          );
        }
      }
      callback(__Scheduler_succeed(acc_));
    } catch (e) {
      callback(_Sqlite_constructError(e));
    }
  });
});

var _Sqlite_getMaybeOne = F2(function (query, db) {
  return __Scheduler_binding(function (callback) {
    try {
      const prepped = db.prepare(query.__$query);
      const params = __Json_unwrap(__SqliteEncode_toJson(query.__$parameters));
      const rowDecoder = __SqliteDecode_toJson(query.__$rowDecoder);
      const iterator = prepped.iterate(params);

      const value = iterator.next().value;

      if (!value) {
        return callback(__Scheduler_succeed(__Maybe_Nothing));
      }

      if (!iterator.next().done) {
        var count = 2;
        for (const value of iterator) {
          count++;
        }
        return callback(__Scheduler_fail(__Sqlite_MultipleResultsError(count)));
      }

      const result = A2(__Decode_decodeValue, rowDecoder, _Json_wrap(value));

      if (__Result_isOk(result)) {
        callback(__Scheduler_succeed(__Maybe_Just(result.a)));
      } else {
        return callback(__Scheduler_fail(__Sqlite_DecodingError(result.a)));
      }
    } catch (e) {
      callback(_Sqlite_constructError(e));
    }
  });
});

var _Sqlite_executeMany = F3(function (statement, values, db) {
  return __Scheduler_binding(function (callback) {
    try {
      const prepped = db.prepare(statement.__$statement);
      let lastResult;

      if (values.length === 0) {
        lastResult = prepped.run();
      } else {
        for (const val of values) {
          lastResult = prepped.run(
            __Json_unwrap(__SqliteEncode_toJson(statement.__$parameters(val))),
          );
        }
      }

      const result = {
        __$changes: lastResult.changes,
        // An `Int64` in Gren since `int64-migration.md` M5, and D74 makes that
        // a `BigInt` here. node:sqlite hands back a Number unless the driver is
        // in BigInt mode, so the conversion is done rather than assumed.
        __$lastInsertRowid: BigInt(lastResult.lastInsertRowid),
      };

      callback(__Scheduler_succeed(result));
    } catch (e) {
      callback(_Sqlite_constructError(e));
    }
  });
});

var _Sqlite_executeScript = F2(function (script, db) {
  return __Scheduler_binding(function (callback) {
    try {
      db.exec(script);
      callback(__Scheduler_succeed(db));
    } catch (e) {
      callback(_Sqlite_constructError(e));
    }
  });
});

var _Sqlite_constructError = function (e) {
  if (e.errcode === 787) {
    return __Scheduler_fail(__Sqlite_ForeignKeyError(e.message));
  }

  if (e.errcode === 2067) {
    return __Scheduler_fail(__Sqlite_UniqueConstraintError(e.message));
  }

  return __Scheduler_fail(__Sqlite_GenericError(e.message));
};
