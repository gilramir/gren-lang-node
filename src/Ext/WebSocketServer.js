// WebSocketServer's externs (m1b-extern.md §H8 step 5; the connection and
// close listeners, m1b-source.md §SO15).
//
// A connection is an object with `id`, `client` and `readable`, under plain
// keys, which --optimize does not rename, and it crosses as a handle (D199).

var _WebSocketServer_nextConnectionId = 0;

// Every connection's message stream is set up when it arrives, so the server
// is given the two constructors of `Message` when it is created, and a
// listener added later only adds itself to the server's set of them.
function createServer(makeError, textMessage, binaryMessage, host, port, succeed, fail) {
  var WebSocket = require("ws");
  var server = new WebSocket.Server({ host: host, port: port });
  var connectionListeners = new Set();
  var closeListeners = new Set();
  server.__grenConnectionListeners = connectionListeners;
  server.__grenCloseListeners = closeListeners;

  server.on("connection", function (client) {
    // A ReadableStream that surfaces this connection's incoming messages,
    // read through the Stream module from WebSocketServer.Connection.readable.
    var streamClosed = false;
    var controller;
    var readable = new ReadableStream({
      start: function (c) {
        controller = c;
      },
    });

    var connection = {
      id: _WebSocketServer_nextConnectionId++,
      client: client,
      readable: readable,
    };

    connectionListeners.forEach(function (l) {
      l.events.emit(l.build(connection));
    });

    client.on("message", function (data, isBinary) {
      if (streamClosed) return;
      controller.enqueue(
        isBinary
          ? binaryMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
          : textMessage(data.toString()),
      );
    });

    client.on("close", function (code, reason) {
      // Close the message stream so readers observe end-of-stream.
      if (!streamClosed) {
        streamClosed = true;
        try {
          controller.close();
        } catch (e) {
          // Controller may already be closed or errored; safe to ignore.
        }
      }
      closeListeners.forEach(function (l) {
        l.events.emit(l.build(connection, code, reason.toString()));
      });
    });

    client.on("error", function (err) {
      // Error the message stream so active readers stop. There is no separate
      // error listener: callers observe this as Stream.Cancelled <message>.
      if (!streamClosed) {
        streamClosed = true;
        try {
          controller.error(err.message);
        } catch (e) {
          // Controller may already be closed or errored; safe to ignore.
        }
      }
    });
  });

  server.on("error", function (e) {
    fail(makeError(e.code || "UNKNOWN", e.message));
  });

  server.on("listening", function () {
    succeed(server);
  });
}

// LISTENING

// A listener is its entry in one of the server's two sets (D71): the caller's
// source and the Geng function that builds the `msg`. Removing it deletes the
// entry, so removing it twice does nothing.
function addListener(set, events, build, succeed) {
  var entry = { events: events, build: build };
  set.add(entry);
  succeed({ set: set, entry: entry });
}

function onConnection(server, events, build, succeed, fail) {
  addListener(server.__grenConnectionListeners, events, build, succeed);
}

function onClose(server, events, build, succeed, fail) {
  addListener(server.__grenCloseListeners, events, build, succeed);
}

function removeListener(handle, succeed, fail) {
  handle.set.delete(handle.entry);
  succeed();
}

// CONNECTIONS

function getConnectionId(connection) {
  return connection.id;
}

function getReadable(connection) {
  return connection.readable;
}

function sendData(makeError, connection, data, succeed, fail) {
  try {
    connection.client.send(data, function (err) {
      if (err) {
        fail(makeError(err.code || "", err.message || ""));
      } else {
        succeed();
      }
    });
  } catch (e) {
    fail(makeError(e.code || "", e.message || ""));
  }
}

function send(makeError, connection, text, succeed, fail) {
  sendData(makeError, connection, text, succeed, fail);
}

function sendBytes(makeError, connection, bytes, succeed, fail) {
  sendData(
    makeError,
    connection,
    Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    succeed,
    fail,
  );
}

function close(makeError, connection, code, reason, succeed, fail) {
  try {
    connection.client.close(code, reason);
    succeed();
  } catch (e) {
    fail(makeError(e.code || "", e.message || ""));
  }
}
