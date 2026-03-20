const assert = require("node:assert");
const { test } = require("node:test");

const Parser = require("tree-sitter");
const Logos = require(".");

test("can load grammar", () => {
  const parser = new Parser();
  assert.doesNotThrow(() => parser.setLanguage(Logos));
});

test("exports logos-specific node metadata", () => {
  const nodeTypes = Logos.nodeTypeInfo || [];
  assert.ok(nodeTypes.some((nodeType) => nodeType.type === "logos_hook_block"));
  assert.ok(
    nodeTypes.some((nodeType) => nodeType.type === "logos_ctor_definition"),
  );
});
