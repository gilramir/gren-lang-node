/*

import Gren.Kernel.Scheduler exposing (binding, succeed, fail, rawSpawn)
import HttpClient exposing (BadUrl, Timeout, BadHeaders, UnknownError, SentChunk, ReceivedChunk, Error, Aborted, Done)
import Dict exposing (fromStringPairs, foldl)
import Platform exposing (sendToApp)

*/

function _HttpClient_clientForProtocol(config) {
  if (config.__$url.startsWith("http://")) {
    return require("node:http");
  }

  return require("node:https");
}

var _HttpClient_stream = F4(function (cleanup, sendToApp, request, config) {
  return __Scheduler_binding(function (callback) {
    function send(msg) {
      return __Scheduler_rawSpawn(sendToApp(msg));
    }

    let req = null;
    try {
      const client = _HttpClient_clientForProtocol(config);
      req = client.request(config.__$url, {
        method: config.__$method,
        headers: A3(
          __Dict_foldl,
          _HttpClient_dictToObject,
          {},
          config.__$headers,
        ),
        timeout: config.__$timeout,
      });
    } catch (e) {
      callback(__Scheduler_succeed(request));

      if (e.code === "ERR_INVALID_HTTP_TOKEN") {
        send(__HttpClient_Error(__HttpClient_BadHeaders));
      } else if (e.code === "ERR_INVALID_URL") {
        send(__HttpClient_Error(__HttpClient_BadUrl(config.__$url)));
      } else {
        send(
          __HttpClient_Error(
            __HttpClient_UnknownError("problem with request: " + e.message),
          ),
        );
      }

      return __Scheduler_rawSpawn(cleanup(request));
    }

    req.on("timeout", () => {
      req.destroy(_HttpClient_CustomTimeoutError);
    });

    req.on("error", (e) => {
      __Scheduler_rawSpawn(cleanup(request));

      if (e === _HttpClient_CustomTimeoutError) {
        send(__HttpClient_Timeout);
      } else if (e === _HttpClient_CustomAbortError) {
        send(__HttpClient_Aborted);
      } else {
        send(__HttpClient_UnknownError("problem with request: " + e.message));
      }
    });

    const body = _HttpClient_extractRequestBody(config);

    if (config.__$bodyType === "STREAM") {
      send(
        __HttpClient_UnknownError(
          "stream request body not supported in legacy api",
        ),
      );
    } else if (body == null) {
      send(__HttpClient_SentChunk(request));
    } else {
      req.write(body, () => {
        send(__HttpClient_SentChunk(request));
      });
    }

    return callback(
      __Scheduler_succeed({
        __$request: req,
        __$response: null,
      }),
    );
  });
});

var _HttpClient_sendChunk = F4(
  function (sendToApp, kernelRequest, request, bytes) {
    return __Scheduler_binding(function (callback) {
      if (!kernelRequest.__$request.writableEnded) {
        const chunk = _HttpClient_prepBytes(bytes);

        kernelRequest.__$request.write(chunk, () => {
          __Scheduler_rawSpawn(sendToApp(__HttpClient_SentChunk(request)));
        });
      }

      return callback(__Scheduler_succeed({}));
    });
  },
);

var _HttpClient_startReceive = F4(
  function (cleanup, sendToApp, kernelRequest, request) {
    return __Scheduler_binding(function (callback) {
      if (kernelRequest.__$request.writableEnded) {
        return callback(__Scheduler_succeed({}));
      }
      kernelRequest.__$request.on("response", (res) => {
        kernelRequest.__$response = res;

        res.on("data", (bytes) => {
          return __Scheduler_rawSpawn(
            sendToApp(
              __HttpClient_ReceivedChunk({
                __$request: request,
                __$response: _HttpClient_formatResponseLegacy(
                  res,
                  new DataView(
                    bytes.buffer,
                    bytes.byteOffset,
                    bytes.byteLength,
                  ),
                ),
              }),
            ),
          );
        });

        res.on("error", (e) => {
          __Scheduler_rawSpawn(cleanup(request));
          __Scheduler_rawSpawn(
            sendToApp(
              __HttpClient_Error(
                __HttpClient_UnknownError("problem with request: " + e.message),
              ),
            ),
          );
        });

        res.on("end", () => {
          __Scheduler_rawSpawn(cleanup(request));
          __Scheduler_rawSpawn(sendToApp(__HttpClient_Done));
        });
      });

      kernelRequest.__$request.end(() => {
        return callback(__Scheduler_succeed({}));
      });
    });
  },
);

var _HttpClient_abort = function (kernelRequest) {
  return __Scheduler_binding(function (callback) {
    if (!kernelRequest.__$request.writableEnded) {
      kernelRequest.__$request.destroy(_HttpClient_CustomAbortError);
    } else if (
      kernelRequest.__$response &&
      kernelRequest.__$response.complete === false
    ) {
      kernelRequest.__$response.destroy(_HttpClient_CustomAbortError);
    }

    return callback(__Scheduler_succeed({}));
  });
};

// HELPERS

var _HttpClient_dictToObject = F3(function (key, value, obj) {
  obj[key] = value;
  return obj;
});

var _HttpClient_extractRequestBody = function (config) {
  switch (config.__$bodyType) {
    case "EMPTY":
      return null;
    case "STRING":
      return config.__$body.a;
    case "BYTES":
      return _HttpClient_prepBytes(config.__$body.a);
    case "STREAM":
      return config.__$body.a;
  }
};

var _HttpClient_prepBytes = function (bytes) {
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
};

var _HttpClient_CustomAbortError = new Error();

var _HttpClient_CustomTimeoutError = new Error();

var _HttpClient_formatResponseLegacy = function (res, data) {
  // See `_Node_objToDict`: a constrained binding is not callable from here.
  let headerPairs = [];
  for (const [key, value] of Object.entries(res.headersDistinct)) {
    headerPairs.push({ __$key: key.toLowerCase(), __$value: value });
  }
  let headerDict = __Dict_fromStringPairs(headerPairs);

  return {
    __$statusCode: res.statusCode,
    __$statusText: res.statusMessage,
    __$headers: headerDict,
    __$data: data,
  };
};
