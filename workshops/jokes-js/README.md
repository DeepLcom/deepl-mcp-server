# Jokes MCP server: JavaScript edition
## About
We made this Jokes server to help you learn how to make an MCP server of your very own. And so we made this as simple as we could. You don't even need an API key to use the Official Joke API; all you have to do is construct the appropriate URL for each endpoint.

### Helper functions
[The FastMCP framework](https://gofastmcp.com) lets Python programmers create an MCP server with very little code.
At press time there's no equivalent for JavaScript. Here, we use the standard MCP JavaScript client library.
So, in order to make the main code here almost as simple as we did in Python, we've included some helper functions:

* `mcpTextContentify()`: the client library expects tools to wrap return values in a complex data type.
Pass this function a string or an array of strings, and it does this work for you.
So, if your tool wants to return `"Why did the chicken cross the road?"`, you would use
`mcpTextContentify("Why did the chicken cross the road?")` .

* `extractJoke()`: the Jokes API returns each joke in an object like this:
`{setup: "Why did the chicken cross the road?", punchline: "To get to the other side!"}`
`extractJoke()` grabs these two strings and glues them together with a newline.
Many AI clients ignore this newline, but it seems reasonable to separate the parts of the joke.

* `handleJokeFetchError()`: given an error message, it writes this to the console, then sends it to the client.

* Each tool here that calls the API relies on a helper function to do so.

### Error checking
Each tool handles basic API access errors. To make this simpler, you could omit this in the functions that call the API. For example:

```js
 async function randomJoke() {
     const res = await axios.get(API_BASE_URL + '/random_joke');
     return mcpTextContentify(extractJoke(res.data));
 }
 ```

Of course, you might regret this when you're trying to debug.

### Input checking
Our tools don't check to make sure input data is in the right format, because we've given
clients two ways to understand what sort of input we'll accept:
* the `description` parameter
* real-time type checking using `zod`

Yes, Typescript lets you check your types while you're writing code and at build time,
but once your code is transpiled to JavaScript, Typescript's out of the picture.
Zod lets you check input at runtime - and AI clients can leverage this to find out
not just whether your tool expects, say, a number, but even whether you want an number in a given range. This is why `server.tool()` wants you to pass it an input schema using the likes of `zod`.

 
### The tools
The tools progress from very simple to a little more elaborate:

* `get_consistent_joke()`: takes no arguments, and returns the same string every time. No API calls. Simplicity itself!
* `get_joke()`: retrieves a random joke from the Jokes API. Again, no arguments - but this time we do actually call the API, get a JSON response, and parse that response to pass the joke along to the client.
* `get_joke_by_id()`: for the first time, we expect a parameter: the id of the joke. We include type hinting here, but you don't really have to. The docstring will tell many AI clients the range for valid id's.
* `get_joke_by_type()`: only a touch more complex than `get_joke_by_id()`. Here, we do use a `Literal` to restrict the type to one of four strings the APi understands. 


## Setup using npm
To set up this project and install dependencies, you'll probably want to use [npm]():
 
 `npm install`

 That's it!

## Usage
### Installing in your favorite desktop AI client
You'll probably want to install this server in your favorite local AI client, like Claude Desktop, ChatGPT for Desktop, Cursor, Windsurf, etc.
To do so, you'll want to insert something like this into the client's JSON file:

```json
    "jokes": {
      "command": "node",
      "args": [
        "/Users/sofo/Code/mcp/jokes-js/jokes.js"
      ]
    }
```

### Development and testing
The MCP Inspector is indispensable for testing and debugging your server.
Assuming you've installed `npx`, you can run the MCP Inspector from your directory like this:
```bash
npx @modelcontextprotocol/inspector node jokes.js
```

If you don't have `npx`, you should be able to install it like this:

```bash
npm install -g npx
```

Have fun!