import { z } from "zod";
import { writingStyles, writingTones } from "./writing.mjs";

// Descriptive text for reuse in our tools
const languageCodeDescription =
  "language code, in standard ISO-639-1 format (e.g. 'en-US', 'de', 'fr')";
const sourceLanguageCodeDescription =
  "language code, in standard ISO-639-1 format (e.g. 'en', 'de', 'fr')";
const glossaryLanguageCodeDescription =
  "language code, in standard ISO-639-1 format without a regional variant (e.g. 'en', 'de', 'fr')";
const glossaryEntriesGuidance =
  "This does not fetch any glossary entries. Use the get-glossary-dictionary-entries tool to fetch entries.";
const styleRuleDescription =
  "Style rule ID to apply. Use the list-style-rules tool to discover available style rules.";

const formalityTypes = /** @type {const} */ ([
  "less",
  "more",
  "default",
  "prefer_less",
  "prefer_more",
]);

/**
 * Text inputs take a single string or an array of strings, each handled independently
 * @param {string} verb
 */
function textInput(verb) {
  return z
    .union([z.string(), z.array(z.string())])
    .describe(`Text to ${verb}, as a single string or an array of strings handled independently`);
}

export function registerTools(server, handlers) {
  server.tool(
    "get-source-languages",
    "Get list of available source languages for translation",
    handlers.getSourceLanguages,
  );

  server.tool(
    "get-target-languages",
    "Get list of available target languages for translation",
    handlers.getTargetLanguages,
  );

  server.tool(
    "translate-text",
    "Translate text to a target language using DeepL API. Review all available optional parameters and use those applicable to your scenario for best results. When the translation includes a glossary, you must specify the source language as well as the target language. If the user requests a glossary by name instead of by id, you can use the list-glossaries tool to get a name for each id.",
    {
      text: textInput("translate"),
      sourceLangCode: z
        .string()
        .optional()
        .describe(`source ${sourceLanguageCodeDescription}, or leave empty for auto-detection`),
      targetLangCode: z.string().describe("target " + languageCodeDescription),
      formality: z
        .enum(formalityTypes)
        .optional()
        .describe(
          "Controls formality: 'less' for informal, 'more' for formal/polite, 'prefer_less'/'prefer_more' to prefer but fall back to default",
        ),
      glossaryId: z
        .string()
        .optional()
        .describe("Glossary ID to ensure consistent terminology translation"),
      styleId: z.string().optional().describe(styleRuleDescription),
      context: z
        .string()
        .optional()
        .describe(
          "Recommended: describe what this text is about (e.g., 'Technical documentation for a software API'). Improves translation accuracy but is not itself translated.",
        ),
      preserveFormatting: z
        .boolean()
        .optional()
        .describe(
          "Set to true to preserve original formatting - recommended for markdown, code blocks, HTML, or any structured text",
        ),
      splitSentences: z
        .enum(["0", "1", "nonewlines"])
        .optional()
        .describe(
          "Sentence splitting: '0' disables, '1' (default) splits on punctuation and newlines, 'nonewlines' preserves line breaks",
        ),
      customInstructions: z
        .array(z.string())
        .optional()
        .describe(
          "Array of custom instructions to guide translation style (max 10 instructions, 300 chars each)",
        ),
    },
    handlers.translateText,
  );

  server.tool(
    "get-writing-styles",
    "Get list of writing styles the DeepL API can use while rephrasing text",
    handlers.getWritingStyles,
  );

  server.tool(
    "get-writing-tones",
    "Get list of writing tones the DeepL API can use while rephrasing text",
    handlers.getWritingTones,
  );

  server.tool(
    "rephrase-text",
    "Rephrase text in the same language, or into a different language, using DeepL API",
    {
      text: textInput("rephrase"),
      targetLangCode: z
        .string()
        .optional()
        .describe(
          `target ${languageCodeDescription} to rephrase into a different language, or leave empty to keep the original language`,
        ),
      style: z.enum(writingStyles).optional().describe("Writing style for rephrasing"),
      tone: z.enum(writingTones).optional().describe("Writing tone for rephrasing"),
    },
    handlers.rephraseText,
  );

  server.tool(
    "translate-document",
    "Translate a document file using DeepL API",
    {
      inputFile: z.string().describe("Path to the input document file to translate"),
      outputFile: z
        .string()
        .optional()
        .describe(
          "Path where the translated document will be saved (if not provided, will be auto-generated)",
        ),
      sourceLangCode: z
        .string()
        .optional()
        .describe(`source ${sourceLanguageCodeDescription}, or leave empty for auto-detection`),
      targetLangCode: z.string().describe("target " + languageCodeDescription),
      formality: z
        .enum(["less", "more", "default", "prefer_less", "prefer_more"])
        .optional()
        .describe("Controls whether translations should lean toward informal or formal language"),
      glossaryId: z.string().optional().describe("ID of glossary to use for translation"),
      styleId: z.string().optional().describe(styleRuleDescription),
      outputFormat: z
        .string()
        .optional()
        .describe(
          "Desired output file format (e.g. 'pdf'), or leave empty to keep the input format. Only some conversions are supported.",
        ),
    },
    handlers.translateDocument,
  );

  server.tool(
    "list-glossaries",
    "Get a list of all glossaries with metadata for each - name, dictionaries available, and creation time. " +
      glossaryEntriesGuidance,
    handlers.listGlossaries,
  );

  server.tool(
    "get-glossary-info",
    "Given an id, get metadata about the glossary with that id - its name, available dictionaries, and creation time. " +
      glossaryEntriesGuidance,
    {
      glossaryId: z.string().describe("The unique identifier of the glossary"),
    },
    handlers.getGlossary,
  );

  server.tool(
    "get-glossary-dictionary-entries",
    "Retrieve all the entries from a given glossary dictionary. (A glossary consists one of one or more dictionaries, each of which contains entries for a specific language pair, in one direction. For example, one dictionary could contain entries for translations from German to English, and another dictionary could contain entries for translations from English to German.) To retrieve all entries for a glossary with multiple dictionaries, use the get-glossary-info or list-glossaries tool to find out what dictionaries it contains, then use this tool for each dictionary.",
    {
      glossaryId: z.string().describe("The unique identifier of the glossary"),
      sourceLangCode: z.string().describe(`source ${glossaryLanguageCodeDescription}`),
      targetLangCode: z.string().describe(`target ${glossaryLanguageCodeDescription}`),
    },
    handlers.getGlossaryDictionaryEntries,
  );

  server.tool(
    "list-style-rules",
    "Get a list of all style rules with metadata for each - id, name, language, and timestamps. Style rules can be applied when translating text or documents. Use the get-style-rule tool to fetch the configured rules and custom instructions of a single style rule.",
    {
      page: z.number().int().min(0).optional().describe("Page number, 0-based"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Number of style rules per page (max 10)"),
      detailed: z
        .boolean()
        .optional()
        .describe(
          "Set to true to include the configured rules and custom instructions of each rule",
        ),
    },
    handlers.listStyleRules,
  );

  server.tool(
    "get-style-rule",
    "Given an id, get a single style rule with its full detail - configured rules and custom instructions.",
    {
      styleId: z.string().describe("The unique identifier of the style rule"),
    },
    handlers.getStyleRule,
  );

  server.tool(
    "get-custom-instruction",
    "Get a single custom instruction belonging to a style rule. Use the get-style-rule tool to find out which custom instructions a style rule contains.",
    {
      styleId: z.string().describe("The unique identifier of the style rule"),
      instructionId: z.string().describe("The unique identifier of the custom instruction"),
    },
    handlers.getCustomInstruction,
  );
}
