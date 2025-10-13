#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as deepl from 'deepl-node';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const deeplClientOptions = {
  appInfo: {
    appName: 'DeepL-MCP',
    appVersion: '0.1.3-beta.0',
  },
};

const deeplClient = new deepl.DeepLClient(DEEPL_API_KEY, deeplClientOptions);

// Import WritingStyle and WritingTone enums
const WritingStyle = deepl.WritingStyle;
const WritingTone = deepl.WritingTone;

// Cache for language lists
let sourceLanguagesCache = null;
let targetLanguagesCache = null;

async function getSourceLanguages() {
  if (!sourceLanguagesCache) {
    sourceLanguagesCache = await deeplClient.getSourceLanguages();
  }
  return sourceLanguagesCache;
}

async function getTargetLanguages() {
  if (!targetLanguagesCache) {
    targetLanguagesCache = await deeplClient.getTargetLanguages();
  }
  return targetLanguagesCache;
}

// Helper function to validate languages
async function validateLanguages(targetLang) {
  const targetLanguages = await getTargetLanguages();

  if (!targetLanguages.some(lang => lang.code === targetLang)) {
    throw new Error(`Invalid target language: ${targetLang}. Available languages: ${targetLanguages.map(l => l.code).join(', ')}`);
  }
}


// Create server instance
const server = new McpServer({
  name: "deepl",
  version: "0.1.3-beta.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "get-source-languages",
  "Get list of available source languages for translation",
  async () => {
    try {
      const languages = await getSourceLanguages();
      return mcpTextContentify(languages.map(JSON.stringify)); 
    } catch (error) {
      throw new Error(`Failed to get source languages: ${error.message}`);
    }
  }
);

server.tool(
  "get-target-languages",
  "Get list of available target languages for translation",
  async () => {
    try {
      const languages = await getTargetLanguages();
      return mcpTextContentify(languages.map(JSON.stringify));
    } catch (error) {
      throw new Error(`Failed to get target languages: ${error.message}`);
    }
  }
);

server.tool(
  "translate-text",
  "Translate text to a target language using DeepL API",
  {
    text: z.string().describe("Text to translate"),
    targetLang: z.string().describe("Target language code (e.g. 'en-US', 'de', 'fr')"),
    formality: z.enum(['less', 'more', 'default', 'prefer_less', 'prefer_more']).optional().describe("Controls whether translations should lean toward informal or formal language"),
  },
  async ({ text, targetLang, formality }) => {
    // Validate languages before translation
    await validateLanguages(targetLang);

    try {
      const result = await deeplClient.translateText(
        text,
        null,
        /** @type {import('deepl-node').TargetLanguageCode} */(targetLang),
        { formality }
      );
      return mcpTextContentify([
        result.text,
        `Detected source language: ${result.detectedSourceLang}`
      ]);
    } catch (error) {
      throw new Error(`Translation failed: ${error.message}`);
    }
  }
);

server.tool(
  "get-writing-styles-and-tones",
  "Get list of available writing styles and tones for rephrasing",
  async () => {
    try {
      const writingStyles = Object.values(WritingStyle);
      const writingTones = Object.values(WritingTone);

      const stringifiedJSON = JSON.stringify(
        { writingStyles, writingTones }, null, 2
      );

      return mcpTextContentify(stringifiedJSON);
    } catch (error) {
      throw new Error(`Failed to get writing styles and tones: ${error.message}`);
    }
  }
);

server.tool(
  "rephrase-text",
  "Rephrase text in the same language using DeepL API",
  {
    text: z.string().describe("Text to rephrase"),
    style: z.nativeEnum(WritingStyle).optional().describe("Writing style for rephrasing"),
    tone: z.nativeEnum(WritingTone).optional().describe("Writing tone for rephrasing")
  },
  async ({ text, style, tone }) => {
    try {
      const result = await deeplClient.rephraseText(
        text,
        null,
        style,
        tone
      );

      return mcpTextContentify(result.text);
    } catch (error) {
      throw new Error(`Rephrasing failed: ${error.message}`);
    }
  }
);

server.tool(
  "translate-document",
  "Translate a document file using DeepL API",
  {
    inputFile: z.string().describe("Path to the input document file to translate"),
    outputFile: z.string().optional().describe("Path where the translated document will be saved (if not provided, will be auto-generated)"),
    targetLang: z.string().describe("Target language code (e.g. 'en-US', 'de', 'fr')"),
    sourceLang: z.string().optional().describe("Source language code, or leave empty for auto-detection"),
    formality: z.enum(['less', 'more', 'default', 'prefer_less', 'prefer_more']).optional().describe("Controls whether translations should lean toward informal or formal language"),
  },
  async ({ inputFile, outputFile, targetLang, sourceLang, formality }) => {
    // Validate target language
    await validateLanguages(targetLang);

    // Generate output file name if not provided
    if (!outputFile) {
      const path = await import('path');
      const parsed = path.parse(inputFile);
      const targetLangCode = targetLang.split('-')[0]; // Get language code without region (e.g., 'en' from 'en-US')
      outputFile = path.join(parsed.dir, `${parsed.name}_${targetLangCode}${parsed.ext}`);
    }

    try {
      const result = await deeplClient.translateDocument(
        inputFile,
        outputFile,
        sourceLang ? /** @type {import('deepl-node').SourceLanguageCode} */(sourceLang) : null,
        /** @type {import('deepl-node').TargetLanguageCode} */(targetLang),
        { formality }
      );

      return mcpTextContentify([
        `Document translated successfully! Status: ${result.status}`,
        `Characters billed: ${result.billedCharacters}`,
        `Output file: ${outputFile}`
      ]);
    } catch (error) {
      throw new Error(`Document translation failed: ${error.message}`);
    }
  }
);


/*** Helper functions ***/

// Helper function which wraps a string or strings in the object structure MCP expects
// Accept either a string or an array of strings, with partial error checking
function mcpTextContentify(param) {
  if (typeof(param) != 'string' && !Array.isArray(param)) {
    throw new Error('mcpTextContentify() expects a string or an array of strings');
  }

  const strings = typeof(param) == 'string' ? [param] : param;

  const contentObjects = strings.map(
    str => ({
        type: "text",
        text: str
      })
  );

  return {
    content: contentObjects
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DeepL MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
