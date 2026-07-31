# deepl-mcp-server

[![Version](https://img.shields.io/npm/v/deepl-mcp-server.svg)](https://www.npmjs.org/package/deepl-mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-blueviolet.svg)](https://github.com/DeepL/deepl-mcp-server/blob/main/LICENSE)

A Model Context Protocol (MCP) server that exposes DeepL text translation, document translation, rephrasing, and glossary and style rule lookups as MCP tools.

## Usage

You need Node.js 18 or newer and a DeepL API key. Pick an [API plan](https://www.deepl.com/pro-api?utm_source=github&utm_medium=github-mcp-server-readme) and create a key in your DeepL account.

The server communicates over stdio, so it is normally started by an MCP client rather than by hand. To try it directly:

```bash
DEEPL_API_KEY=your-api-key npx -y deepl-mcp-server
```

It exits immediately if `DEEPL_API_KEY` is not set.

To work on the server itself:

```bash
git clone https://github.com/DeepL/deepl-mcp-server.git
cd deepl-mcp-server
npm install
```

## Configuration

Register it as a stdio server with `DEEPL_API_KEY` in the server's environment. In Claude Code:

```bash
claude mcp add deepl --env DEEPL_API_KEY=your-api-key -- npx -y deepl-mcp-server
```

For clients configured through a JSON file:

```json
{
  "mcpServers": {
    "deepl": {
      "command": "npx",
      "args": ["-y", "deepl-mcp-server"],
      "env": {
        "DEEPL_API_KEY": "your-api-key"
      }
    }
  }
}
```

Where that file lives and how each client expects local stdio servers to be declared:

- [Claude Code](https://code.claude.com/docs/en/mcp)
- [Claude Desktop](https://modelcontextprotocol.io/docs/develop/connect-local-servers)
- [Cursor](https://cursor.com/docs/context/mcp)
- [VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

To run a local checkout instead of the published package, use `node` as the command and the absolute path to `src/index.mjs` as the argument.

## Tools

| Tool                              | Description                                                                                            | Parameters                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `translate-text`                  | Translates text into a target language.                                                                | `text`, `targetLangCode`, `sourceLangCode?`, `formality?`, `glossaryId?`, `styleId?`, `context?`, `preserveFormatting?`, `splitSentences?`, `customInstructions?` |
| `translate-document`              | Translates a document file (PDF, DOCX, PPTX, XLSX, HTML, TXT, and more) and writes the result to disk. | `inputFile`, `targetLangCode`, `outputFile?`, `sourceLangCode?`, `formality?`, `glossaryId?`, `styleId?`, `outputFormat?`                                         |
| `rephrase-text`                   | Rephrases text, optionally into another language.                                                      | `text`, `targetLangCode?`, `style?`, `tone?`                                                                                                                      |
| `get-source-languages`            | Lists the language codes accepted as a translation source.                                             | none                                                                                                                                                              |
| `get-target-languages`            | Lists the language codes accepted as a translation target.                                             | none                                                                                                                                                              |
| `get-writing-styles`              | Lists the `style` values `rephrase-text` accepts.                                                      | none                                                                                                                                                              |
| `get-writing-tones`               | Lists the `tone` values `rephrase-text` accepts.                                                       | none                                                                                                                                                              |
| `list-glossaries`                 | Lists every glossary in the account with its id, name, dictionaries, and creation time.                | none                                                                                                                                                              |
| `get-glossary-info`               | Returns the same metadata as `list-glossaries` for a single glossary.                                  | `glossaryId`                                                                                                                                                      |
| `get-glossary-dictionary-entries` | Returns the term entries of one glossary dictionary, meaning one language pair in one direction.       | `glossaryId`, `sourceLangCode`, `targetLangCode`                                                                                                                  |
| `list-style-rules`                | Lists the style rules in the account with their id, name, language, and timestamps.                    | `page?`, `pageSize?`, `detailed?`                                                                                                                                 |
| `get-style-rule`                  | Returns one style rule in full, including its configured rules and custom instructions.                | `styleId`                                                                                                                                                         |
| `get-custom-instruction`          | Returns a single custom instruction belonging to a style rule.                                         | `styleId`, `instructionId`                                                                                                                                        |

Notes:

- `text` takes either a single string or an array of strings. Each entry is translated or rephrased independently.
- Language codes are ISO 639-1, optionally with a region (`en-US`). Omitting `sourceLangCode` triggers automatic detection. A target code whose language requires a region gets a default applied: `en` becomes `en-US`, `pt` becomes `pt-BR`, `zh` becomes `zh-Hans`.
- Glossary dictionaries are keyed by non-regional codes, so `get-glossary-dictionary-entries` drops any region you pass.
- Translating with a glossary requires an explicit `sourceLangCode`.
- `formality` accepts `less`, `more`, `default`, `prefer_less`, and `prefer_more`. The `prefer_*` values fall back to the default when the target language has no formality support.
- `translate-document` reads and writes files on the machine running the server. Without `outputFile`, the output path is derived from the input by appending the target language code, for example `report_de.pdf`. With `outputFormat`, the derived path uses that extension instead.
- Style rules and custom instructions are read-only here. Create and edit them in your DeepL account.

## License

MIT
