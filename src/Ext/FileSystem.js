// FileSystem's and FileSystem.FileHandle's externs (m1b-extern.md §H8 step
// 5). Watching a path is a subscription and stays kernel code until item 4.
//
// A path crosses as the string node's own `path` would format, and comes back
// as one for Geng to parse. A file handle is Geng's record of its path and its
// descriptor, so only the descriptor crosses. Every failure is built by the
// `makeError` Geng passes first, which knows the path the error is about; it
// is handed node's `code` and `message`.

var fs = require("node:fs");
var bufferNs = require("node:buffer");
var process = require("node:process");
var path = require("node:path");
var os = require("node:os");
var stream = require("node:stream");

function isWindows() {
  return process.platform === "win32";
}

function toBytes(buffer, length) {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, length);
}

// The usual shape: one call with a node callback, and nothing to answer.
function done(makeError, succeed, fail) {
  return function (err) {
    if (err != null) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed();
    }
  };
}

// HANDLES

function open(makeError, access, pathString, succeed, fail) {
  fs.open(pathString, access, function (err, fd) {
    if (err != null) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed(fd);
    }
  });
}

function close(makeError, fd, succeed, fail) {
  fs.close(fd, done(makeError, succeed, fail));
}

function readFromOffset(makeError, fd, offset, length, succeed, fail) {
  var requestedLength =
    length < 0 || length > bufferNs.constants.MAX_LENGTH
      ? bufferNs.constants.MAX_LENGTH
      : length;

  // `Number` because the arithmetic below is a Number's; the offset is an
  // `Int64`, so a `BigInt` here (D74).
  var fileOffset = offset < 0 ? 0 : Number(offset);

  var initialBufferSize =
    requestedLength === bufferNs.constants.MAX_LENGTH
      ? 16 * 1024
      : requestedLength;
  var buffer = Buffer.allocUnsafe(initialBufferSize);

  readHelper(
    makeError,
    fd,
    buffer,
    0,
    fileOffset,
    buffer.byteLength,
    requestedLength,
    succeed,
    fail,
  );
}

function readHelper(
  makeError,
  fd,
  buffer,
  bufferOffset,
  fileOffset,
  maxReadLength,
  requestedReadLength,
  succeed,
  fail,
) {
  fs.read(
    fd,
    buffer,
    bufferOffset,
    maxReadLength,
    fileOffset,
    function (err, bytesRead, _buff) {
      if (err != null) {
        fail(makeError(err.code || "", err.message || ""));
        return;
      }

      var newBufferOffset = bufferOffset + bytesRead;

      if (bytesRead === 0 || newBufferOffset >= requestedReadLength) {
        succeed(toBytes(buffer, newBufferOffset));
        return;
      }

      var newMaxReadLength = maxReadLength - bytesRead;
      if (newMaxReadLength <= 0) {
        var oldBuffer = buffer;
        buffer = Buffer.allocUnsafe(oldBuffer.byteLength * 1.5);
        oldBuffer.copy(buffer);

        newMaxReadLength = buffer.byteLength - oldBuffer.byteLength;
      }

      readHelper(
        makeError,
        fd,
        buffer,
        newBufferOffset,
        fileOffset + bytesRead,
        newMaxReadLength,
        requestedReadLength,
        succeed,
        fail,
      );
    },
  );
}

// `Number` because `fs.write`'s `position` is a Number and the loop adds to
// it; an offset past 2^53 is nine petabytes into a file. The offset used to be
// ignored (node#63); the fork's fix is kept.
function writeFromOffset(makeError, fd, offset, bytes, succeed, fail) {
  writeHelper(
    makeError,
    fd,
    bytes,
    0,
    bytes.byteLength,
    Number(offset),
    succeed,
    fail,
  );
}

function writeHelper(
  makeError,
  fd,
  buffer,
  bufferOffset,
  length,
  fileOffset,
  succeed,
  fail,
) {
  fs.write(
    fd,
    buffer,
    bufferOffset,
    length,
    fileOffset,
    function (err, bytesWritten, _buffer) {
      if (err != null) {
        fail(makeError(err.code || "", err.message || ""));
        return;
      }

      if (bytesWritten === length) {
        succeed();
        return;
      }

      writeHelper(
        makeError,
        fd,
        buffer,
        bufferOffset + bytesWritten,
        length - bytesWritten,
        fileOffset + bytesWritten,
        succeed,
        fail,
      );
    },
  );
}

function fchmod(makeError, mode, fd, succeed, fail) {
  fs.fchmod(fd, mode, done(makeError, succeed, fail));
}

function fchown(makeError, userID, groupID, fd, succeed, fail) {
  fs.fchown(fd, userID, groupID, done(makeError, succeed, fail));
}

function fdatasync(makeError, fd, succeed, fail) {
  fs.fdatasync(fd, done(makeError, succeed, fail));
}

function fsync(makeError, fd, succeed, fail) {
  fs.fsync(fd, done(makeError, succeed, fail));
}

// `len` is an `Int64`, so a `BigInt` (D74); node wants a Number.
function ftruncate(makeError, len, fd, succeed, fail) {
  fs.ftruncate(fd, Number(len), done(makeError, succeed, fail));
}

function futimes(makeError, atime, mtime, fd, succeed, fail) {
  fs.futimes(fd, Number(atime), Number(mtime), done(makeError, succeed, fail));
}

function fstat(makeMetadata, makeError, fd, succeed, fail) {
  fs.fstat(fd, function (err, stats) {
    if (err) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed(metadata(makeMetadata, stats));
    }
  });
}

// METADATA

// The entity type as an index: File, Directory, Pipe, Socket, Symlink, Device,
// in the order the kernel tested them.
function entityKind(entry) {
  if (entry.isFile()) {
    return 0;
  } else if (entry.isDirectory()) {
    return 1;
  } else if (entry.isFIFO()) {
    return 2;
  } else if (entry.isSocket()) {
    return 3;
  } else if (entry.isSymbolicLink()) {
    return 4;
  } else {
    return 5;
  }
}

// Times are whole milliseconds, which are safe integers and become `Int64`s at
// the boundary.
function metadata(makeMetadata, stats) {
  return makeMetadata(
    entityKind(stats),
    stats.dev,
    stats.uid,
    stats.gid,
    stats.size,
    stats.blksize,
    stats.blocks,
    Math.floor(stats.atimeMs),
    Math.floor(stats.mtimeMs),
    Math.floor(stats.ctimeMs),
    Math.floor(stats.birthtimeMs),
  );
}

function stat(makeMetadata, makeError, pathString, succeed, fail) {
  fs.stat(pathString, function (err, stats) {
    if (err) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed(metadata(makeMetadata, stats));
    }
  });
}

function lstat(makeMetadata, makeError, pathString, succeed, fail) {
  fs.lstat(pathString, function (err, stats) {
    if (err) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed(metadata(makeMetadata, stats));
    }
  });
}

// PATHS

function access(makeError, read, write, execute, pathString, succeed, fail) {
  var mode = fs.constants.F_OK;
  if (read) {
    mode = mode | fs.constants.R_OK;
  }
  if (write) {
    mode = mode | fs.constants.W_OK;
  }
  if (execute) {
    mode = mode | fs.constants.X_OK;
  }
  fs.access(pathString, mode, done(makeError, succeed, fail));
}

function appendFile(makeError, data, pathString, succeed, fail) {
  fs.appendFile(pathString, data, done(makeError, succeed, fail));
}

function chmod(makeError, mode, pathString, succeed, fail) {
  fs.chmod(pathString, mode, done(makeError, succeed, fail));
}

function chown(makeError, userID, groupID, pathString, succeed, fail) {
  fs.chown(pathString, userID, groupID, done(makeError, succeed, fail));
}

function lchown(makeError, userID, groupID, pathString, succeed, fail) {
  fs.lchown(pathString, userID, groupID, done(makeError, succeed, fail));
}

function copyFile(makeError, src, dest, succeed, fail) {
  fs.copyFile(src, dest, 0, done(makeError, succeed, fail));
}

function link(makeError, src, dest, succeed, fail) {
  fs.link(src, dest, done(makeError, succeed, fail));
}

function symlink(makeError, src, dest, succeed, fail) {
  fs.symlink(src, dest, done(makeError, succeed, fail));
}

function unlink(makeError, pathString, succeed, fail) {
  fs.unlink(pathString, done(makeError, succeed, fail));
}

function rename(makeError, oldPath, newPath, succeed, fail) {
  fs.rename(oldPath, newPath, done(makeError, succeed, fail));
}

function remove(makeError, recursive, pathString, succeed, fail) {
  fs.rm(pathString, { recursive: recursive }, done(makeError, succeed, fail));
}

function makeDirectory(makeError, recursive, pathString, succeed, fail) {
  fs.mkdir(
    pathString,
    { recursive: recursive },
    done(makeError, succeed, fail),
  );
}

// Names and entity kinds as two arrays in the same order.
function listDirectory(build, makeError, pathString, succeed, fail) {
  fs.readdir(pathString, { withFileTypes: true }, function (err, content) {
    if (err != null) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed(
        build(
          content.map((f) => f.name),
          content.map(entityKind),
        ),
      );
    }
  });
}

// The error is about the directory it tried to make. The kernel passed the
// callback's `dir`, which is undefined on failure, to its path parser, and
// threw inside the callback instead of failing (m1b-extern.md §H16).
function mkdtemp(makeError, prefix, succeed, fail) {
  var template = path.join(os.tmpdir(), prefix);
  fs.mkdtemp(template, function (err, dir) {
    if (err) {
      fail(makeError(template, err.code || "", err.message || ""));
    } else {
      succeed(dir);
    }
  });
}

function readFile(makeError, pathString, succeed, fail) {
  fs.readFile(pathString, function (err, data) {
    if (err) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed(toBytes(data, data.byteLength));
    }
  });
}

function readFileStream(makeError, start, end, pathString, succeed, fail) {
  try {
    var fstream = fs.createReadStream(pathString, {
      start: start,
      end: end === -1 ? undefined : end,
    });
    succeed(stream.Readable.toWeb(fstream));
  } catch (err) {
    fail(makeError(err.code || "", err.message || ""));
  }
}

function readLink(makeError, pathString, succeed, fail) {
  fs.readlink(pathString, function (err, linkedPath) {
    if (err) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed(linkedPath);
    }
  });
}

function realpath(makeError, pathString, succeed, fail) {
  fs.realpath(pathString, function (err, resolvedPath) {
    if (err) {
      fail(makeError(err.code || "", err.message || ""));
    } else {
      succeed(resolvedPath);
    }
  });
}

// `len` is an `Int64`, so a `BigInt` (D74); node wants a Number.
function truncate(makeError, len, pathString, succeed, fail) {
  fs.truncate(pathString, Number(len), done(makeError, succeed, fail));
}

// Seconds since the epoch, as `Int64`s.
function utimes(makeError, atime, mtime, pathString, succeed, fail) {
  fs.utimes(
    pathString,
    Number(atime),
    Number(mtime),
    done(makeError, succeed, fail),
  );
}

function lutimes(makeError, atime, mtime, pathString, succeed, fail) {
  fs.lutimes(
    pathString,
    Number(atime),
    Number(mtime),
    done(makeError, succeed, fail),
  );
}

function writeFile(makeError, data, pathString, succeed, fail) {
  fs.writeFile(pathString, data, done(makeError, succeed, fail));
}

function writeFileStream(makeError, pos, pathString, succeed, fail) {
  try {
    var fstream = fs.createWriteStream(pathString, {
      flags: pos === 0 ? "w" : pos === -1 ? "a" : "r+",
      start: pos <= 0 ? undefined : pos,
    });
    // pos > 0 means the ReplaceFrom option was used, so we keep the first
    // `pos` bytes and replace everything after with the streamed data.
    // `createWriteStream` with "r+" and `start` writes at the offset but
    // does not truncate trailing bytes, so once the stream has drained we
    // truncate the file to the prefix length plus what was written.
    if (pos > 0) {
      fstream.on("finish", function () {
        fs.truncate(
          pathString,
          pos + fstream.bytesWritten,
          (_) => {}, // there is currently no way to propagate an error through a custom Writable
        );
      });
    }
    succeed(stream.Writable.toWeb(fstream));
  } catch (err) {
    fail(makeError(err.code || "", err.message || ""));
  }
}

// DIRECTORIES THE SYSTEM KNOWS

function homeDir(succeed, fail) {
  succeed(os.homedir());
}

function currentWorkingDirectory(succeed, fail) {
  succeed(process.cwd());
}

function tmpDir(succeed, fail) {
  succeed(os.tmpdir());
}

function devNull(succeed, fail) {
  succeed(os.devNull);
}
