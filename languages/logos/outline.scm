(logos_hook_block
  directive: (logos_hook_directive_line) @name) @item

(logos_group_block
  directive: (logos_group_directive_line) @name) @item

(logos_subclass_block
  directive: (logos_subclass_directive_line) @name) @item

(logos_ctor_definition
  directive: (logos_ctor_directive) @context) @item

(logos_dtor_definition
  directive: (logos_dtor_directive) @context) @item

(method_definition
  ["+" "-"] @context
  (identifier) @name) @item
