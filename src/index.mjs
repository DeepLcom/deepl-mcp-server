#!/usr/bin/env node

/*--------------------------------------------------------------------
 *  Imports and constants
 *-------------------------------------------------------------------*/

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

// Descriptive text for reuse in our tools
const languageCodeDescription = "language code, in standard ISO-639-1 format (e.g. 'en-US', 'de', 'fr')";
const glossaryEntriesGuidance = "This does not fetch any glossary entries. Use the get-glossary-dictionary-entries tool to fetch entries."


/*--------------------------------------------------------------------
 *  Set up DeepL things
 *-------------------------------------------------------------------*/

const deeplClient = new deepl.DeepLClient(DEEPL_API_KEY, deeplClientOptions);

// Import WritingStyle and WritingTone enums from DeepL, and transform each to arrays of strings
const writingStyles = /** @type {[string, ...string[]]} */ (Object.values(deepl.WritingStyle));
const writingTones = /** @type {[string, ...string[]]} */ (Object.values(deepl.WritingTone));

const formalityTypes = /** @type {const} */ (['less', 'more', 'default', 'prefer_less', 'prefer_more']);

/**
 * Class to handle a list of languages and associated ISO-639 codes.
 * We normalize all language codes to lowercase
 * so that lowercase/uppercase differences don't inspire mistakes.
 * 
 * @property {Array<{name: string, code: string}>} list
 * @property {string} codesList - Comma-separated list of all language codes
 */

class LanguagesList {
  static countryDefaults = {
    'en': 'en-US',
    'pt': 'pt-BR',
    "zh": "zh-Hans"
  }

  constructor(list, direction = null) {    
    this.list = list;
    this.codesList = list.map(lang => lang.code).join(', ');
    this.direction = direction;
  }

  static async create(direction) {
    if (direction != 'source' && direction !== 'target') {
      throw new Error('LanguagesList needs to be called with "target" or "source"');
    }

    const method = direction === 'source' ? 'getSourceLanguages' : 'getTargetLanguages';
    const langs = await deeplClient[method]();
    const lowerCaseLangs = langs.map(({ name, code }) => ({ name, code: code.toLowerCase() }));
    const instance = new LanguagesList(lowerCaseLangs, direction);
    return instance;
  }

  /**
   * Given an ISO-639 language code, throw an error if it's not in our codes list
   * @param {string} code
   * 
   * At present, our client libraries don't accept two-letter language codes for target_lang
   * for cases where we support _locales_ - a language code plus country code, like "en-US".
   * For example, if you specify `target_lang="en"`, you'll get an error. We want "en-US" or "en-UK".
   * But in this server we don't want to reject such `target_lang`'s, because AI clients
   * often want to send them.
   * 
   * So we're changing the `validate()` method to `normalize()`. We will still throw an error if
   * we're passed an invalid code. But if we're passed a code that requires a country code as well,
   * like "pt", we'll return the default, like "pt-BR".
   */
  normalize(code) {
    const lowerCode = code.toLowerCase();
    let countryDefault;

    // For target languages, if a language requires a country code (like pt-BR), return that
    if (this.direction === 'target' && (countryDefault = LanguagesList.countryDefaults[lowerCode])) {
      return countryDefault;
    }

    // Otherwise, ensure that the language code we're passed is supported
    if (!this.list.some(lang => lang.code === lowerCode)) {
      throw new Error(`Invalid language code: ${lowerCode}. Available codes: ${this.codesList}`);
    }

    return lowerCode;
  }
}

const sourceLanguages = await LanguagesList.create('source');
const targetLanguages = await LanguagesList.create('target');

/*--------------------------------------------------------------------
 *  Create MCP server
 *-------------------------------------------------------------------*/

const server = new McpServer({
  name: "deepl",
  version: "1.0.0"
});


/*--------------------------------------------------------------------
 *  Server tools
 *-------------------------------------------------------------------*/

server.tool(
  "get-source-languages",
  "Get list of available source languages for translation",
  getSourceLanguages
);

server.tool(
  "get-target-languages",
  "Get list of available target languages for translation",
  getTargetLanguages
);

server.tool(
  "translate-text",
  "Translate text to a target language using DeepL API. When the translation includes a glossary, you must specify the source language as well as the target language. If the user requests a glossary by name instead of by id, you can use the list-glossaries tool to get a name for each id.",
  {
    text: z.string().describe("Text to translate"),
    sourceLangCode: z.string().optional().describe(`source ${languageCodeDescription}, or leave empty for auto-detection`),
    targetLangCode: z.string().describe('target ' + languageCodeDescription),
    formality: z.enum(formalityTypes).optional().describe("Controls whether translations should lean toward informal or formal language"),
    glossaryId: z.string().optional().describe("ID of glossary to use for translation"),
  },
  translateText
);

server.tool(
  "get-writing-styles",
  "Get list of writing styles the DeepL API can use while rephrasing text",
  getWritingStyles
);

server.tool(
  "get-writing-tones",
  "Get list of writing tones the DeepL API can use while rephrasing text",
  getWritingTones
);

server.tool(
  "rephrase-text",
  "Rephrase text in the same language using DeepL API",
  {
    text: z.string().describe("Text to rephrase"),
    style: z.enum(writingStyles).optional().describe("Writing style for rephrasing"),
    tone: z.enum(writingTones).optional().describe("Writing tone for rephrasing")
  },
  rephraseText
);

server.tool(
  "translate-document",
  "Translate a document file using DeepL API",
  {
    inputFile: z.string().describe("Path to the input document file to translate"),
    outputFile: z.string().optional().describe("Path where the translated document will be saved (if not provided, will be auto-generated)"),
    sourceLangCode: z.string().optional().describe(`source ${languageCodeDescription}, or leave empty for auto-detection`),
    targetLangCode: z.string().describe('target ' + languageCodeDescription),
    formality: z.enum(['less', 'more', 'default', 'prefer_less', 'prefer_more']).optional().describe("Controls whether translations should lean toward informal or formal language"),
    glossaryId: z.string().optional().describe("ID of glossary to use for translation"),
  },
  translateDocument
);

server.tool(
  "list-glossaries",
  "Get a list of all glossaries with metadata for each - name, dictionaries available, and creation time. " + glossaryEntriesGuidance,
  listGlossaries
);

server.tool(
  "get-glossary-info",
  "Given an id, get metadata about the glossary with that id - its name, available dictionaries, and creation time. " + glossaryEntriesGuidance,
  {
    glossaryId: z.string().describe("The unique identifier of the glossary")
  },
  getGlossary
);

server.tool(
  "get-glossary-dictionary-entries",
  "Retrieve all the entries from a given glossary dictionary. (A glossary consists one of one or more dictionaries, each of which contains entries for a specific language pair, in one direction. For example, one dictionary could contain entries for translations from German to English, and another dictionary could contain entries for translations from English to German.) To retrieve all entries for a glossary with multiple dictionaries, use the get-glossary-info or list-glossaries tool to find out what dictionaries it contains, then use this tool for each dictionary.",
  {
    glossaryId: z.string().describe("The unique identifier of the glossary"),
    sourceLangCode: z.string().describe(`source ${languageCodeDescription}`),
    targetLangCode: z.string().describe(`target ${languageCodeDescription}`)
  },
  getGlossaryDictionaryEntries
);


/*--------------------------------------------------------------------
 *  Server tool callback functions
 *-------------------------------------------------------------------*/

async function getSourceLanguages() {
  try {
    return mcpContentifyText(sourceLanguages.list.map(JSON.stringify)); 
  } catch (error) {
    throw new Error(`Failed to get source languages: ${error.message}`);
  }
}

async function getTargetLanguages() {
  try {
    return mcpContentifyText(targetLanguages.list.map(JSON.stringify));
  } catch (error) {
    throw new Error(`Failed to get target languages: ${error.message}`);
  }
}

// The type assertion below asserts that the API will return a single result, not an array of results
async function translateText ({ text, sourceLangCode = null, targetLangCode, formality, glossaryId }) {
  if (sourceLangCode) {
    sourceLanguages.normalize(sourceLangCode);
  }
  
  targetLangCode = targetLanguages.normalize(targetLangCode);

  try {
    const options = { formality };
    if (glossaryId) {
      options.glossary = glossaryId;
    }

    const result = await deeplClient.translateText(text, sourceLangCode, targetLangCode, options);
    const translation = /** @type {import('deepl-node').TextResult} */ (result);

    return mcpContentifyText([
      translation.text,
      `Detected source language: ${translation.detectedSourceLang}`,
      `Target language used: ${targetLangCode}`
    ]);

  } catch (error) {
    throw new Error(`Translation failed: ${error.message}`);
  }
}

// The type assertion below asserts that the API will return a single result, not an array of results
async function rephraseText({ text, style, tone }) {
  try {
    const result = await deeplClient.rephraseText(text, null, style, tone);
    const translation = /** @type {import('deepl-node').WriteResult} */ (result);
    return mcpContentifyText(translation.text);

  } catch (error) {
    throw new Error(`Rephrasing failed: ${error.message}`);
  }
}

async function getWritingStyles() {
  try {
    return mcpContentifyText(writingStyles);
  } catch (error) {
    throw new Error(`Failed to get writing styles and tones: ${error.message}`);
  }
}

async function getWritingTones() {
  try {
    return mcpContentifyText(writingTones);
  } catch (error) {
    throw new Error(`Failed to get writing styles and tones: ${error.message}`);
  }
}

async function translateDocument ({ inputFile, outputFile, sourceLangCode, targetLangCode, formality, glossaryId }) {
  if (sourceLangCode) {
    sourceLanguages.normalize(sourceLangCode);
  }
  
  targetLangCode = targetLanguages.normalize(targetLangCode);

  // Generate output file name if not provided
  if (!outputFile) {
    const path = await import('path');
    const parsedPath = path.parse(inputFile);
    const langCodeSet1 = targetLangCode.split('-')[0]; // Get language code without region (e.g., 'en' from 'en-US')
    outputFile = path.join(parsedPath.dir, `${parsedPath.name}_${langCodeSet1}${parsedPath.ext}`);
  }

  try {
    const options = { formality };
    if (glossaryId) {
      options.glossary = glossaryId;
    }

    const result = await deeplClient.translateDocument(
      inputFile,
      outputFile,
      sourceLangCode ? /** @type {import('deepl-node').SourceLanguageCode} */(sourceLangCode) : null,
      /** @type {import('deepl-node').TargetLanguageCode} */(targetLangCode),
      options
    );

    return mcpContentifyText([
      `Document translated successfully! Status: ${result.status}`,
      `Target language used: ${targetLangCode}`,
      `Characters billed: ${result.billedCharacters}`,
      `Output file: ${outputFile}`
    ]);
  } catch (error) {
    throw new Error(`Document translation failed: ${error.message}`);
  }
}

async function listGlossaries() {
  try {
    const glossaries = await deeplClient.listMultilingualGlossaries();

    if (glossaries.length === 0) {
      return mcpContentifyText("No glossaries found");
    }

    const results = glossaries.map(glossary => JSON.stringify({
      id: glossary.glossaryId,
      name: glossary.name,
      dictionaries: glossary.dictionaries,
      creationTime: glossary.creationTime
    }, null, 2));

    return mcpContentifyText(results);
  } catch (error) {
    throw new Error(`Failed to list glossaries: ${error.message}`);
  }
}

async function getGlossary({ glossaryId }) {
  try {
    const glossary = await deeplClient.getMultilingualGlossary(glossaryId);

    const result = {
      id: glossary.glossaryId,
      name: glossary.name,
      dictionaries: glossary.dictionaries,
      creationTime: glossary.creationTime
    };

    return mcpContentifyText(JSON.stringify(result, null, 2));
  } catch (error) {
    throw new Error(`Failed to get glossary: ${error.message}`);
  }
}

async function getGlossaryDictionaryEntries({ glossaryId, sourceLangCode, targetLangCode }) {
  try {
    if (!sourceLangCode || !targetLangCode) {
      throw new Error('To access a glossary dictionary, you must specify its source and target languages');
    }

    const glossary = await deeplClient.getMultilingualGlossary(glossaryId);

    const entriesResult = await deeplClient.getMultilingualGlossaryDictionaryEntries(
      glossaryId,
      sourceLangCode,
      targetLangCode
    );

    const results = [
      `Glossary: ${glossary.name}`,
      `Language pair: ${sourceLangCode} → ${targetLangCode}`,
      '',
      'Entries:',
      JSON.stringify(entriesResult.entries, null, 2)
    ];

    return mcpContentifyText(results);
  } catch (error) {
    throw new Error(`Failed to get glossary dictionary entries: ${error.message}`);
  }
}


/*--------------------------------------------------------------------
 *  Helper functions
 *-------------------------------------------------------------------*/

/**
 * Helper function which wraps a string or strings in the object structure MCP expects
 * @param {string | string[]} param
 */
function mcpContentifyText(param) {
  if (typeof(param) != 'string' && !Array.isArray(param)) {
    throw new Error('mcpContentifyText() expects a string or an array of strings');
  }

  const strings = typeof(param) === 'string' ? [param] : param;

  const contentObjects = strings.map(
    str => (/** @type {const} */ ({
        type: "text",
        text: str
      }))
  );

  return {
    content: contentObjects
  };
}

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
