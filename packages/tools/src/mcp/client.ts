import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createLogger } from "@beacon-os/common";

const log = createLogger("tools:mcp-client");

export interface McpConnection {
  client: Client;
  transport: StdioClientTransport;
}

export async function connectMcpServer(
  command: string,
  args: string[] = [],
  env?: Record<string, string>,
): Promise<McpConnection> {
  const transport = new StdioClientTransport({ command, args, env });
  const client = new Client(
    { name: "beacon-os", version: "0.1.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  log.info({ command, args }, "Connected to MCP server");

  return { client, transport };
}

export async function listMcpTools(
  client: Client,
): Promise<{ name: string; description?: string; inputSchema: unknown }[]> {
  const result = await client.listTools();
  return result.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

export async function callMcpTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await client.callTool({ name, arguments: args });
  return result.content;
}

export async function disconnectMcp(connection: McpConnection): Promise<void> {
  await connection.transport.close();
  log.info("Disconnected from MCP server");
}
