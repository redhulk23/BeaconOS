import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLogger } from "@beacon-os/common";
import type { ToolRegistry } from "../registry.js";
import { z } from "zod";

const log = createLogger("tools:mcp-server");

export function createMcpServer(
  registry: ToolRegistry,
  tenantId: string,
  options?: { name?: string; version?: string },
): McpServer {
  const server = new McpServer({
    name: options?.name ?? "beacon-os-tools",
    version: options?.version ?? "0.1.0",
  });

  // Register all tenant tools as MCP tools
  const tools = registry.list(tenantId);
  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      { input: z.record(z.unknown()) },
      async (args) => {
        try {
          const result = await tool.execute(args.input);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result) },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  log.info(
    { tenantId, toolCount: tools.length },
    "MCP server created with tools",
  );

  return server;
}

export async function startMcpStdioServer(
  registry: ToolRegistry,
  tenantId: string,
): Promise<void> {
  const server = createMcpServer(registry, tenantId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("MCP stdio server started");
}
