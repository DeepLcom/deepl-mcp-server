# DeepL Simple Python

We made this very simple version of the DeepL MCP Server to show how this can be done,
in a real-world use case. Like, although this is stripped down, you can totally use it
in production.

## Prerequisites

- You don't need to use [uv](https://docs.astral.sh/uv/) to install and manage your dependencies, but here we do.
- You'll also need a DeepL API key, which you can get [here](https://www.deepl.com/pro-api).

## Setup using uv

### Installing uv

If you don't have uv installed:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Or with pip
pip install uv
```

### 1. Get to the right folder

```bash
cd workshops/deepl-simple-python
```

### 2. Create your virtual environment

```bash
# Create a new virtual environment
uv venv

# Activate the virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
# Install all required packages
uv sync
```

Or install packages individually:

```bash
uv add fastmcp
uv add deepl
uv add fastmcp
```

### 4. Set Up Environment Variables

Create a `.env` file or set your DeepL API key:

```bash
# Option 1: Export environment variable
export DEEPL_API_KEY="your-deepl-api-key-here"

# Option 2: Create .env file
echo "DEEPL_API_KEY=your-deepl-api-key-here" > .env
```

## Usage

### Running the MCP Server

```bash
# Run the DeepL MCP server
python deepl-simple.py
```
## Troubleshooting

### Common Issues

1. **Missing API Key**
   ```
   Error: DEEPL_API_KEY environment variable not set
   ```
   Solution: Set your DeepL API key as described in step 4 above.

2. **Python Version Error**
   ```
   Error: Python >=3.0 required
   ```
   Solution: Install Python 3.13 or use `uv python install 3.13`.

3. **Import Errors**
   ```
   ModuleNotFoundError: No module named 'fastmcp'
   ```
   Solution: Ensure virtual environment is activated and run `uv sync`.

### Getting Help

- Review [DeepL API documentation](https://developers.deepl.com)
- Check the [FastMCP documentation](https://github.com/jlowin/fastmcp)

## License

This project follows the same license as the parent repository.