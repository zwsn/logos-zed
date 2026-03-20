[
  (logos_hook_block)
  (logos_group_block)
  (logos_subclass_block)
] @class.around

[
  (logos_hook_member)
  (logos_group_member)
  (logos_subclass_member)
] @class.inside

(logos_ctor_definition
  (compound_statement) @function.inside) @function.around

(logos_dtor_definition
  (compound_statement) @function.inside) @function.around

(method_definition
  (compound_statement) @function.inside) @function.around
