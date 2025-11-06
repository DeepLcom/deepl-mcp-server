/* 
This is a simplified version of the DeepL MCP server for workshops.
It tries to make the tools easier to write - and contains abridged functionality.
To set up this project and install dependencies: 
npm init -y
npm install @modelcontextprotocol/sdk zod axios deepl-node
*/

/*** Do basic setup. We'll start our server off with no resources or tools. 
 *   We'll add those later. */

//TODO: add new mcpTextContentify()

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const z = require('zod');
const deepl = require('deepl-node');

const formalityTypes = ['less', 'more', 'default', 'prefer_less', 'prefer_more'];

const deeplClient = new deepl.DeepLClient(process.env.DEEPL_API_KEY);

// Make an empty MCP server.
const server = new McpServer({
  name: "deepl-simple",
  version: "1.0.0"
});


/*** Now, we'll add tools to our server. */

// First, a test tool that just returns a constant. Turns out that "dude" is idempotent.
server.tool(
  'translate-dude',
  'Translate the word "dude" into any language',
  async () => mcpTextContentify(['dude'])
);

// Next, two tools that take no arguments.
server.tool(
  'get-source-languages',
  'Get list of available source languages for translation',
  getSourceLanguages
);

server.tool(
  'get-target-languages',
  'Get list of available target languages for translation',
  getTargetLanguages
);

// Finally, a tool which takes arguments.
server.tool(
  "translate-text",
  "Translate text to a target language using the DeepL API",
  {
    text: z.string().describe("Text to translate"),
    targetLang: z.string().describe("Target language ISO-639 code (e.g. 'en-US', 'de', 'fr')"),
    formality: z.enum(formalityTypes).optional()
                .describe("Controls whether translations should lean toward informal or formal language"),
  },
  translateText
);


/*** Helper functions which call the DeepL API */

async function getSourceLanguages() {
  return await getDeeplLanguages('source');
}

async function getTargetLanguages() {
  return await getDeeplLanguages('target');
}

async function getDeeplLanguages(sourceOrDestination) {
  const method = sourceOrDestination == 'source' ? 'getSourceLanguages' : 'getTargetLanguages';

  try {
    const languages = await deeplClient[method]();
    return mcpTextContentify(languages.map(JSON.stringify));  

  } catch (error) {
    return handleError(error);
  }
}

async function translateText({text, targetLang, formality}) {
  try {
    const result = await deeplClient.translateText( text, null, targetLang, { formality });
    return mcpTextContentify([
      result.text,
      'Detected source language: ' + result.detectedSourceLang
    ]);

  } catch (error) {
    return handleError(error);
  }
}

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

// Finally, a helper function to pass errors back to the AI surface
function handleError(error) {
  console.error("Error in the DeepL MCP server: ", error);

  const errorContentObject = mcpTextContentify([error.message]);
  errorContentObject.isError = true;

  return errorContentObject;
}


/*** The client will run this to fire up our server */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("The DeepL server is running on stdio, wahoo");
}

main().catch((error) => {
  console.error("Sorry, we had a horrible problem. Fatal error: ", error.message);
  process.exit(1);
});