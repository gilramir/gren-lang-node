/*

import Gren.Kernel.Scheduler exposing (rawSpawn)
import WebSocketServer exposing (TextMessage, BinaryMessage)
import Platform exposing (sendToApp)

*/

var _WebSocketServer_nextConnectionId = 0;

// Initialize the handler storage on a server object and attach the server-level
// "connection" listener exactly once. Per-client handlers delegate to the current
// handler references stored on the server object, so when onEffects updates the
// handlers, existing long-lived connections automatically use the new handlers.
function _WebSocketServer_ensureListenersAttached(server) {
  if (server.__grenListenersAttached) {
    return;
  }
  server.__grenListenersAttached = true;
  server.__grenConnectionHandlers = [];
  server.__grenCloseHandlers = [];

  server.on("connection", function (client) {
    var connId = _WebSocketServer_nextConnectionId++;

    // Create a ReadableStream that surfaces incoming messages for this
    // connection. The controller is retained on the client so the per-event
    // closures below can enqueue messages and close/error the stream when the
    // connection ends. The stream is exposed to the app via
    // WebSocketServer.Connection.readable, and read using the Stream module.
    client.__grenStreamClosed = false;
    var messageStream = new ReadableStream({
      start: function (controller) {
        client.__grenStreamController = controller;
      },
    });

    // Plain keys, not `__$` fields: the externs in src/Ext/WebSocketServer.js
    // read these, and --optimize would rename a field under them.
    var connection = {
      id: connId,
      client: client,
      readable: messageStream,
    };

    // Store the Connection object on the client instance so that close/error
    // handlers can retrieve it without a separate lookup map.
    client.__grenConnection = connection;

    // Notify the app of the new connection, if any handlers are registered.
    var connHandlers = server.__grenConnectionHandlers;
    for (var i = 0; i < connHandlers.length; i++) {
      __Scheduler_rawSpawn(
        A2(
          __Platform_sendToApp,
          connHandlers[i].router,
          connHandlers[i].handler(connection),
        ),
      );
    }

    // Feed incoming messages into the connection's stream.
    client.on("message", function (data, isBinary) {
      if (client.__grenStreamClosed) return;

      var msg = isBinary
        ? __WebSocketServer_BinaryMessage(
            new DataView(data.buffer, data.byteOffset, data.byteLength),
          )
        : __WebSocketServer_TextMessage(data.toString());

      client.__grenStreamController.enqueue(msg);
    });

    client.on("close", function (code, reason) {
      // Close the message stream so readers observe end-of-stream.
      if (!client.__grenStreamClosed) {
        client.__grenStreamClosed = true;
        try {
          client.__grenStreamController.close();
        } catch (e) {
          // Controller may already be closed or errored; safe to ignore.
        }
      }

      var handlers = server.__grenCloseHandlers;
      for (var i = 0; i < handlers.length; i++) {
        __Scheduler_rawSpawn(
          A2(
            __Platform_sendToApp,
            handlers[i].router,
            A2(handlers[i].handler, client.__grenConnection, {
              __$code: code,
              __$reason: reason.toString(),
            }),
          ),
        );
      }
    });

    client.on("error", function (err) {
      // Error the message stream so active readers stop. There is no separate
      // error subscription: callers observe this as Stream.Cancelled <message>.
      if (!client.__grenStreamClosed) {
        client.__grenStreamClosed = true;
        try {
          client.__grenStreamController.error(err.message);
        } catch (e) {
          // Controller may already be closed or errored; safe to ignore.
        }
      }
    });
  });
}

// Clear all stored handler references for a server. Called once per server
// at the start of each onEffects cycle, before re-adding current handlers.
var _WebSocketServer_clearHandlers = function (server) {
  _WebSocketServer_ensureListenersAttached(server);
  server.__grenConnectionHandlers = [];
  server.__grenCloseHandlers = [];
};

var _WebSocketServer_setConnectionHandler = F3(
  function (server, router, handler) {
    _WebSocketServer_ensureListenersAttached(server);
    server.__grenConnectionHandlers.push({ router: router, handler: handler });
  },
);

var _WebSocketServer_setCloseHandler = F3(function (server, router, handler) {
  _WebSocketServer_ensureListenersAttached(server);
  server.__grenCloseHandlers.push({ router: router, handler: handler });
});
