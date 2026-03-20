const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const localBuild = path.join(
  root,
  "build",
  "Release",
  "tree_sitter_logos_binding.node",
);

if (fs.existsSync(localBuild)) {
  module.exports = require(localBuild);
} else {
  module.exports =
    typeof process.versions.bun === "string"
      ? // Support `bun build --compile` by being statically analyzable enough to find the .node file at build-time
        require(
          `../../prebuilds/${process.platform}-${process.arch}/tree-sitter-logos.node`,
        )
      : require("node-gyp-build")(root);
}

try {
  module.exports.nodeTypeInfo = require("../../src/node-types.json");
} catch (_) {}
