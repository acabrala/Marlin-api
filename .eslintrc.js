module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  overrides: [
    {
      files: [".eslintrc.js"],
      parserOptions: {
        project: null, // Impede o parser de tentar analisar esse arquivo como TS
      },
    },
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    quotes: ["error", "double"],
    "import/no-unresolved": 0,
    "require-jsdoc": "off",
    "quote-props": "off",
    "object-curly-spacing": ["error", "always"],
    "max-len": ["error", { code: 100 }],
    indent: ["error", 2],
  },
};
