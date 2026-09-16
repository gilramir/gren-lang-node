// HttpServer's and HttpServer.Response's externs (m1b-extern.md §H8 step 5;
// listening and responding, m1b-source.md §SO15).

var http = require("node:http");
var stream = require("node:stream");

// The server is a handle (D199). HttpServer.gren takes it out of its `Server`
// before a listener is added to it.
function createServer(makeError, host, port, succeed, fail) {
  const server = http.createServer();
  server.on("error", function (e) {
    fail(makeError(e.code, e.message));
  });
  server.listen(port, host, function () {
    succeed(server);
  });
}

// LISTENING

// Each request is read to its end and emitted into the caller's source (D71),
// built by the Geng function it is handed: the URL, the raw headers as
// alternating names and values, the method, the body and node's response.
// The listener itself is the handle, so removing it removes exactly it.
function onRequest(server, requests, build, succeed, fail) {
  var listener = function (request, response) {
    // May want to support non-http protocols, proxies, and X-Forwarded-For header(s).
    // Note: the `request` here is a node `http.IncomingMessage`, not a `http.ClientRequest`,
    // so we can't just look at `request.protocol`, etc.
    var url = new URL(request.url, `http://${request.headers.host}`);
    var body = [];
    request
      .on("data", function (chunk) {
        body.push(chunk);
      })
      // TODO: Timeouts.
      // Currently, if the request never ends (because of an error, or...?)
      // the server will hang until manually killed.
      .on("end", function () {
        var buffer = Buffer.concat(body);
        requests.emit(
          build(
            url.href,
            request.rawHeaders,
            request.method,
            new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
            response,
          ),
        );
      });
  };
  server.on("request", listener);
  succeed({ server: server, listener: listener });
}

function removeListener(handle, succeed, fail) {
  handle.server.off("request", handle.listener);
  succeed();
}

// RESPONDING

// The task completes once the response is finished or can no longer be, so a
// client that went away does not leave it outstanding.
function respond(response, status, keys, values, body, succeed) {
  response.statusCode = status;
  for (var i = 0; i < keys.length; i++) {
    response.setHeader(keys[i], values[i]);
  }
  stream.finished(response, function () {
    succeed();
  });
  response.end(body);
}

function sendString(response, status, keys, values, body, succeed, fail) {
  respond(response, status, keys, values, body, succeed);
}

function sendBytes(response, status, keys, values, body, succeed, fail) {
  respond(response, status, keys, values, body, succeed);
}
