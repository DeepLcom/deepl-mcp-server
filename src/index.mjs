#!/usr/bin/env node

/*--------------------------------------------------------------------
 *  Imports and constants
 *-------------------------------------------------------------------*/

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as deepl from "deepl-node";
import { createHandlers } from "./handlers.mjs";
import { registerTools } from "./tools.mjs";

const { version: packageVersion } = createRequire(import.meta.url)("../package.json");

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

if (!DEEPL_API_KEY) {
  console.error(
    "DEEPL_API_KEY is not set. Create an API key at https://www.deepl.com/pro-api and provide it to this server as the DEEPL_API_KEY environment variable.",
  );
  process.exit(1);
}

const deeplClientOptions = {
  appInfo: {
    appName: "DeepL-MCP",
    appVersion: packageVersion,
  },
};

/*--------------------------------------------------------------------
 *  Set up DeepL things
 *-------------------------------------------------------------------*/

const deeplClient = new deepl.DeepLClient(DEEPL_API_KEY, deeplClientOptions);

/*--------------------------------------------------------------------
 *  Create MCP server
 *-------------------------------------------------------------------*/

const server = new McpServer({
  name: "deepl",
  version: packageVersion,
});

/*--------------------------------------------------------------------
 *  Server tools
 *-------------------------------------------------------------------*/

registerTools(server, createHandlers(deeplClient));

/*--------------------------------------------------------------------
 *  Main MCP functionality
 *-------------------------------------------------------------------*/

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DeepL MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
