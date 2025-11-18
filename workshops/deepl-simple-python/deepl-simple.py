# See README.md for instructions on setting up your environment

import os
import deepl
import json
from fastmcp import FastMCP
from typing import Literal, Annotated

FORMALITY_TYPES = Literal["less", "more", "default", "prefer_less", "prefer_more"]
DEEPL_API_KEY = os.environ.get("DEEPL_API_KEY")

deepl_client = deepl.DeepLClient(DEEPL_API_KEY)

mcp = FastMCP("DeepL Translation Simple Server")


# Let's add tools to our server.
# First, a test tool that just returns a constant. Turns out that "dude" is idempotent.
@mcp.tool
def translate_dude() -> str:
    """Translate the word "dude" into any language"""
    return "dude"

# Next, two tools that take no arguments.
@mcp.tool
async def get_source_languages() -> list[dict]:
    """Get list of available source languages for translation"""
    return [vars(lang) for lang in deepl_client.get_source_languages()]

@mcp.tool
def get_target_languages() -> list[dict]:
    """Get list of available target languages for translation"""
    return [vars(lang) for lang in deepl_client.get_target_languages()]

## Finally, a tool which takes arguments.
@mcp.tool
def translate_text(
    text: str,
    targetLang: Annotated[str, "Target language ISO-639 code (e.g. 'en-US', 'de', 'fr')"],
    formality: FORMALITY_TYPES | None = None,
) -> str:
    result = deepl_client.translate_text(text, target_lang=targetLang, formality=formality)
    return result.text


if __name__ == "__main__":
    mcp.run()