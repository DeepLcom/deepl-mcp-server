import { LanguageCache } from "./languages.mjs";
import { mcpContentifyText, standardizeLangCase } from "./content.mjs";
import { writingStyles, writingTones } from "./writing.mjs";

export function createHandlers(deeplClient) {
  const languages = new LanguageCache(deeplClient);

  async function getSourceLanguages() {
    try {
      const sourceLanguages = await languages.get("source");
      return mcpContentifyText(sourceLanguages.list.map((lang) => JSON.stringify(lang)));
    } catch (error) {
      throw new Error(`Failed to get source languages: ${error.message}`, { cause: error });
    }
  }

  async function getTargetLanguages() {
    try {
      const targetLanguages = await languages.get("target");
      return mcpContentifyText(targetLanguages.list.map((lang) => JSON.stringify(lang)));
    } catch (error) {
      throw new Error(`Failed to get target languages: ${error.message}`, { cause: error });
    }
  }

  async function translateText({
    text,
    sourceLangCode = null,
    targetLangCode,
    formality,
    glossaryId,
    styleId,
    context,
    preserveFormatting,
    splitSentences,
    customInstructions,
  }) {
    if (sourceLangCode) {
      const sourceLanguages = await languages.get("source");
      sourceLangCode = sourceLanguages.normalize(sourceLangCode);
    }

    const targetLanguages = await languages.get("target");
    targetLangCode = targetLanguages.normalize(targetLangCode);

    try {
      const options = { formality };
      if (glossaryId) {
        options.glossary = glossaryId;
      }
      if (styleId) options.styleRule = styleId;
      if (context) options.context = context;
      if (preserveFormatting !== undefined) options.preserveFormatting = preserveFormatting;
      if (splitSentences) options.splitSentences = splitSentences;
      if (customInstructions) options.customInstructions = customInstructions;

      const result = await deeplClient.translateText(text, sourceLangCode, targetLangCode, options);
      const translations = /** @type {import('deepl-node').TextResult[]} */ (
        Array.isArray(result) ? result : [result]
      );
      const detectedSourceLangs = [...new Set(translations.map((t) => t.detectedSourceLang))];

      return mcpContentifyText([
        ...translations.map((translation) => translation.text),
        `Detected source language${detectedSourceLangs.length > 1 ? "s" : ""}: ${detectedSourceLangs.join(", ")}`,
        `Target language used: ${targetLangCode}`,
      ]);
    } catch (error) {
      throw new Error(`Translation failed: ${error.message}`, { cause: error });
    }
  }

  async function rephraseText({ text, targetLangCode, style, tone }) {
    if (targetLangCode) {
      const targetLanguages = await languages.get("target");
      targetLangCode = standardizeLangCase(targetLanguages.normalize(targetLangCode));
    }

    try {
      const result = await deeplClient.rephraseText(text, targetLangCode ?? null, style, tone);
      const rephrasings = /** @type {import('deepl-node').WriteResult[]} */ (
        Array.isArray(result) ? result : [result]
      );
      return mcpContentifyText(rephrasings.map((rephrasing) => rephrasing.text));
    } catch (error) {
      throw new Error(`Rephrasing failed: ${error.message}`, { cause: error });
    }
  }

  async function getWritingStyles() {
    return mcpContentifyText(writingStyles);
  }

  async function getWritingTones() {
    return mcpContentifyText(writingTones);
  }

  async function translateDocument({
    inputFile,
    outputFile,
    sourceLangCode,
    targetLangCode,
    formality,
    glossaryId,
    styleId,
    outputFormat,
  }) {
    if (sourceLangCode) {
      const sourceLanguages = await languages.get("source");
      sourceLangCode = sourceLanguages.normalize(sourceLangCode);
    }

    const targetLanguages = await languages.get("target");
    targetLangCode = targetLanguages.normalize(targetLangCode);

    // Generate output file name if not provided
    if (!outputFile) {
      const path = await import("path");
      const parsedPath = path.parse(inputFile);
      const extension = outputFormat ? `.${outputFormat.toLowerCase()}` : parsedPath.ext;
      outputFile = path.join(parsedPath.dir, `${parsedPath.name}_${targetLangCode}${extension}`);
    }

    try {
      const options = { formality };
      if (glossaryId) {
        options.glossary = glossaryId;
      }
      // The client library ignores styleRule for documents, so both extras go via extra parameters
      const extraRequestParameters = {};
      if (styleId) extraRequestParameters.style_id = styleId;
      if (outputFormat) extraRequestParameters.output_format = outputFormat;
      if (Object.keys(extraRequestParameters).length > 0) {
        options.extraRequestParameters = extraRequestParameters;
      }

      const result = await deeplClient.translateDocument(
        inputFile,
        outputFile,
        sourceLangCode
          ? /** @type {import('deepl-node').SourceLanguageCode} */ (sourceLangCode)
          : null,
        /** @type {import('deepl-node').TargetLanguageCode} */ (targetLangCode),
        options,
      );

      return mcpContentifyText([
        `Document translated successfully! Status: ${result.status}`,
        `Target language used: ${targetLangCode}`,
        `Characters billed: ${result.billedCharacters}`,
        `Output file: ${outputFile}`,
      ]);
    } catch (error) {
      throw new Error(`Document translation failed: ${error.message}`, { cause: error });
    }
  }

  async function listGlossaries() {
    try {
      const glossaries = await deeplClient.listMultilingualGlossaries();

      if (glossaries.length === 0) {
        return mcpContentifyText("No glossaries found");
      }

      const results = glossaries.map((glossary) =>
        JSON.stringify(
          {
            id: glossary.glossaryId,
            name: glossary.name,
            dictionaries: glossary.dictionaries,
            creationTime: glossary.creationTime,
          },
          null,
          2,
        ),
      );

      return mcpContentifyText(results);
    } catch (error) {
      throw new Error(`Failed to list glossaries: ${error.message}`, { cause: error });
    }
  }

  async function getGlossary({ glossaryId }) {
    try {
      const glossary = await deeplClient.getMultilingualGlossary(glossaryId);

      const result = {
        id: glossary.glossaryId,
        name: glossary.name,
        dictionaries: glossary.dictionaries,
        creationTime: glossary.creationTime,
      };

      return mcpContentifyText(JSON.stringify(result, null, 2));
    } catch (error) {
      throw new Error(`Failed to get glossary: ${error.message}`, { cause: error });
    }
  }

  async function getGlossaryDictionaryEntries({ glossaryId, sourceLangCode, targetLangCode }) {
    try {
      if (!sourceLangCode || !targetLangCode) {
        throw new Error(
          "To access a glossary dictionary, you must specify its source and target languages",
        );
      }

      const dictionarySourceLang = sourceLangCode.split("-")[0].toLowerCase();
      const dictionaryTargetLang = targetLangCode.split("-")[0].toLowerCase();

      const entriesResult = await deeplClient.getMultilingualGlossaryDictionaryEntries(
        glossaryId,
        dictionarySourceLang,
        dictionaryTargetLang,
      );

      const results = [
        `Language pair: ${dictionarySourceLang} → ${dictionaryTargetLang}`,
        "",
        "Entries:",
        JSON.stringify(entriesResult.entries.entries(), null, 2),
      ];

      return mcpContentifyText(results);
    } catch (error) {
      throw new Error(`Failed to get glossary dictionary entries: ${error.message}`, {
        cause: error,
      });
    }
  }

  async function listStyleRules({ page, pageSize, detailed }) {
    try {
      const styleRules = await deeplClient.getAllStyleRules(page, pageSize, detailed);

      if (styleRules.length === 0) {
        return mcpContentifyText("No style rules found");
      }

      return mcpContentifyText(styleRules.map((styleRule) => JSON.stringify(styleRule, null, 2)));
    } catch (error) {
      throw new Error(`Failed to list style rules: ${error.message}`, { cause: error });
    }
  }

  async function getStyleRule({ styleId }) {
    try {
      const styleRule = await deeplClient.getStyleRule(styleId);
      return mcpContentifyText(JSON.stringify(styleRule, null, 2));
    } catch (error) {
      throw new Error(`Failed to get style rule: ${error.message}`, { cause: error });
    }
  }

  async function getCustomInstruction({ styleId, instructionId }) {
    try {
      const instruction = await deeplClient.getStyleRuleCustomInstruction(styleId, instructionId);
      return mcpContentifyText(JSON.stringify(instruction, null, 2));
    } catch (error) {
      throw new Error(`Failed to get custom instruction: ${error.message}`, { cause: error });
    }
  }

  return {
    getSourceLanguages,
    getTargetLanguages,
    translateText,
    rephraseText,
    getWritingStyles,
    getWritingTones,
    translateDocument,
    listGlossaries,
    getGlossary,
    getGlossaryDictionaryEntries,
    listStyleRules,
    getStyleRule,
    getCustomInstruction,
  };
}
