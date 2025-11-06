/***
 * Thanks to https://github.com/15Dkatz/official_joke_api !
 * Please see README.md for instructions and additional information.
 */ 

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const z = require("zod");
const axios = require("axios");

const API_BASE_URL = 'https://official-joke-api.appspot.com/';
const jokeTypes = ["general", "knock-knock", "programming", "dad"];
const consistentJoke = "What's brown and sticky?\nA stick! Ha ha ha ha";

/*** 
 * Set up our server.
 * We'll start our server off with no resources or tools. 
 * Don't worry - we'll add those later!
 */

const server = new McpServer({
  name: "jokes",
  version: "1.0.0"
});

/*** Add tools to our server ***/
/*
 * Each of these tools, except the first, calls one of the helper functions below to 
 * access the Joke API.
 * For the first tool, we simply include the function inline.
*/

// First, add a tool that simply returns a constant
server.tool(
  'get-consistent-joke',
  'Tell the same joke, every single time',
  async () => mcpTextContentify(consistentJoke)
);

// Next, slightly more elaborate - a tool that calls the joke API
server.tool(
  'get-joke',
  'Get a random joke',
  randomJoke
);

// Slightly more advanced: a tool which wants to be passed an integer in a fixed range
server.tool(
  'get-joke-by-id',
  'Get a joke with a specific id. The id must be between 1 and 451.',
  {
    id: z.number().int().min(1).max(451)
  },
  jokeByID
);

// Finally, a tool which expects one of a set of strings
server.tool(
  'get-joke-by-type',
  'Get a joke of a specific type, which must be "general", "knock-knock", "programming", or "dad"',
  {
    jokeType: z.enum(jokeTypes)
  },
  jokeByType
);


/*** Helper functions ***/
/* These functions call the Jokes API. */

async function randomJoke() {
  try {
    const res = await axios.get(API_BASE_URL + '/random_joke');
    return mcpTextContentify(extractJoke(res.data));
  } catch (error) {
    handleJokeFetchError(error);
  }
}

async function jokeByID({ id }) {
  try {
    const res = await axios.get(`${API_BASE_URL}/jokes/${id}`);
    return mcpTextContentify(extractJoke(res.data));
  } catch (error) {
    handleJokeFetchError(error);
  }
}

async function jokeByType({ jokeType }) {
  try {
    const res = await axios.get(`${API_BASE_URL}/jokes/${jokeType}/random`);
    if (res.data?.[0]) {
      return mcpTextContentify(extractJoke(res.data[0]))
    } else {
      throw new Error('The Joke API was supposed to return an array');
    }

  } catch (error) {
    handleJokeFetchError(error);
  }
}

/*** Helper functions to make our lives easier */

// Pass us proper JSON from the Joke API, and we will pull out and format the strings.
function extractJoke(json) {
  return `${json.setup}\n${json.punchline}`;
}


// Helper function which wraps a string or strings in the object structure MCP expects
// Accept either a string or an array of strings, with partial error checking
function mcpTextContentify(param) {
  if (typeof(param) != 'string' && !Array.isArray(param)) {
    handleJokeFetchError('mcpTextContentify() expects a string or an array of strings');
  }

  let strings = typeof(param) == 'string' ? [param] : param;

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


// The client will run this to fire up our server

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("The jokes server is running on stdio, wahoo");
}

main().catch((error) => {
  console.error("The joke's on you. The server's busted! Fatal error: ", error);
  process.exit(1);
});

// FInally, a helper function to deal with errors. Output the error and send it to the client.
function handleJokeFetchError(error) {
  console.error("Error fetching joke: ", error);
  
  let errorContent = mcpTextContentify("Sorry, I failed to fetch a joke. I am... a joke.");
  errorContent.isError = true;
  return errorContent;
}