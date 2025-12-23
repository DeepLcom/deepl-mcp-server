# deepl-mcp-server

[![Version](https://img.shields.io/npm/v/deepl-mcp-server.svg)](https://www.npmjs.org/package/deepl-mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-blueviolet.svg)](https://github.com/DeepLcom/deepl-mcp-server/blob/main/LICENSE)
[![smithery badge](https://smithery.ai/badge/@DeepLcom/deepl-mcp-server)](https://smithery.ai/server/@DeepLcom/deepl-mcp-server)

A Model Context Protocol (MCP) server that provides translation capabilities using the DeepL API.

## Features

- Translate text between numerous languages
- Translate documents
- Rephrase text using DeepL's capabilities
- Access to all DeepL API languages and features
- Automatic language detection
- Formality control for supported languages
- DeepL glossary support for consistent terminology translation

## Usage

The easiest way to run this server is to use the npm package without installing anything:
```bash
npx deepl-mcp-server
```

If you want to install this locally, so you can play with it to your heart's content, you can do so using npm:
```bash
npm install deepl-mcp-server
```

Alternately, if you want to contribute, you can clone this repository and install dependencies:

```bash
git clone https://github.com/DeepLcom/deepl-mcp-server.git
cd deepl-mcp-server
npm install
```

## Configuration

### DeepL API Key

You'll need a DeepL API key to use this server. You can get one by signing up at [DeepL API](https://www.deepl.com/pro-api?utm_source=github&utm_medium=github-mcp-server-readme). With a DeepL API Free account you can translate up to 500,000 characters/month for free.

## Using with Claude Desktop

This MCP server integrates with Claude Desktop to provide translation capabilities directly in your conversations with Claude.

### Configuration Steps

1. Install Claude Desktop if you haven't already
2. Create or edit the Claude Desktop configuration file:

   - On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - On Windows: `%AppData%\Claude\claude_desktop_config.json`
   - On Linux: `~/.config/Claude/claude_desktop_config.json`

3. Add the DeepL MCP server configuration. If you want to use the npm package without installing anything, as described above:

```json
{
  "mcpServers": {
    "deepl": {
      "command": "npx",
      "args": ["deepl-mcp-server"],
      "env": {
        "DEEPL_API_KEY": "{YOUR_API_KEY}"
      }
    }
  }
}
```

Or, if you installed this locally, give Claude an absolute path to the JS file, like this:

```json
{
  "mcpServers": {
    "deepl": {
      "command": "node",
      "args": ["/{ABSOLUTE_PATH_TO_SERVER}/deepl-mcp-server/src/index.mjs"],
      "env": {
        "DEEPL_API_KEY": "{YOUR_API_KEY}"
      }
    }
  }
}
```

If you've pulled down this code, but you haven't done an `npm install`, or if you just prefer to, you can use `npx /{ABSOLUTE_PATH_TO_SERVER}/deepl-mcp-server` here instead of `node /{ABSOLUTE_PATH_TO_SERVER}/deepl-mcp-server/src/index.mjs`.

4. Replace `{ABSOLUTE_PATH_TO_SERVER}` with an **absolute path** to your local copy of this repository - for example, `/Users/robotwoman/Code/deepl-mcp-server`
5. Replace `{YOUR_API_KEY}` with your actual DeepL API key
6. Restart Claude Desktop

Once configured, Claude will be able to use the DeepL translation tools when needed. You can ask Claude to translate text between languages, and it will use the DeepL API behind the scenes.

## Available Tools

This server provides the following tools:

- `get-source-languages`: Get list of available source languages for translation
- `get-target-languages`: Get list of available target languages for translation
- `translate-text`: Translate text to a target language
- `rephrase-text`: Rephrase text in the same or different language
- `translate-document`: Translate a document
- `list-glossaries`: Get list of all glossaries and their associated metadata
- `get-glossary-info`: Get metadata about a specific glossary by id
- `get-glossary-dictionary-entries`: Retrieve entries from a glossary dictionary

## Tool Details

### Translation tools

#### translate-text

This tool translates text between languages using the DeepL API.

Parameters:

- `text`: The text to translate
- `sourceLangCode` (optional): Source language code (e.g., 'en', 'de', 'fr'). Leave empty for automatic detection. **Required when using a glossary**.
- `targetLangCode`: Target language code (e.g., 'en-US', 'de', 'fr')
- `formality` (optional): Controls formality level of the translation:
  - `'less'`: use informal language
  - `'more'`: use formal, more polite language
  - `'default'`: use default formality
  - `'prefer_less'`: use informal language if available, otherwise default
  - `'prefer_more'`: use formal language if available, otherwise default
  - `glossaryId` (optional): id of a glossary to apply to the translation

#### translate-document
This tool translates document files using the DeepL API. Supported formats include PDF, DOCX, PPTX, XLSX, HTML, TXT, and more.

**Note**: Since this tool expects a filename, your AI agent will need access to a filesystem tool.

Parameters:
- `inputFile`: Path to the input document file to translate
- `outputFile` (optional): Path where the translated document will be saved. If not provided, will be auto-generated based on the input filename with the target language code appended (e.g., `document_de.pdf` for German translation)
- `sourceLangCode` (optional): Source language code (e.g., 'en', 'de', 'fr'). Leave empty for automatic detection. **Required when using a glossary**.
- `targetLangCode`: Target language code (e.g., 'en-US', 'de', 'fr')
- `formality` (optional): Controls formality level (same options as `translate-text`)
- `glossaryId` (optional): ID of a glossary to use for consistent terminology translation

Returns:
- Translation status
- Number of characters billed
- Output file path

### Glossary Tools

Most agents are smart enough to use a given glossary in translation if you pass along the glossary's name. 
The agent can use `list-glossaries` to pull metadata on all your glossaries, which includes their names. 
And then it can include the right glossary's id. But you can also just give the agent a glossary id.

#### list-glossaries

Lists all glossaries available in your DeepL account with their metadata.

Returns for each glossary:
- `id`: Unique identifier for the glossary
- `name`: Human-readable name
- `dictionaries`: Available language pair dictionaries (e.g., `{"en": ["de"], "de": ["en"]}` for bidirectional EN↔DE)
- `creationTime`: When the glossary was created

**Note**: This tool returns metadata only, not the actual glossary entries.

#### get-glossary-info

Retrieves metadata about a specific glossary by its ID.

Parameters:
- `glossaryId`: The unique identifier of the glossary

Returns the same information as `list-glossaries` but for a single glossary.

**Note**: This tool returns metadata only, not the actual glossary entries.

#### get-glossary-dictionary-entries

Retrieves the actual term entries from a specific glossary dictionary.

A dictionary is a list of entries for a specific language pair and translation direction. 
A glossary can contain multiple dictionaries. For example, a bidirectional English-German glossary would have two dictionaries: one for EN→DE and another for DE→EN. 

Most agents are able to retrieve an entire glossary by using `list-glossaries` or `get-glossary-info` to find available dictionaries, then calling this tool for each one.

Parameters:
- `glossaryId`: The unique identifier of the glossary
- `sourceLangCode`: Source language code for the dictionary (e.g., 'en')
- `targetLangCode`: Target language code for the dictionary (e.g., 'de')

Returns:
- Glossary name
- Language pair being retrieved
- All entries in the dictionary as key-value pairs

### Other tools

#### rephrase-text

This tool rephrases text in a given language.

Parameters:

- `text`: The text to rephrase
- `style` (optional): Writing style for the rephrased text. Use `get-writing-styles` to see available options (e.g., 'business', 'academic', 'casual')
- `tone` (optional): Writing tone for the rephrased text. Use `get-writing-tones` to see available options (e.g., 'enthusiastic', 'friendly', 'professional')

#### get-source-languages

Returns the complete list of source languages supported by the DeepL API, with language names and ISO-639 codes.

_No parameters required._

#### get-target-languages

Returns the complete list of target languages supported by the DeepL API, with language names and ISO-639 codes.

_No parameters required._

#### get-writing-styles

Returns the list of available writing styles that can be used with the `rephrase-text` tool. These styles adjust the overall character of the writing to suit different contexts.

No parameters required.


#### get-source-languages

Returns the complete list of source languages supported by the DeepL API, with language names and ISO-639 codes.

_No parameters required._

#### get-target-languages

Returns the complete list of target languages supported by the DeepL API, with language names and ISO-639 codes.

_No parameters required._

## Supported Languages

The DeepL API supports a wide variety of languages for translation. You can use the `get-source-languages` and `get-target-languages` tools to see all currently supported languages.

Some examples of supported languages include:

- English (en, en-US, en-GB)
- German (de)
- Spanish (es)
- French (fr)
- Italian (it)
- Japanese (ja)
- Chinese (zh)
- Portuguese (pt-BR, pt-PT)
- Russian (ru)
- And many more

## Debugging

For debugging information, visit the [MCP debugging documentation](https://modelcontextprotocol.io/docs/tools/debugging).

## Error Handling

If you encounter errors with the DeepL API, check the following:

- Verify your API key is correct
- Make sure you're not exceeding your API usage limits
- Confirm the language codes you're using are supported

## License

MIT

## Links

- [DeepL API Documentation](https://www.deepl.com/docs-api?utm_source=github&utm_medium=github-mcp-server-readme)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/docs/)
