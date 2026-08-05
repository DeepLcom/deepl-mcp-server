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
});
