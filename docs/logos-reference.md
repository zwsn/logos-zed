# Logos Reference

This file preserves the directive reference that originally powered hover text in the VS Code extension.

## `%ctor`

Generate an anonymous constructor of default priority.

```logos
%ctor {
	/* body */
}
```

This runs after the binary is loaded into memory.

## `%dtor`

Generate an anonymous deconstructor of default priority.

```logos
%dtor {
	/* body */
}
```

This runs before the binary is unloaded from memory.

## `%group`

Create a named hook group for conditional initialization or code organization.

```logos
%group GroupName
/* %hooks */
%end
```

## `%hook`

Open a hook block for the named class.

```logos
%hook ClassName
/* objc methods */
%end
```

## `%new`

Add a new method to a hooked class or subclass.

```logos
%new
- (void)handleTapGesture:(UITapGestureRecognizer *)gestureRecognizer {
	NSLog(@"Tap: %@", gestureRecognizer);
}
```

You can also provide an explicit type encoding:

```logos
%new(signature)
```

## `%subclass`

Generate a subclass at runtime.

```logos
%subclass ClassName : Superclass
%property (nonatomic, retain) NSString *someValue;
%end
```

## `%property`

Add a property inside `%hook` or `%subclass`.

```logos
%property (nonatomic|assign|retain|copy|weak|strong|getter=...|setter=...) Type name;
```

## `%end`

Close a `%group`, `%hook`, or `%subclass` block.

```logos
%end
```

## `%init`

Initialize hook groups.

```logos
%init;
%init([ClassName=expr, ...]);
%init(GroupName[, [+|-]ClassName=expr, ...]);
```

## `%c`

Resolve a class or metaclass at runtime.

```logos
%c(ClassName)
%c(+ClassName)
```

## `%orig`

Call the original hooked function or method.

```logos
%orig
%orig(args, ...)
&%orig
```

## `%log`

Dump method arguments to syslog.

```logos
%log;
%log((type)expr, ...);
```
