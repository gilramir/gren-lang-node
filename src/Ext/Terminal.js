// Terminal's externs (m1b-extern.md §H8 step 5; the resize listener,
// m1b-source.md §SO15).

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

// LISTENING

// Each resize emits the new size into the caller's source (D71), built by the
// Geng function it is handed. Removing it pauses stdout, as the kernel's did.
function onResize(events, build, succeed, fail) {
  var listener = function () {
    events.emit(build(process.stdout.columns ?? 0, process.stdout.rows ?? 0));
  };
  process.stdout.on("resize", listener);
  succeed(listener);
}

function removeListener(listener, succeed, fail) {
  process.stdout.off("resize", listener);
  process.stdout.pause();
  succeed();
}
