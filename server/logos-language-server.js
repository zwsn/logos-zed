#!/usr/bin/env node

const { directives, hoverByKey } = require("./logos-data");
const { spawnSync } = require("node:child_process");

const documents = new Map();
let shutdownRequested = false;
let inputBuffer = Buffer.alloc(0);
let workspaceSettings = {};

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  processIncomingMessages();
});

process.stdin.on("end", () => {
  process.exit(0);
});

function processIncomingMessages() {
  while (true) {
    const headerEnd = inputBuffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }

    const headerText = inputBuffer.slice(0, headerEnd).toString("utf8");
    const contentLengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!contentLengthMatch) {
      inputBuffer = Buffer.alloc(0);
      return;
    }

    const contentLength = Number(contentLengthMatch[1]);
    const messageEnd = headerEnd + 4 + contentLength;
    if (inputBuffer.length < messageEnd) {
      return;
    }

    const body = inputBuffer.slice(headerEnd + 4, messageEnd).toString("utf8");
    inputBuffer = inputBuffer.slice(messageEnd);

    try {
      handleMessage(JSON.parse(body));
    } catch (error) {
      logError(`Failed to handle LSP message: ${error.stack || error}`);
    }
  }
}

function handleMessage(message) {
  if (message.method) {
    handleRequestOrNotification(message);
  }
}

function handleRequestOrNotification(message) {
  switch (message.method) {
    case "initialize":
      reply(message.id, {
        capabilities: {
          textDocumentSync: 1,
          hoverProvider: true,
          completionProvider: {
            triggerCharacters: ["%"],
          },
          documentFormattingProvider: true,
        },
        serverInfo: {
          name: "logos-language-server",
          version: "0.1.0",
        },
      });
      return;
    case "initialized":
      notify("workspace/configuration", {
        items: [{ section: "Logos Language Server" }],
      });
      return;
    case "shutdown":
      shutdownRequested = true;
      reply(message.id, null);
      return;
    case "exit":
      process.exit(shutdownRequested ? 0 : 1);
      return;
    case "textDocument/didOpen":
      {
        const { uri, text } = message.params.textDocument;
        documents.set(uri, text);
      }
      return;
    case "textDocument/didChange":
      {
        const { uri } = message.params.textDocument;
        const changes = message.params.contentChanges || [];
        if (changes.length > 0) {
          documents.set(uri, changes[changes.length - 1].text || "");
        }
      }
      return;
    case "textDocument/didClose":
      documents.delete(message.params.textDocument.uri);
      return;
    case "textDocument/completion":
      reply(message.id, handleCompletion(message.params));
      return;
    case "textDocument/hover":
      reply(message.id, handleHover(message.params));
      return;
    case "textDocument/formatting":
      reply(message.id, handleFormatting(message.params));
      return;
    case "workspace/didChangeConfiguration":
      workspaceSettings = message.params.settings || {};
      return;
    case "workspace/configuration":
      if (Object.prototype.hasOwnProperty.call(message, "id")) {
        reply(message.id, [workspaceSettings]);
      }
      return;
    default:
      if (Object.prototype.hasOwnProperty.call(message, "id")) {
        reply(message.id, null);
      }
  }
}

function handleCompletion(params) {
  const text = documents.get(params.textDocument.uri) || "";
  const lineText = getLineText(text, params.position.line);
  const completionContext = getCompletionContext(
    text,
    lineText,
    params.position.line,
    params.position.character,
  );
  if (!completionContext) {
    return [];
  }

  return directives
    .filter((directive) =>
      directive.key.startsWith(completionContext.partialDirective),
    )
    .sort(
      (left, right) =>
        scoreDirective(right, completionContext) -
        scoreDirective(left, completionContext),
    )
    .map((directive) => ({
      label: directive.label,
      kind: directive.kind,
      detail: directive.detail,
      documentation: {
        kind: "markdown",
        value: directive.documentation,
      },
      insertText: directive.insertText,
      insertTextFormat: 2,
    }));
}

function handleHover(params) {
  const text = documents.get(params.textDocument.uri) || "";
  const lineText = getLineText(text, params.position.line);
  const directive = getDirectiveAtPosition(lineText, params.position.character);
  if (!directive) {
    return null;
  }

  const documentation = hoverByKey.get(directive.name);
  if (!documentation) {
    return null;
  }

  return {
    contents: {
      kind: "markdown",
      value: documentation,
    },
    range: {
      start: {
        line: params.position.line,
        character: directive.start,
      },
      end: {
        line: params.position.line,
        character: directive.end,
      },
    },
  };
}

function handleFormatting(params) {
  const uri = params.textDocument.uri;
  const originalText = documents.get(uri) || "";
  let formattedText;
  try {
    formattedText = formatLogosDocument(originalText);
  } catch (error) {
    logError(`Formatting failed: ${error.stack || error}`);
    return [];
  }
  if (formattedText === originalText) {
    return [];
  }

  return [
    {
      range: fullDocumentRange(originalText),
      newText: formattedText,
    },
  ];
}

function getLineText(text, lineNumber) {
  const lines = text.split(/\r?\n/);
  return lines[lineNumber] || "";
}

function getDirectiveAtPosition(lineText, character) {
  const pattern = /%([A-Za-z]+)/g;
  let match;
  while ((match = pattern.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (character >= start && character <= end) {
      return {
        name: match[1],
        start,
        end,
      };
    }
  }
  return null;
}

function getCompletionContext(text, lineText, lineNumber, character) {
  const prefix = lineText.slice(0, character);
  const match = prefix.match(/(?:^|[\s({[;=,:])%([A-Za-z]*)$/);
  if (!match) {
    return null;
  }

  return {
    partialDirective: match[1] || "",
    currentBlock: detectCurrentBlock(text, lineNumber),
    directiveStart: character - (match[1] || "").length - 1,
  };
}

function detectCurrentBlock(text, lineNumber) {
  const lines = text.split(/\r?\n/).slice(0, lineNumber + 1);
  const stack = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^%group\b/.test(trimmed)) {
      stack.push("group");
      continue;
    }
    if (/^%hook\b/.test(trimmed)) {
      stack.push("hook");
      continue;
    }
    if (/^%subclass\b/.test(trimmed)) {
      stack.push("subclass");
      continue;
    }
    if (/^%ctor\b/.test(trimmed)) {
      stack.push("ctor");
      continue;
    }
    if (/^%dtor\b/.test(trimmed)) {
      stack.push("dtor");
      continue;
    }
    if (/^%end\b/.test(trimmed)) {
      stack.pop();
    }
  }
  return stack.at(-1) || "top_level";
}

function scoreDirective(directive, context) {
  let score = 0;
  if (
    !context.partialDirective ||
    directive.key.startsWith(context.partialDirective)
  ) {
    score += 10;
  }

  const block = context.currentBlock;
  if (block === "top_level") {
    if (["ctor", "dtor", "group", "hook", "subclass"].includes(directive.key)) {
      score += 20;
    }
    if (["new", "property", "orig", "log"].includes(directive.key)) {
      score -= 10;
    }
  }

  if (block === "hook" || block === "subclass") {
    if (["new", "property", "orig", "log", "c"].includes(directive.key)) {
      score += 20;
    }
    if (["group", "hook", "subclass", "ctor", "dtor"].includes(directive.key)) {
      score -= 5;
    }
  }

  if (block === "group") {
    if (["hook", "subclass", "ctor", "dtor", "init"].includes(directive.key)) {
      score += 15;
    }
  }

  if (block === "ctor" || block === "dtor") {
    if (["init", "c", "orig", "log"].includes(directive.key)) {
      score += 20;
    }
    if (
      ["hook", "group", "subclass", "property", "new"].includes(directive.key)
    ) {
      score -= 10;
    }
  }

  if (directive.label.includes("(")) {
    score += 1;
  }

  return score;
}

function reply(id, result) {
  if (typeof id === "undefined" || id === null) {
    return;
  }

  send({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function notify(method, params) {
  send({
    jsonrpc: "2.0",
    method,
    params,
  });
}

function send(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}

function logError(message) {
  process.stderr.write(`${message}\n`);
}

function formatLogosDocument(text) {
  const specialFilterList = ["%hook", "%end", "%new", "%group", "%subclass"];
  const filterList = [
    "%property",
    "%config",
    "%hookf",
    "%ctor",
    "%dtor",
    "%init",
    "%c",
    "%orig",
    "%log",
  ];

  const preparedLines = text.split(/\r?\n/).map((line) => {
    let nextLine = line;
    for (const token of filterList) {
      if (nextLine.includes(token)) {
        nextLine = nextLine.replace(
          new RegExp(`%(${escapeRegExp(token.slice(1))})\\b`, "g"),
          "@logosformat$1",
        );
      }
    }
    for (const token of specialFilterList) {
      if (nextLine.includes(token)) {
        nextLine =
          nextLine.replace(
            new RegExp(`%(${escapeRegExp(token.slice(1))})\\b`, "g"),
            "@logosformat$1",
          ) + ";";
      }
    }
    return nextLine;
  });

  const formatterSettings = normalizeFormatterSettings(workspaceSettings);
  const command = formatterSettings.clang_format_path || "clang-format";
  const args = formatterSettings.clang_format_arguments || [
    "--assume-filename",
    "objc",
  ];
  const result = spawnSync(command, args, {
    input: preparedLines.join("\n"),
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`failed to execute ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      result.stderr || `${command} exited with status ${result.status}`,
    );
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => restoreLogosTokens(line, specialFilterList))
    .join("\n");
}

function restoreLogosTokens(line, specialFilterList) {
  if (!line.includes("@logosformat")) {
    return line;
  }

  const restored = line.replace(/@logosformat/g, "%");
  if (specialFilterList.some((token) => restored.includes(token))) {
    return restored.replace(/;/g, "");
  }
  return restored;
}

function normalizeFormatterSettings(settings) {
  if (!settings || typeof settings !== "object") {
    return {};
  }
  if (settings.formatter && typeof settings.formatter === "object") {
    return settings.formatter;
  }
  return settings;
}

function fullDocumentRange(text) {
  const lines = text.split(/\r?\n/);
  const lastLine = lines.length - 1;
  const lastCharacter = lines[lastLine] ? lines[lastLine].length : 0;
  return {
    start: { line: 0, character: 0 },
    end: { line: lastLine, character: lastCharacter },
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
