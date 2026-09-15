// WebSocketServer's externs (m1b-extern.md §H8 step 5). Accepting connections
// and delivering their events are its effect manager's, and stay kernel code
// until item 4.
//
// A connection is built by that kernel code, so it reaches these externs as
// the kernel's object, at a type variable (D200). The kernel keeps the three
// things they read under plain keys, `id`, `client` and `readable`, which
// --optimize does not rename.

function createServer(makeError, host, port, succeed, fail) {
  var WebSocket = require("ws");
  var server = new WebSocket.Server({ host: host, port: port });

  server.on("error", function (e) {
    fail(makeError(e.code || "UNKNOWN", e.message));
  });

  server.on("listening", function () {
    succeed(server);
  });
}

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
