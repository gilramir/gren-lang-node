// HttpClient.send as an extern (m1b-extern.md §H8 step 5). The deprecated
// streaming API, `stream`, `sendChunk`, `startReceive` and `abort`, was its
// effect manager's and is deleted (m1b-source.md §SO16).
//
// One implementation serves four declarations in HttpClient.gren, one per
// shape of response body: text (for a string or JSON), bytes, a stream, and
// none. A response crosses as its status, status text, header names and header
// values, and the body, all handed to the Geng function that builds it. A
// failure crosses as a kind and a detail, except a bad status, which carries a
// whole response with its body as bytes.

function toBytes(arrayBuffer) {
  return new Uint8Array(arrayBuffer);
}

// fetch combines repeated headers with ", ", except set-cookie, which `entries`
// gives once per cookie; each name's values are collected into one array. The
// kernel put fetch's string where the type says `Array String`
// (m1b-extern.md §H16.5).
function headersOf(res) {
  var names = [];
  var values = [];
  var index = {};
  for (const [key, value] of res.headers.entries()) {
    var name = key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(index, name)) {
      values[index[name]].push(value);
    } else {
      index[name] = names.length;
      names.push(name);
      values.push([value]);
    }
  }
  return { names: names, values: values };
}

function respond(makeResponse, res, body) {
  var headers = headersOf(res);
  return makeResponse(
    res.status,
    res.statusText,
    headers.names,
    headers.values,
    body,
  );
}

function request(
  expectType,
  makeResponse,
  makeBadStatus,
  makeError,
  method,
  url,
  headerNames,
  headerValues,
  bodyType,
  bodyText,
  bodyBytes,
  bodyStream,
  timeoutMs,
  succeed,
  fail,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("ERR_TIMEOUT"), timeoutMs);

  // This makes sure a left over setTimeout doesn't keep node running.
  function succeedWith(value) {
    clearTimeout(timeout);
    succeed(value);
  }

  function failWith(value) {
    clearTimeout(timeout);
    fail(value);
  }

  var headers = {};
  for (var i = 0; i < headerNames.length; i++) {
    headers[headerNames[i]] = headerValues[i];
  }

  var body =
    bodyType === "STRING"
      ? bodyText
      : bodyType === "BYTES"
        ? bodyBytes
        : bodyType === "STREAM"
          ? bodyStream
          : null;

  fetch(url, {
    method: method,
    headers: headers,
    duplex: "half",
    body: body,
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) {
        return res.arrayBuffer().then((b) => {
          var headers = headersOf(res);
          return failWith(
            makeBadStatus(
              res.status,
              res.statusText,
              headers.names,
              headers.values,
              toBytes(b),
            ),
          );
        });
      }

      switch (expectType) {
        case "NOTHING":
          return res.blob().then((b) => {
            if (b.size === 0) {
              return succeedWith(respond(makeResponse, res, {}));
            } else {
              return failWith(
                makeError(
                  "UNEXPECTED_BODY",
                  "Received response body where I expected none.",
                ),
              );
            }
          });

        case "ANYTHING":
          return succeedWith(respond(makeResponse, res, {}));

        case "STRING":
          return res.text().then((t) => {
            return succeedWith(respond(makeResponse, res, t));
          });

        // The text is parsed here, so that a body that is not JSON fails as it
        // did when this was `res.json()`; Geng decodes the text.
        case "JSON":
          return res.text().then((t) => {
            JSON.parse(t);
            return succeedWith(respond(makeResponse, res, t));
          });

        case "BYTES":
          return res.arrayBuffer().then((b) => {
            return succeedWith(respond(makeResponse, res, toBytes(b)));
          });

        case "STREAM":
          return succeedWith(respond(makeResponse, res, res.body));
      }
    })
    .catch((e) => {
      if (controller.signal.reason === "ERR_TIMEOUT") {
        return failWith(makeError("TIMEOUT", ""));
      } else if (e.code === "ERR_INVALID_HTTP_TOKEN") {
        return failWith(makeError("BAD_HEADERS", ""));
      } else if (e.code === "ERR_INVALID_URL") {
        return failWith(makeError("BAD_URL", url));
      } else {
        return failWith(
          makeError("UNKNOWN", "problem with request: " + e.message),
        );
      }
    });

  return () => {
    controller.abort();
  };
}

function believe(x) {
  return x;
}
