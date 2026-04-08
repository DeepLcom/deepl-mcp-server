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
    appVersion: '1.1.0',
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
const modelTypes = /** @type {const} */ (['quality_optimized', 'latency_optimized', 'prefer_quality_optimized']);
const tagHandlingModes = /** @type {const} */ (['html', 'xml']);

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

/**
 * Normalize and validate a language code for glossary operations.
 * Glossary APIs use base language codes (e.g. 'en', 'de') unlike translation
 * APIs that may require locale-specific codes (e.g. 'en-US').
 * 
 * @param {string} langCode
 * @param {string} fieldName - Name of the field, used in error messages
 * @returns {string} Normalized language code (lowercase, trimmed, underscores replaced with hyphens)
 */
function normalizeGlossaryLangCode(langCode, fieldName) {
  if (typeof langCode !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const normalized = langCode.trim().replace(/_/g, '-').toLowerCase();

  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  if (!/^[a-z]{2,3}(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`Invalid ${fieldName}: ${langCode}`);
  }

  return normalized;
}

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
  "Translate text to a target language using DeepL API. Review all available optional parameters and use those applicable to your scenario for best results. When the translation includes a glossary, you must specify the source language as well as the target language. If the user requests a glossary by name instead of by id, you can use the list-glossaries tool to get a name for each id.",
  {
    text: z.string().describe("Text to translate"),
    sourceLangCode: z.string().optional().describe(`source ${languageCodeDescription}, or leave empty for auto-detection`),
    targetLangCode: z.string().describe('target ' + languageCodeDescription),
    formality: z.enum(formalityTypes).optional().describe("Controls formality: 'less' for informal, 'more' for formal/polite, 'prefer_less'/'prefer_more' to prefer but fall back to default"),
    glossaryId: z.string().optional().describe("Glossary ID to ensure consistent terminology translation"),
    styleRuleId: z.string().optional().describe("Style rule ID to apply a predefined style rule to the translation. Use list-style-rules to find available style rule IDs."),
    context: z.string().optional().describe("Recommended: describe what this text is about (e.g., 'Technical documentation for a software API'). Improves translation accuracy but is not itself translated."),
    preserveFormatting: z.boolean().optional().describe("Set to true to preserve original formatting - recommended for markdown, code blocks, HTML, or any structured text"),
    splitSentences: z.enum(['0', '1', 'nonewlines']).optional().describe("Sentence splitting: '0' disables, '1' (default) splits on punctuation and newlines, 'nonewlines' preserves line breaks"),
    modelType: z.enum(modelTypes).optional().describe("Translation model type: 'quality_optimized' for best quality (slower), 'latency_optimized' for fastest response (lower quality), 'prefer_quality_optimized' for best available quality"),
    tagHandling: z.enum(tagHandlingModes).optional().describe("Type of tags to parse before translation: 'html' for HTML content, 'xml' for XML content"),
    customInstructions: z.array(
      z.string().max(300, "Each custom instruction must be 300 characters or fewer")
    ).max(10, "customInstructions can contain at most 10 instructions").optional().describe("Array of custom instructions to guide translation style (max 10 instructions, 300 chars each). Note: forces quality_optimized model type."),
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
  "Rephrase text using DeepL API. If no target language is specified, the language is auto-detected.",
  {
    text: z.string().describe("Text to rephrase"),
    targetLangCode: z.string().optional().describe(`target ${languageCodeDescription} for rephrasing, or leave empty for auto-detection`),
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
    styleRuleId: z.string().optional().describe("Style rule ID to apply a predefined style rule to the document translation. Use list-style-rules to find available style rule IDs."),
    enableDocumentMinification: z.boolean().optional().describe("Set to true to minify large documents (pptx, docx) by temporarily replacing media with placeholders before translation, useful for files approaching the 30MB API limit"),
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

server.tool(
  "create-glossary",
  "Create a new multilingual glossary with one or more dictionaries. Each dictionary is a set of term pairs for a specific source-target language combination.",
  {
    name: z.string().describe("Name for the new glossary"),
    dictionaries: z.array(z.object({
      sourceLangCode: z.string().describe(`source ${languageCodeDescription}`),
      targetLangCode: z.string().describe(`target ${languageCodeDescription}`),
      entries: z.record(z.string()).describe("Object mapping source terms to target terms, e.g. { 'hello': 'hallo', 'world': 'Welt' }")
    })).describe("Array of dictionaries, each with a language pair and entries")
  },
  createGlossary
);

server.tool(
  "update-glossary-name",
  "Rename an existing glossary",
  {
    glossaryId: z.string().describe("The unique identifier of the glossary"),
    name: z.string().describe("New name for the glossary")
  },
  updateGlossaryName
);

server.tool(
  "update-glossary-dictionary",
  "Update or add entries in a glossary dictionary for a specific language pair. Existing entries for the same source term will be overwritten, new entries will be added, and entries not mentioned will be kept.",
  {
    glossaryId: z.string().describe("The unique identifier of the glossary"),
    sourceLangCode: z.string().describe(`source ${languageCodeDescription}`),
    targetLangCode: z.string().describe(`target ${languageCodeDescription}`),
    entries: z.record(z.string()).describe("Object mapping source terms to target terms, e.g. { 'hello': 'hallo', 'world': 'Welt' }")
  },
  updateGlossaryDictionary
);

server.tool(
  "delete-glossary",
  "Delete a glossary and all its dictionaries",
  {
    glossaryId: z.string().describe("The unique identifier of the glossary to delete")
  },
  deleteGlossary
);

server.tool(
  "delete-glossary-dictionary",
  "Delete a specific dictionary (language pair) from a glossary, without deleting the whole glossary",
  {
    glossaryId: z.string().describe("The unique identifier of the glossary"),
    sourceLangCode: z.string().describe(`source ${languageCodeDescription}`),
    targetLangCode: z.string().describe(`target ${languageCodeDescription}`)
  },
  deleteGlossaryDictionary
);

server.tool(
  "get-glossary-language-pairs",
  "Get the list of language pairs supported for glossaries",
  getGlossaryLanguagePairs
);

server.tool(
  "list-style-rules",
  "Get a list of all available style rules with their IDs, names, and configuration. Style rules can be used with translate-text and translate-document to apply consistent translation styles.",
  {
    detailed: z.boolean().optional().describe("Set to true to include configured rules and custom instructions in the response (default: false for faster responses)")
  },
  listStyleRules
);

server.tool(
  "get-style-rule",
  "Get detailed information about a specific style rule by its ID, including configured rules and custom instructions",
  {
    styleRuleId: z.string().describe("The unique identifier of the style rule")
  },
  getStyleRule
);

server.tool(
  "create-style-rule",
  "Create a new style rule with a name and language code. Style rules allow you to customize translation styles consistently across translations.",
  {
    name: z.string().describe("Name for the new style rule"),
    language: z.string().describe(`${languageCodeDescription} this style rule applies to`),
    configuredRules: z.record(z.record(z.string())).optional().describe("Predefined rules to configure, organized by category (e.g. { 'style_and_tone': { 'formality': 'formal' }, 'numbers': { 'decimal_separator': '.' } })"),
  },
  createStyleRule
);

server.tool(
  "delete-style-rule",
  "Delete a style rule by its ID",
  {
    styleRuleId: z.string().describe("The unique identifier of the style rule to delete")
  },
  deleteStyleRule
);

server.tool(
  "get-usage",
  "Get current API usage and limits for your DeepL account, including character counts, document counts, and team document counts",
  getUsage
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
async function translateText ({
  text,
  sourceLangCode = null,
  targetLangCode,
  formality,
  glossaryId,
  styleRuleId,
  context,
  preserveFormatting,
  splitSentences,
  modelType,
  tagHandling,
  customInstructions,
}) {
  if (sourceLangCode) {
    sourceLanguages.normalize(sourceLangCode);
  }

  targetLangCode = targetLanguages.normalize(targetLangCode);

  try {
    const options = { formality };
    if (glossaryId) {
      options.glossary = glossaryId;
    }
    if (styleRuleId) options.styleRule = styleRuleId;
    if (context) options.context = context;
    if (preserveFormatting !== undefined) options.preserveFormatting = preserveFormatting;
    if (splitSentences) options.splitSentences = splitSentences;
    if (modelType) options.modelType = modelType;
    if (tagHandling) options.tagHandling = tagHandling;
    if (customInstructions) options.customInstructions = customInstructions;

    const result = await deeplClient.translateText(text, sourceLangCode, targetLangCode, options);
    const translation = /** @type {import('deepl-node').TextResult} */ (result);

    const responseLines = [
      translation.text,
      `Detected source language: ${translation.detectedSourceLang}`,
      `Target language used: ${targetLangCode}`
    ];
    if (translation.modelTypeUsed) {
      responseLines.push(`Model type used: ${translation.modelTypeUsed}`);
    }

    return mcpContentifyText(responseLines);

  } catch (error) {
    throw new Error(`Translation failed: ${error.message}`);
  }
}

// The type assertion below asserts that the API will return a single result, not an array of results
async function rephraseText({ text, targetLangCode = null, style, tone }) {
  if (targetLangCode) {
    targetLangCode = targetLanguages.normalize(targetLangCode);
  }
  try {
    const result = await deeplClient.rephraseText(text, targetLangCode, style, tone);
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

async function translateDocument ({ inputFile, outputFile, sourceLangCode, targetLangCode, formality, glossaryId, styleRuleId, enableDocumentMinification }) {
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
    if (styleRuleId) options.styleRule = styleRuleId;
    if (enableDocumentMinification !== undefined) options.enableDocumentMinification = enableDocumentMinification;

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

    sourceLangCode = normalizeGlossaryLangCode(sourceLangCode, 'sourceLangCode');
    targetLangCode = normalizeGlossaryLangCode(targetLangCode, 'targetLangCode');

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

async function createGlossary({ name, dictionaries }) {
  try {
    const glossaryDicts = dictionaries.map(dict => ({
      sourceLangCode: normalizeGlossaryLangCode(dict.sourceLangCode, 'sourceLangCode'),
      targetLangCode: normalizeGlossaryLangCode(dict.targetLangCode, 'targetLangCode'),
      entries: new deepl.GlossaryEntries({ entries: dict.entries })
    }));

    const glossary = await deeplClient.createMultilingualGlossary(name, glossaryDicts);

    return mcpContentifyText(JSON.stringify({
      id: glossary.glossaryId,
      name: glossary.name,
      dictionaries: glossary.dictionaries,
      creationTime: glossary.creationTime
    }, null, 2));
  } catch (error) {
    throw new Error(`Failed to create glossary: ${error.message}`);
  }
}

async function updateGlossaryName({ glossaryId, name }) {
  try {
    const glossary = await deeplClient.updateMultilingualGlossaryName(glossaryId, name);

    return mcpContentifyText(JSON.stringify({
      id: glossary.glossaryId,
      name: glossary.name,
      dictionaries: glossary.dictionaries,
      creationTime: glossary.creationTime
    }, null, 2));
  } catch (error) {
    throw new Error(`Failed to update glossary name: ${error.message}`);
  }
}

async function updateGlossaryDictionary({ glossaryId, sourceLangCode, targetLangCode, entries }) {
  try {
    const glossaryDict = {
      sourceLangCode: normalizeGlossaryLangCode(sourceLangCode, 'sourceLangCode'),
      targetLangCode: normalizeGlossaryLangCode(targetLangCode, 'targetLangCode'),
      entries: new deepl.GlossaryEntries({ entries })
    };

    const glossary = await deeplClient.updateMultilingualGlossaryDictionary(glossaryId, glossaryDict);

    return mcpContentifyText(JSON.stringify({
      id: glossary.glossaryId,
      name: glossary.name,
      dictionaries: glossary.dictionaries,
      creationTime: glossary.creationTime
    }, null, 2));
  } catch (error) {
    throw new Error(`Failed to update glossary dictionary: ${error.message}`);
  }
}

async function deleteGlossary({ glossaryId }) {
  try {
    await deeplClient.deleteMultilingualGlossary(glossaryId);
    return mcpContentifyText(`Glossary ${glossaryId} deleted successfully`);
  } catch (error) {
    throw new Error(`Failed to delete glossary: ${error.message}`);
  }
}

async function deleteGlossaryDictionary({ glossaryId, sourceLangCode, targetLangCode }) {
  try {
    sourceLangCode = normalizeGlossaryLangCode(sourceLangCode, 'sourceLangCode');
    targetLangCode = normalizeGlossaryLangCode(targetLangCode, 'targetLangCode');
    await deeplClient.deleteMultilingualGlossaryDictionary(glossaryId, sourceLangCode, targetLangCode);
    return mcpContentifyText(`Dictionary ${sourceLangCode} → ${targetLangCode} deleted from glossary ${glossaryId}`);
  } catch (error) {
    throw new Error(`Failed to delete glossary dictionary: ${error.message}`);
  }
}

async function getGlossaryLanguagePairs() {
  try {
    const pairs = await deeplClient.getGlossaryLanguagePairs();
    const results = pairs.map(pair => `${pair.sourceLang} → ${pair.targetLang}`);
    return mcpContentifyText(results);
  } catch (error) {
    throw new Error(`Failed to get glossary language pairs: ${error.message}`);
  }
}

async function listStyleRules({ detailed = false } = {}) {
  try {
    const styleRules = await deeplClient.getAllStyleRules(undefined, undefined, detailed);

    if (styleRules.length === 0) {
      return mcpContentifyText("No style rules found");
    }

    const results = styleRules.map(rule => JSON.stringify({
      id: rule.styleId,
      name: rule.name,
      language: rule.language,
      creationTime: rule.creationTime,
      updatedTime: rule.updatedTime,
      ...(detailed && rule.configuredRules ? { configuredRules: rule.configuredRules } : {}),
      ...(detailed && rule.customInstructions ? { customInstructions: rule.customInstructions } : {})
    }, null, 2));

    return mcpContentifyText(results);
  } catch (error) {
    throw new Error(`Failed to list style rules: ${error.message}`);
  }
}

async function getStyleRule({ styleRuleId }) {
  try {
    const rule = await deeplClient.getStyleRule(styleRuleId);

    return mcpContentifyText(JSON.stringify({
      id: rule.styleId,
      name: rule.name,
      language: rule.language,
      creationTime: rule.creationTime,
      updatedTime: rule.updatedTime,
      version: rule.version,
      configuredRules: rule.configuredRules,
      customInstructions: rule.customInstructions
    }, null, 2));
  } catch (error) {
    throw new Error(`Failed to get style rule: ${error.message}`);
  }
}

async function createStyleRule({ name, language, configuredRules }) {
  try {
    const requestBody = { name, language };
    if (configuredRules) requestBody.configured_rules = configuredRules;

    const rule = await deeplClient.createStyleRule(requestBody);

    return mcpContentifyText(JSON.stringify({
      id: rule.styleId,
      name: rule.name,
      language: rule.language,
      creationTime: rule.creationTime,
      updatedTime: rule.updatedTime,
      configuredRules: rule.configuredRules
    }, null, 2));
  } catch (error) {
    throw new Error(`Failed to create style rule: ${error.message}`);
  }
}

async function deleteStyleRule({ styleRuleId }) {
  try {
    await deeplClient.deleteStyleRule(styleRuleId);
    return mcpContentifyText(`Style rule ${styleRuleId} deleted successfully`);
  } catch (error) {
    throw new Error(`Failed to delete style rule: ${error.message}`);
  }
}

async function getUsage() {
  try {
    const usage = await deeplClient.getUsage();
    const results = [];

    if (usage.character) {
      results.push(`Characters: ${usage.character.count} of ${usage.character.limit} used`);
      if (usage.character.limitReached()) {
        results.push('⚠️ Character limit reached!');
      }
    }
    if (usage.document) {
      results.push(`Documents: ${usage.document.count} of ${usage.document.limit} used`);
      if (usage.document.limitReached()) {
        results.push('⚠️ Document limit reached!');
      }
    }
    if (usage.teamDocument) {
      results.push(`Team documents: ${usage.teamDocument.count} of ${usage.teamDocument.limit} used`);
      if (usage.teamDocument.limitReached()) {
        results.push('⚠️ Team document limit reached!');
      }
    }

    if (results.length === 0) {
      results.push('No usage data available');
    }

    return mcpContentifyText(results);
  } catch (error) {
    throw new Error(`Failed to get usage: ${error.message}`);
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
