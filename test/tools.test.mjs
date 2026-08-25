import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerTools } from "../src/tools.mjs";

const toolNames = [
  "get-source-languages",
  "get-target-languages",
  "translate-text",
  "get-writing-styles",
  "get-writing-tones",
  "rephrase-text",
  "translate-document",
  "list-glossaries",
  "get-glossary-info",
  "get-glossary-dictionary-entries",
  "list-style-rules",
  "get-style-rule",
  "get-custom-instruction",
];

let client;
let server;

afterEach(async () => {
  await client?.close();
  await server?.close();
  client = undefined;
  server = undefined;
});

async function createConnectedServer(overrides = {}) {
  const handler = vi.fn(async () => ({ content: [{ type: "text", text: "ok" }] }));
  const handlers = Object.fromEntries(
    [
      "getSourceLanguages",
      "getTargetLanguages",
      "translateText",
      "getWritingStyles",
      "getWritingTones",
      "rephraseText",
      "translateDocument",
      "listGlossaries",
      "getGlossary",
      "getGlossaryDictionaryEntries",
      "listStyleRules",
      "getStyleRule",
      "getCustomInstruction",
    ].map((name) => [name, overrides[name] ?? handler]),
  );

  server = new McpServer({ name: "test-server", version: "1.0.0" });
  registerTools(server, handlers);
  client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, handlers };
}

describe("registerTools", () => {
  it("exposes the complete tool surface through MCP", async () => {
    const { client } = await createConnectedServer();

    const { tools } = await client.listTools();

    expect(tools.map(({ name }) => name)).toEqual(toolNames);
    expect(tools.every(({ description }) => description.length > 0)).toBe(true);
  });

  it("publishes the translation input contract", async () => {
    const { client } = await createConnectedServer();

    const { tools } = await client.listTools();
    const translateText = tools.find(({ name }) => name === "translate-text");

    expect(translateText.inputSchema.required).toEqual(["text", "targetLangCode"]);
    expect(translateText.inputSchema.properties.text.anyOf).toHaveLength(2);
    expect(translateText.inputSchema.properties.formality.enum).toEqual([
      "less",
      "more",
      "default",
      "prefer_less",
      "prefer_more",
    ]);
    expect(translateText.inputSchema.properties.preserveFormatting.type).toBe("boolean");
  });

  it("validates input and invokes the wired handler", async () => {
    const translateText = vi.fn(async () => ({
      content: [{ type: "text", text: "Hallo" }],
    }));
    const { client } = await createConnectedServer({ translateText });

    await expect(
      client.callTool({ name: "translate-text", arguments: { text: "Hello" } }),
    ).resolves.toMatchObject({ isError: true });

    const result = await client.callTool({
      name: "translate-text",
      arguments: { text: "Hello", targetLangCode: "de" },
    });

    expect(translateText).toHaveBeenCalledWith(
      { text: "Hello", targetLangCode: "de" },
      expect.anything(),
    );
    expect(result.content).toEqual([{ type: "text", text: "Hallo" }]);
  });
});
