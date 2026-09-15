// Terminal's externs (m1b-extern.md §H8 step 5). Its resize listener is a
// subscription and stays kernel code until Source (item 4).

var process = require("node:process");

// The kernel put `undefined` into `isTTY : Bool` when stdout was not a
// terminal, from `&&`, and into `columns` and `rows : Int`. A wrapper checks
// those types now, so the values are made what the types say.
function init(build, succeed, fail) {
  succeed(
    build(
      Boolean(process.stdout.isTTY && process.stdin.isTTY),
      process.stdout.getColorDepth ? process.stdout.getColorDepth() : 0,
      process.stdout.columns ?? 0,
      process.stdout.rows ?? 0,
    ),
  );
}

function setStdInRawMode(toggle, succeed, fail) {
  process.stdin.setRawMode(toggle);
  succeed();
}

function setProcessTitle(title, succeed, fail) {
  process.title = title;
  succeed();
}
