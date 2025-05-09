# deepl-mcp-server

[![Version](https://img.shields.io/npm/v/deepl-mcp-server.svg)](https://www.npmjs.org/package/deepl-mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-blueviolet.svg)](https://github.com/DeepLcom/deepl-mcp-server/blob/main/LICENSE)
[![smithery badge](https://smithery.ai/badge/@DeepLcom/deepl-mcp-server)](https://smithery.ai/server/@DeepLcom/deepl-mcp-server)

A Model Context Protocol (MCP) server that provides translation capabilities using the DeepL API.

<a href="https://glama.ai/mcp/servers/@DeepLcom/deepl-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@DeepLcom/deepl-mcp-server/badge" alt="DeepL Server MCP server" />
</a>

## Features

- Translate text between numerous languages
- Rephrase text using DeepL's capabilities
- Access to all DeepL API languages and features
- Automatic language detection
- Formality control for supported languages

## Installation

### Installing via Smithery

To install deepl-mcp-server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@DeepLcom/deepl-mcp-server):

```bash
npx --yes @smithery/cli install @DeepLcom/deepl-mcp-server --client claude
```

Clone this repository and install dependencies:

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

3. Add the DeepL MCP server configuration:

```json
{
  "mcpServers": {
    "deepl": {
      "command": "npx",
      "args": ["-y", "/path/to/deepl-mcp-server"],
      "env": {
        "DEEPL_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

4. Replace `/path/to/deepl-mcp-server` with an **absolute path** to your local copy of this repository - for example, `/Users/robotwoman/Code/deepl-mcp-server`
5. Replace `your-api-key-here` with your actual DeepL API key
6. Restart Claude Desktop

Once configured, Claude will be able to use the DeepL translation tools when needed. You can ask Claude to translate text between languages, and it will use the DeepL API behind the scenes.

## Available Tools

This server provides the following tools:

- `get-source-languages`: Get list of available source languages for translation
- `get-target-languages`: Get list of available target languages for translation
- `translate-text`: Translate text to a target language
- `rephrase-text`: Rephrase text in the same or different language

## Tool Details

### translate-text

This tool translates text between languages using the DeepL API.

Parameters:

- `text`: The text to translate
- `targetLang`: Target language code (e.g., 'en-US', 'de', 'fr')
- `formality` (optional): Controls formality level of the translation:
  - `'less'`: use informal language
  - `'more'`: use formal, more polite language
  - `'default'`: use default formality
  - `'prefer_less'`: use informal language if available, otherwise default
  - `'prefer_more'`: use formal language if available, otherwise default

### rephrase-text

This tool rephrases text in the same or different language using the DeepL API.

Parameters:

- `text`: The text to rephrase

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