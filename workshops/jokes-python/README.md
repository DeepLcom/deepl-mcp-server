# Jokes MCP server: Python edition
## About
We made this Jokes server to help you learn how to make an MCP server of your very own. And so we made this as simple as we could. You don't even need a key to use the Official Joke API; all you have to do is construct the appropriate URL for each endpoint.

### The tools

The tools progress from very simple to a little more elaborate:

* `get_consistent_joke()`: takes no arguments, and returns the same string every time. No API calls. Simplicity itself!
* `get_joke()`: retrieves a random joke from the Jokes API. Again, no arguments - but this time we do actually call the API, get a JSON response, and parse that response to pass the joke along to the client.
* `get_joke_by_id()`: for the first time, we expect a parameter: the id of the joke. We include type hinting here, but you don't really have to. The docstring will tell many AI clients the range for valid id's.
* `get_joke_by_type()`: only a touch more complex than `get_joke_by_id()`. Here, we do use a `Literal` to restrict the type to one of four strings the APi understands. 

### Getting started

To start simply, all you need is the code above the "Tools" comment, the first tool, and the final two lines that end with `mcp.run()`. That's a complete MCP server that simply tells the same joke every time. You can then add the rest of the tools below, one by one or all at once.

### Type hinting

To help AI clients know how to use these tools, we've included type hints here, using docstrings, `typing`, and Pydantic. If you want to make this even simpler, you can leave those out.

So, for example, `get_joke_by_id()` could just be:

```py
@mcp.tool
def get_joke_by_id(id):
  response = requests.get(f"{API_BASE_URL}/jokes/{id}")
  json = response.json()
  return extract_joke(json)
```

### Error checking
To keep the code small, we've only included minimal error checking. For example, we've omitted anything which checks whether API calls have succeeded. You'd want to add such error-checking before using this in the real world. And it certainly helps with debugging.

## Setup using uv

You don't need to use [uv](https://docs.astral.sh/uv/) to install and manage your dependencies. But if you want to do it this way, here's how:

### Installing uv

If you don't have uv installed already, get it like this:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Or with pip
pip install uv
```

### 1. Choose the folder where you've placed `jokes.py` 

```bash
cd workshops/deepl-simple-python
```

### 2. Create your virtual environment

```bash
### Install dependencies from `pyproject.toml`
uv sync

### Activate the virtual environment
# On macOS/Linux:
source .venv/bin/activate

# On Windows:
.venv\Scripts\activate
```

## Usage
### Installing in your favorite desktop AI client
You'll probably want to install this server in your favorite local AI client, like Claude Desktop, ChatGPT for Desktop, Cursor, Windsurf, etc. If you used `uv`, you'd want to insert something like this into the client's JSON file:

```json
    "jokes": {
      "command": "uv",
      "args": [
        "--directory",
        "{FULL PATH TO THE DIRECTORY WHERE YOU PUT THIS PROJECT}",
        "run",
        "fastmcp",
        "run",
        "jokes.py"
      ]
    }
```

For me, I needed to specify the full location of `uv`, since Claude Desktop didn't have it in its path. YMMV.

If you don't want to add JSON by hand, you could use `fastmcp install` to install your server into many popular desktop AI clients. For Claude Desktop, you'd use `fastmcp install claude-desktop jokes.py`. Unfortunately, at least at the time that I tried this, `fastmcp install` will not include the `uv run` arguments.

### Development and testing
You can also test this out using FastMCP's handy development server. To start that up, if you used `uv`, go to this project folder, and type this into your terminal:

```bash
uv run fastmcp dev jokes.py
```

Have fun!