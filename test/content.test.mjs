import { describe, expect, it } from "vitest";
import { mcpContentifyText, standardizeLangCase } from "../src/content.mjs";

describe("mcpContentifyText", () => {
  it("wraps a single string in one content object", () => {
    expect(mcpContentifyText("Hallo")).toEqual({ content: [{ type: "text", text: "Hallo" }] });
  });

  it("wraps an array of strings in one content object each", () => {
    expect(mcpContentifyText(["Hallo", "Welt"])).toEqual({
      content: [
        { type: "text", text: "Hallo" },
        { type: "text", text: "Welt" },
      ],
    });
  });

  it("rejects anything that is not a string or an array", () => {
    const message = "mcpContentifyText() expects a string or an array of strings";
    expect(() => mcpContentifyText(null)).toThrow(message);
    expect(() => mcpContentifyText(42)).toThrow(message);
    expect(() => mcpContentifyText({ text: "Hallo" })).toThrow(message);
  });
});

describe("standardizeLangCase", () => {
  it("uppercases the region and lowercases the language", () => {
    expect(standardizeLangCase("en-us")).toBe("en-US");
    expect(standardizeLangCase("DE")).toBe("de");
  });
});
