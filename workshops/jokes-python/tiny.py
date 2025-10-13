# A teeny-tiny version of the Jokes MCP server

from fastmcp import FastMCP

mcp = FastMCP("one joke")

@mcp.tool
def get_consistent_joke() -> str:
  return "What's brown and sticky? A stick!"

if __name__ == "__main__":
  mcp.run()