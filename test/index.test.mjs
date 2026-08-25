import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

let client;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("CLI", () => {
  it("starts an MCP stdio server and lists its tools", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["src/index.mjs"],
      env: { ...process.env, DEEPL_API_KEY: "test-key" },
      stderr: "pipe",
    });
    client = new Client({ name: "smoke-test", version: "1.0.0" });

    await client.connect(transport);
    const { tools } = await client.listTools();

    expect(tools.map(({ name }) => name)).toContain("translate-text");
    expect(tools.map(({ name }) => name)).toContain("translate-document");
  });
});
