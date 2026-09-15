// HttpServer's one extern (m1b-extern.md §H8 step 5). Listening for requests
// and writing responses are its effect manager's, and stay kernel code until
// item 4.

var http = require("node:http");

// The server is a handle (D199). HttpServer.gren takes it out of its `Server`
// before the kernel's listener code is handed it.
function createServer(makeError, host, port, succeed, fail) {
  const server = http.createServer();
  server.on("error", function (e) {
    fail(makeError(e.code, e.message));
  });
  server.listen(port, host, function () {
    succeed(server);
  });
}
