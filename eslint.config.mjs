import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["node_modules/", "workshops/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.mjs", "eslint.config.mjs", ".releaserc.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  prettier,
];
