import * as deepl from "deepl-node";

// Import WritingStyle and WritingTone enums from DeepL, and transform each to arrays of strings
export const writingStyles = /** @type {[string, ...string[]]} */ (
  Object.values(deepl.WritingStyle)
);
export const writingTones = /** @type {[string, ...string[]]} */ (Object.values(deepl.WritingTone));
