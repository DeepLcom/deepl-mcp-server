/**
 * Cast a language code the way the API wants it, like `en-US`. The client library does this itself
 * for translations, but not for rephrasing
 * @param {string} code
 */
export function standardizeLangCase(code) {
  const [lang, region] = code.split("-", 2);
  return region === undefined
    ? lang.toLowerCase()
    : `${lang.toLowerCase()}-${region.toUpperCase()}`;
}

/**
 * Helper function which wraps a string or strings in the object structure MCP expects
 * @param {string | string[]} param
 */
export function mcpContentifyText(param) {
  if (typeof param != "string" && !Array.isArray(param)) {
    throw new Error("mcpContentifyText() expects a string or an array of strings");
  }

  const strings = typeof param === "string" ? [param] : param;

  const contentObjects = strings.map(
    (str) =>
      /** @type {const} */ ({
        type: "text",
        text: str,
      }),
  );

  return {
    content: contentObjects,
  };
}
