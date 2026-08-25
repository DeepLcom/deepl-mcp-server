import { describe, expect, it, vi } from "vitest";
import { createHandlers } from "../src/handlers.mjs";

function createClient() {
  return {
    getSourceLanguages: vi.fn(async () => [
      { name: "English", code: "EN" },
      { name: "German", code: "DE" },
    ]),
    getTargetLanguages: vi.fn(async () => [
      { name: "English (American)", code: "EN-US" },
      { name: "German", code: "DE" },
    ]),
    translateText: vi.fn(async () => ({ text: "Hallo", detectedSourceLang: "en" })),
    rephraseText: vi.fn(async () => ({ text: "Hello there" })),
    translateDocument: vi.fn(async () => ({ status: "done", billedCharacters: 12 })),
    listMultilingualGlossaries: vi.fn(async () => []),
    getMultilingualGlossary: vi.fn(async () => ({
      glossaryId: "glossary-1",
      name: "Terms",
      dictionaries: [{ sourceLang: "en", targetLang: "de" }],
      creationTime: new Date("2026-01-02T03:04:05Z"),
    })),
    getMultilingualGlossaryDictionaryEntries: vi.fn(async () => ({
      entries: { entries: () => ({ hello: "hallo" }) },
    })),
    getAllStyleRules: vi.fn(async () => []),
    getStyleRule: vi.fn(async () => ({ styleId: "style-1", name: "House style" })),
    getStyleRuleCustomInstruction: vi.fn(async () => ({
      customInstructionId: "instruction-1",
      prompt: "Keep it short",
    })),
  };
}

describe("translateText", () => {
  it("normalizes both language codes and passes every option through", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    const result = await handlers.translateText({
      text: "Hello",
      sourceLangCode: "en-US",
      targetLangCode: "DE",
      formality: "more",
      glossaryId: "glossary-1",
      styleId: "style-1",
      context: "Technical documentation",
      preserveFormatting: false,
      splitSentences: "nonewlines",
      customInstructions: ["Keep it short"],
    });

    expect(client.translateText).toHaveBeenCalledWith("Hello", "en", "de", {
      formality: "more",
      glossary: "glossary-1",
      styleRule: "style-1",
      context: "Technical documentation",
      preserveFormatting: false,
      splitSentences: "nonewlines",
      customInstructions: ["Keep it short"],
    });
    expect(result.content).toEqual([
      { type: "text", text: "Hallo" },
      { type: "text", text: "Detected source language: en" },
      { type: "text", text: "Target language used: de" },
    ]);
  });

  it("leaves out options that were not given", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    await handlers.translateText({ text: "Hello", targetLangCode: "de" });

    const [text, sourceLangCode, targetLangCode, options] = client.translateText.mock.calls[0];
    expect([text, sourceLangCode, targetLangCode]).toEqual(["Hello", null, "de"]);
    expect(Object.keys(options)).toEqual(["formality"]);
  });

  it("returns one translation per input string and pluralizes the detected languages", async () => {
    const client = createClient();
    client.translateText.mockResolvedValueOnce([
      { text: "Hallo", detectedSourceLang: "en" },
      { text: "Guten Tag", detectedSourceLang: "fr" },
    ]);
    const handlers = createHandlers(client);

    const result = await handlers.translateText({
      text: ["Hello", "Bonjour"],
      targetLangCode: "de",
    });

    expect(result.content).toEqual([
      { type: "text", text: "Hallo" },
      { type: "text", text: "Guten Tag" },
      { type: "text", text: "Detected source languages: en, fr" },
      { type: "text", text: "Target language used: de" },
    ]);
  });

  it("wraps a client failure and keeps the original error as the cause", async () => {
    const client = createClient();
    const cause = new Error("quota exceeded");
    client.translateText.mockRejectedValueOnce(cause);
    const handlers = createHandlers(client);

    await expect(handlers.translateText({ text: "Hello", targetLangCode: "de" })).rejects.toThrow(
      expect.objectContaining({ message: "Translation failed: quota exceeded", cause }),
    );
  });
});

describe("translateDocument", () => {
  it("derives the output file name from the input file and target language", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    const result = await handlers.translateDocument({
      inputFile: "/docs/report.docx",
      targetLangCode: "de",
    });

    expect(client.translateDocument).toHaveBeenCalledWith(
      "/docs/report.docx",
      "/docs/report_de.docx",
      null,
      "de",
      { formality: undefined },
    );
    expect(result.content.at(-1)).toEqual({
      type: "text",
      text: "Output file: /docs/report_de.docx",
    });
  });

  it("uses the output format for the extension and the extra request parameters", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    await handlers.translateDocument({
      inputFile: "/docs/report.docx",
      targetLangCode: "de",
      styleId: "style-1",
      outputFormat: "pdf",
    });

    const [, outputFile, , , options] = client.translateDocument.mock.calls[0];
    expect(outputFile).toBe("/docs/report_de.pdf");
    expect(options.extraRequestParameters).toEqual({ style_id: "style-1", output_format: "pdf" });
  });

  it("keeps an explicitly given output file", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    await handlers.translateDocument({
      inputFile: "/docs/report.docx",
      outputFile: "/tmp/translated.docx",
      targetLangCode: "de",
    });

    expect(client.translateDocument.mock.calls[0][1]).toBe("/tmp/translated.docx");
  });
});

describe("rephraseText", () => {
  it("standardizes the target language case and forwards style and tone", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    const result = await handlers.rephraseText({
      text: "Hello",
      targetLangCode: "en-us",
      style: "academic",
      tone: "friendly",
    });

    expect(client.rephraseText).toHaveBeenCalledWith("Hello", "en-US", "academic", "friendly");
    expect(result.content).toEqual([{ type: "text", text: "Hello there" }]);
  });

  it("passes null when no target language is given", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    await handlers.rephraseText({ text: "Hello" });

    expect(client.rephraseText).toHaveBeenCalledWith("Hello", null, undefined, undefined);
    expect(client.getTargetLanguages).not.toHaveBeenCalled();
  });
});

describe("listGlossaries", () => {
  it("reports when there are no glossaries", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    const result = await handlers.listGlossaries();

    expect(result.content).toEqual([{ type: "text", text: "No glossaries found" }]);
  });

  it("formats glossary metadata", async () => {
    const client = createClient();
    client.listMultilingualGlossaries.mockResolvedValueOnce([
      {
        glossaryId: "glossary-1",
        name: "Terms",
        dictionaries: [{ sourceLang: "en", targetLang: "de" }],
        creationTime: "2026-01-02T03:04:05Z",
      },
    ]);

    const result = await createHandlers(client).listGlossaries();

    expect(JSON.parse(result.content[0].text)).toEqual({
      id: "glossary-1",
      name: "Terms",
      dictionaries: [{ sourceLang: "en", targetLang: "de" }],
      creationTime: "2026-01-02T03:04:05Z",
    });
  });
});

describe("language and writing metadata", () => {
  it("returns source and target languages", async () => {
    const handlers = createHandlers(createClient());

    await expect(handlers.getSourceLanguages()).resolves.toEqual({
      content: [
        { type: "text", text: JSON.stringify({ name: "English", code: "en" }) },
        { type: "text", text: JSON.stringify({ name: "German", code: "de" }) },
      ],
    });
    await expect(handlers.getTargetLanguages()).resolves.toEqual({
      content: [
        { type: "text", text: JSON.stringify({ name: "English (American)", code: "en-us" }) },
        { type: "text", text: JSON.stringify({ name: "German", code: "de" }) },
      ],
    });
  });

  it("returns the writing styles and tones exposed by deepl-node", async () => {
    const handlers = createHandlers(createClient());

    const styles = await handlers.getWritingStyles();
    const tones = await handlers.getWritingTones();

    expect(styles.content.length).toBeGreaterThan(0);
    expect(tones.content.length).toBeGreaterThan(0);
    expect(styles.content.every(({ type, text }) => type === "text" && text.length > 0)).toBe(true);
    expect(tones.content.every(({ type, text }) => type === "text" && text.length > 0)).toBe(true);
  });
});

describe("glossary handlers", () => {
  it("gets glossary metadata by id", async () => {
    const client = createClient();

    const result = await createHandlers(client).getGlossary({ glossaryId: "glossary-1" });

    expect(client.getMultilingualGlossary).toHaveBeenCalledWith("glossary-1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ id: "glossary-1", name: "Terms" });
  });

  it("normalizes a dictionary language pair and returns its entries", async () => {
    const client = createClient();

    const result = await createHandlers(client).getGlossaryDictionaryEntries({
      glossaryId: "glossary-1",
      sourceLangCode: "EN-US",
      targetLangCode: "DE",
    });

    expect(client.getMultilingualGlossaryDictionaryEntries).toHaveBeenCalledWith(
      "glossary-1",
      "en",
      "de",
    );
    expect(result.content.map(({ text }) => text)).toContain("Language pair: en → de");
    expect(result.content.at(-1).text).toContain("hello");
  });

  it("requires both dictionary languages", async () => {
    const handlers = createHandlers(createClient());

    await expect(
      handlers.getGlossaryDictionaryEntries({ glossaryId: "glossary-1", sourceLangCode: "en" }),
    ).rejects.toThrow("you must specify its source and target languages");
  });
});

describe("style rule handlers", () => {
  it("reports an empty style-rule list", async () => {
    const result = await createHandlers(createClient()).listStyleRules({
      page: 0,
      pageSize: 10,
      detailed: true,
    });

    expect(result.content).toEqual([{ type: "text", text: "No style rules found" }]);
  });

  it("forwards pagination and formats style rules", async () => {
    const client = createClient();
    client.getAllStyleRules.mockResolvedValueOnce([{ styleId: "style-1", name: "House style" }]);

    const result = await createHandlers(client).listStyleRules({
      page: 2,
      pageSize: 5,
      detailed: false,
    });

    expect(client.getAllStyleRules).toHaveBeenCalledWith(2, 5, false);
    expect(JSON.parse(result.content[0].text)).toEqual({
      styleId: "style-1",
      name: "House style",
    });
  });

  it("gets a style rule and custom instruction", async () => {
    const client = createClient();
    const handlers = createHandlers(client);

    const style = await handlers.getStyleRule({ styleId: "style-1" });
    const instruction = await handlers.getCustomInstruction({
      styleId: "style-1",
      instructionId: "instruction-1",
    });

    expect(client.getStyleRule).toHaveBeenCalledWith("style-1");
    expect(client.getStyleRuleCustomInstruction).toHaveBeenCalledWith("style-1", "instruction-1");
    expect(JSON.parse(style.content[0].text).name).toBe("House style");
    expect(JSON.parse(instruction.content[0].text).prompt).toBe("Keep it short");
  });
});

describe("handler errors", () => {
  it.each([
    ["getSourceLanguages", "getSourceLanguages", "Failed to get source languages"],
    ["getTargetLanguages", "getTargetLanguages", "Failed to get target languages"],
    ["rephraseText", "rephraseText", "Rephrasing failed"],
    ["translateDocument", "translateDocument", "Document translation failed"],
    ["listGlossaries", "listMultilingualGlossaries", "Failed to list glossaries"],
    ["getGlossary", "getMultilingualGlossary", "Failed to get glossary"],
    ["listStyleRules", "getAllStyleRules", "Failed to list style rules"],
    ["getStyleRule", "getStyleRule", "Failed to get style rule"],
    ["getCustomInstruction", "getStyleRuleCustomInstruction", "Failed to get custom instruction"],
  ])("wraps failures from %s", async (handlerName, clientMethod, message) => {
    const client = createClient();
    const cause = new Error("service unavailable");
    client[clientMethod].mockRejectedValueOnce(cause);
    const handlers = createHandlers(client);
    const args = {
      getSourceLanguages: undefined,
      getTargetLanguages: undefined,
      rephraseText: { text: "Hello" },
      translateDocument: { inputFile: "report.docx", targetLangCode: "de" },
      listGlossaries: undefined,
      getGlossary: { glossaryId: "glossary-1" },
      listStyleRules: {},
      getStyleRule: { styleId: "style-1" },
      getCustomInstruction: { styleId: "style-1", instructionId: "instruction-1" },
    };

    await expect(handlers[handlerName](args[handlerName])).rejects.toThrow(
      expect.objectContaining({ message: `${message}: service unavailable`, cause }),
    );
  });
});
