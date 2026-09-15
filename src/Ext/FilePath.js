// FileSystem.Path's externs (m1b-extern.md §H8 step 5). A path crosses as its
// four parts: a parse hands them to the Geng function that builds the record,
// and a format is handed them by Geng (D192).

var path = require("node:path");

function parse(pathMod, build, str) {
  const result = pathMod.parse(pathMod.normalize(str));

  const root = result.root;

  let dirStr = result.dir.startsWith(root)
    ? result.dir.substring(root.length)
    : result.dir;

  if (str.startsWith(`.${path.sep}`)) {
    dirStr = `.${path.sep}` + dirStr;
  }

  const filename =
    result.name === "." && result.ext.length === 0 ? "" : result.name;

  return build(
    result.root,
    dirStr === ""
      ? []
      : dirStr.split(pathMod.sep).filter((dir) => dir.length > 0),
    filename,
    result.ext.length > 0 ? result.ext.substring(1) : "",
  );
}

function fromPosix(build, str) {
  return parse(path.posix, build, str);
}

function fromWin32(build, str) {
  return parse(path.win32, build, str);
}

function isEmpty(root, directory, filename, extension) {
  return (
    root === "" &&
    directory.length === 0 &&
    filename === "" &&
    extension === ""
  );
}

function format(pathMod, root, directory, filename, extension) {
  const name = extension.length > 0 ? filename + "." + extension : filename;
  const parts = name === "" ? directory : directory.concat(name);
  return root + parts.join(pathMod.sep);
}

function toPosix(root, directory, filename, extension) {
  if (isEmpty(root, directory, filename, extension)) {
    return ".";
  }
  if (root !== "" && root !== "/") {
    root = "/";
  }
  return format(path.posix, root, directory, filename, extension);
}

function toWin32(root, directory, filename, extension) {
  if (isEmpty(root, directory, filename, extension)) {
    return ".";
  }
  return format(path.win32, root, directory, filename, extension);
}
