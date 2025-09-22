# Thanks to https://github.com/15Dkatz/official_joke_api !
# Please see README.md for isntructions and additional info.

import requests
from fastmcp import FastMCP
from typing import Literal, Annotated
from pydantic import Field

API_BASE_URL = 'https://official-joke-api.appspot.com'
JOKE_TYPES = Literal["general", "knock-knock", "programming", "dad"] # the API accepts these types
CONSISTENT_JOKE = "What's brown and sticky?\nA stick! Ha ha ha ha"


mcp = FastMCP("jokes (python)")

### Tools!

@mcp.tool
def get_consistent_joke() -> str:
  '''Tell the same joke, every single time. Be consistent.'''
  return CONSISTENT_JOKE

@mcp.tool
def get_joke() -> str:
  "Get a random joke"
  response = requests.get(API_BASE_URL + '/random_joke')
  json = response.json()
  return extract_joke(json)
  
@mcp.tool
def get_joke_by_id(id: Annotated[int, Field(ge=1, le=451)]) -> str:
  "Get a joke with a specific id (valid range: 1-451)"
  response = requests.get(f"{API_BASE_URL}/jokes/{id}")
  json = response.json()
  return extract_joke(json)

@mcp.tool
def get_joke_by_type(joke_type: JOKE_TYPES) -> str:
  """
  Get a joke of a specific type.
  The type can be "general", "knock-knock", "programming", or "dad".
  """
  response = requests.get(f"{API_BASE_URL}/jokes/{joke_type}/random")
  json = response.json()
  return extract_joke(json[0])


### Helper function, which extracts the setup and punchline from the JSON the API returns,
# then puts them together
def extract_joke(json: dict) -> str:
  return f"{json['setup']}\n{json['punchline']}"
  

if __name__ == "__main__":
  mcp.run()