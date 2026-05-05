import tseslint from "typescript-eslint";

const tsFiles = ["main.ts", "src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"];

export default tseslint.config(
  {
    ignores: ["main.js", "node_modules/**", "dist/**", "build/**"]
  },
  {
    files: tsFiles,
    plugins: {
      "@typescript-eslint": tseslint.plugin
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports"
        }
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          ignoreVoid: true
        }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
);
