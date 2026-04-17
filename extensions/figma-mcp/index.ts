import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type TSchema } from "@sinclair/typebox";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

type JsonObject = Record<string, unknown>;

type ListedMcpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: {
    type?: string;
    description?: string;
    properties?: Record<string, JsonObject>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

type RegisteredToolInfo = {
  piToolName: string;
  mcpToolName: string;
};

const DEFAULT_FIGMA_MCP_URL = "http://127.0.0.1:3845/mcp";
const CONNECTION_STATUS_KEY = "figma-mcp";
const SKILL_HINT =
  "Figma desktop MCP is available. For current selection, use Figma tools directly. For a shared design, the user can paste a Figma frame/layer URL.";

type NotifyLevel = "info" | "warning" | "error";

type UiLike = {
  notify(message: string, level?: NotifyLevel): void;
  setStatus(key: string, value: string): void;
  setWidget?(key: string, lines: string[]): void;
};

function getServerUrl(): string {
  return process.env.FIGMA_MCP_URL?.trim() || DEFAULT_FIGMA_MCP_URL;
}

function toPiToolName(mcpToolName: string): string {
  const normalized = mcpToolName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.startsWith("figma_") ? normalized : `figma_${normalized}`;
}

function toLabel(tool: ListedMcpTool): string {
  const source = tool.title?.trim() || tool.name;
  return source
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(text: string, max = 12000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n… truncated …`;
}

function summarizeSchema(schema: ListedMcpTool["inputSchema"] | undefined): string | undefined {
  if (!schema?.properties || Object.keys(schema.properties).length === 0) {
    return undefined;
  }

  const required = new Set(schema.required ?? []);
  const lines = Object.entries(schema.properties).map(([name, value]) => {
    const type = typeof value.type === "string" ? value.type : "any";
    const description = typeof value.description === "string" ? value.description : "";
    const suffix = required.has(name) ? "required" : "optional";
    return `- ${name}: ${type} (${suffix})${description ? ` — ${description}` : ""}`;
  });

  return lines.join("\n");
}

function schemaToTypeBox(schema: JsonObject | undefined): TSchema {
  if (!schema || typeof schema !== "object") {
    return Type.Record(Type.String(), Type.Any());
  }

  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.filter((value): value is string | number | boolean => {
        const type = typeof value;
        return type === "string" || type === "number" || type === "boolean";
      })
    : undefined;

  if (enumValues && enumValues.length > 0) {
    return Type.Union(enumValues.map((value) => Type.Literal(value)));
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return Type.Union(schema.oneOf.map((entry) => schemaToTypeBox((entry ?? {}) as JsonObject)));
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return Type.Union(schema.anyOf.map((entry) => schemaToTypeBox((entry ?? {}) as JsonObject)));
  }

  switch (schema.type) {
    case "string":
      return Type.String(schema.description ? { description: String(schema.description) } : {});
    case "integer":
      return Type.Integer(schema.description ? { description: String(schema.description) } : {});
    case "number":
      return Type.Number(schema.description ? { description: String(schema.description) } : {});
    case "boolean":
      return Type.Boolean(schema.description ? { description: String(schema.description) } : {});
    case "array": {
      const items = schema.items && typeof schema.items === "object" ? (schema.items as JsonObject) : undefined;
      return Type.Array(schemaToTypeBox(items), schema.description ? { description: String(schema.description) } : {});
    }
    case "object": {
      const properties = schema.properties && typeof schema.properties === "object"
        ? (schema.properties as Record<string, JsonObject>)
        : {};
      const required = new Set(Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : []);

      const mappedProperties: Record<string, TSchema> = {};
      for (const [key, value] of Object.entries(properties)) {
        const mapped = schemaToTypeBox(value);
        mappedProperties[key] = required.has(key) ? mapped : Type.Optional(mapped);
      }

      return Type.Object(mappedProperties, {
        additionalProperties: schema.additionalProperties !== false,
        description: typeof schema.description === "string" ? schema.description : undefined,
      });
    }
    default:
      return Type.Any();
  }
}

function summarizeCallResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return stringify(result);
  }

  const value = result as {
    isError?: boolean;
    content?: Array<Record<string, unknown>>;
    structuredContent?: unknown;
  };

  const blocks: string[] = [];

  for (const item of value.content ?? []) {
    if (item.type === "text" && typeof item.text === "string") {
      blocks.push(item.text);
      continue;
    }

    if (item.type === "image") {
      const mimeType = typeof item.mimeType === "string" ? item.mimeType : "unknown";
      blocks.push(`[image content: ${mimeType}]`);
      continue;
    }

    if (item.type === "resource" && item.resource && typeof item.resource === "object") {
      const resource = item.resource as { uri?: unknown; text?: unknown; mimeType?: unknown };
      const header = `[resource: ${typeof resource.uri === "string" ? resource.uri : "embedded"}${typeof resource.mimeType === "string" ? `, ${resource.mimeType}` : ""}]`;
      const body = typeof resource.text === "string" ? `\n${resource.text}` : "";
      blocks.push(`${header}${body}`);
      continue;
    }

    blocks.push(stringify(item));
  }

  if (value.structuredContent !== undefined) {
    blocks.push(`Structured content:\n${stringify(value.structuredContent)}`);
  }

  const text = blocks.length > 0 ? blocks.join("\n\n") : stringify(result);
  return value.isError ? `Figma MCP returned an error:\n\n${text}` : text;
}

function getPromptGuidelines(mcpToolName: string): string[] {
  switch (mcpToolName) {
    case "get_design_context":
      return [
        "Use this when the user wants implementation-ready context from a Figma selection, frame, or layer.",
        "For desktop Figma, current-selection prompting works well. If the user shares a Figma URL, pass it through in the tool arguments when supported.",
      ];
    case "get_metadata":
      return [
        "Use this first for very large or complex Figma frames before requesting full design context.",
      ];
    case "get_screenshot":
      return [
        "Use this when a screenshot of the selected frame or node is more useful than code-oriented design context.",
      ];
    default:
      return ["Use this tool when the user asks to inspect or read Figma designs through the desktop MCP server."];
  }
}

function buildToolDescription(tool: ListedMcpTool): string {
  const parts = [tool.description?.trim() || `Figma MCP tool: ${tool.name}`];
  const schemaSummary = summarizeSchema(tool.inputSchema);
  if (schemaSummary) {
    parts.push(`Arguments:\n${schemaSummary}`);
  }
  return parts.join("\n\n");
}

function createToolInfo(tool: ListedMcpTool): RegisteredToolInfo {
  return {
    piToolName: toPiToolName(tool.name),
    mcpToolName: tool.name,
  };
}

function getToolLines(toolInfoByPiName: Map<string, RegisteredToolInfo>): string[] {
  if (toolInfoByPiName.size === 0) {
    return ["No Figma MCP tools discovered yet."];
  }

  return Array.from(toolInfoByPiName.values())
    .sort((a, b) => a.piToolName.localeCompare(b.piToolName))
    .map((tool) => `${tool.piToolName} → ${tool.mcpToolName}`);
}

export default function figmaMcpExtension(pi: ExtensionAPI) {
  let client: Client | undefined;
  let transport: StreamableHTTPClientTransport | undefined;
  let connectPromise: Promise<void> | undefined;

  const registeredPiToolNames = new Set<string>();
  const toolInfoByPiName = new Map<string, RegisteredToolInfo>();

  function setStatus(text: string, ctx?: { ui: UiLike }): void {
    ctx?.ui.setStatus(CONNECTION_STATUS_KEY, text);
  }

  async function disconnect(): Promise<void> {
    const activeTransport = transport;
    client = undefined;
    transport = undefined;

    if (activeTransport) {
      await activeTransport.close();
    }
  }

  function registerTool(tool: ListedMcpTool): void {
    const info = createToolInfo(tool);
    toolInfoByPiName.set(info.piToolName, info);

    if (registeredPiToolNames.has(info.piToolName)) {
      return;
    }

    registeredPiToolNames.add(info.piToolName);

    pi.registerTool({
      name: info.piToolName,
      label: toLabel(tool),
      description: buildToolDescription(tool),
      promptSnippet: `Read from Figma desktop MCP with tool ${tool.name}`,
      promptGuidelines: getPromptGuidelines(tool.name),
      parameters: schemaToTypeBox(tool.inputSchema as JsonObject | undefined),
      async execute(_toolCallId, params, _signal, onUpdate, ctx) {
        onUpdate?.({
          content: [{ type: "text", text: `Calling Figma MCP tool: ${tool.name}...` }],
          details: { serverUrl: getServerUrl(), mcpTool: tool.name },
        });

        const activeClient = await ensureConnected(ctx);
        const result = await activeClient.callTool({
          name: tool.name,
          arguments: (params ?? {}) as JsonObject,
        });

        return {
          content: [{ type: "text", text: truncate(summarizeCallResult(result)) }],
          details: {
            serverUrl: getServerUrl(),
            mcpTool: tool.name,
            raw: result,
          },
          isError: Boolean((result as { isError?: boolean }).isError),
        };
      },
    });
  }

  async function discoverTools(ctx?: { ui: UiLike }): Promise<number> {
    if (!client) {
      throw new Error("Figma MCP client is not connected.");
    }

    const listed = await client.listTools();
    for (const tool of listed.tools as ListedMcpTool[]) {
      registerTool(tool);
    }

    setStatus(`figma mcp: ${listed.tools.length} tools`, ctx);
    return listed.tools.length;
  }

  async function connect(ctx?: { ui: UiLike }): Promise<void> {
    await disconnect();

    const serverUrl = getServerUrl();
    const nextClient = new Client({
      name: "pi-figma-mcp",
      version: "0.1.0",
    });

    const nextTransport = new StreamableHTTPClientTransport(new URL(serverUrl));
    await nextClient.connect(nextTransport);

    client = nextClient;
    transport = nextTransport;

    const count = await discoverTools(ctx);
    ctx?.ui.notify(`Connected to Figma desktop MCP (${count} tools)`, "info");
  }

  async function ensureConnected(ctx?: { ui: UiLike }): Promise<Client> {
    if (client) {
      return client;
    }

    if (!connectPromise) {
      setStatus("figma mcp: connecting...", ctx);
      connectPromise = connect(ctx).finally(() => {
        connectPromise = undefined;
      });
    }

    await connectPromise;

    if (!client) {
      throw new Error("Failed to connect to Figma MCP server.");
    }

    return client;
  }

  pi.on("session_start", async (_event, ctx) => {
    setStatus("figma mcp: idle", ctx);

    try {
      await ensureConnected(ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("figma mcp: offline", ctx);
      ctx.ui.notify(
        `Figma MCP not connected. Start the Figma desktop app, enable the desktop MCP server, then run /figma-mcp-connect. (${message})`,
        "warning",
      );
    }
  });

  pi.on("before_agent_start", async (event) => {
    const prompt = event.prompt.toLowerCase();
    if (!/(figma|design|frame|layer|ui)/.test(prompt)) {
      return;
    }

    if (toolInfoByPiName.size === 0) {
      return;
    }

    return {
      message: {
        customType: "figma-mcp-hint",
        content: SKILL_HINT,
        display: false,
      },
    };
  });

  pi.registerCommand("figma-mcp-status", {
    description: "Show Figma MCP connection status and discovered tools",
    handler: async (_args, ctx) => {
      const connected = Boolean(client);
      const lines = [
        `Server URL: ${getServerUrl()}`,
        `Connected: ${connected ? "yes" : "no"}`,
        `Discovered tools: ${toolInfoByPiName.size}`,
        ...getToolLines(toolInfoByPiName),
      ];

      ctx.ui.setWidget(CONNECTION_STATUS_KEY, lines);
      ctx.ui.notify(`Figma MCP ${connected ? "connected" : "offline"}`, connected ? "info" : "warning");
    },
  });

  pi.registerCommand("figma-mcp-list-tools", {
    description: "List the Pi tools mirrored from the Figma MCP server",
    handler: async (_args, ctx) => {
      ctx.ui.setWidget(CONNECTION_STATUS_KEY, getToolLines(toolInfoByPiName));
      ctx.ui.notify(`Listed ${toolInfoByPiName.size} Figma MCP tools`, "info");
    },
  });

  pi.registerCommand("figma-mcp-connect", {
    description: "Connect or reconnect to the Figma desktop MCP server",
    handler: async (_args, ctx) => {
      try {
        setStatus("figma mcp: reconnecting...", ctx);
        await connect(ctx);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus("figma mcp: offline", ctx);
        ctx.ui.notify(`Failed to connect to Figma MCP: ${message}`, "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await disconnect();
  });
}
