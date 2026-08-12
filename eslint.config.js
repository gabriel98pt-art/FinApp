import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  // `coverage` é gerado pelo relatório de testes e traz JS de terceiros (o
  // visualizador HTML), que aparecia como avisos em todo o `npx eslint .`.
  { ignores: ["dist", "coverage"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Regra do spec: TypeScript forte, sem `any`.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  prettier,
);
