// Minimal server lint: a handful of core rules plus the recommended rules of typescript-eslint, every one a
// warning, so `pnpm lint` runs and shows what is there without blocking anything. Tighten later, rule by rule
// (docs/development/testing.md, "Lint").
const warn = (names) => Object.fromEntries(names.map((name) => [name, "warn"]));
const tsRecommended = require("@typescript-eslint/eslint-plugin").configs
  .recommended.rules;

module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  ignorePatterns: [
    "dist",
    "node_modules",
    "supabase",
    "tests",
    ".eslintrc.cjs",
  ],
  rules: {
    ...warn([
      "no-cond-assign",
      "no-constant-condition",
      "no-dupe-else-if",
      "no-duplicate-case",
      "no-empty",
      "no-fallthrough",
      "no-case-declarations",
      "no-prototype-builtins",
      "no-useless-escape",
      "no-self-assign",
      "no-unsafe-finally",
      "no-unreachable",
      "use-isnan",
      "valid-typeof",
    ]),
    // the recommended set with every "error" turned into a warning ("off" stays off)
    ...Object.fromEntries(
      Object.entries(tsRecommended).map(([name, level]) => [
        name,
        level === "off" || level === 0 ? "off" : "warn",
      ])
    ),
  },
};
