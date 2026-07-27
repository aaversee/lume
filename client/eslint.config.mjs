import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Rules the project already states in prose are worth more once a machine
 * checks them. Each entry below is an existing written rule moved from
 * "agreed" to "enforced".
 */
const lumeRules = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    /**
     * Design system: colour comes from CSS variables, never from a literal.
     * There are currently zero violations, so this is an error — it locks in an
     * invariant that already holds rather than declaring a cleanup debt.
     */
    "no-restricted-syntax": [
      "error",
      {
        selector:
          'JSXAttribute[name.name="className"] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
        message:
          "Hardcoded colour in className. Use a design-system variable, e.g. text-[var(--text-primary)].",
      },
      {
        selector:
          'JSXAttribute[name.name="className"] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
        message:
          "Hardcoded colour in className. Use a design-system variable, e.g. text-[var(--text-primary)].",
      },
      {
        selector:
          'JSXAttribute[name.name="className"] Literal[value=/\\brgba?\\(/]',
        message:
          "Hardcoded colour in className. Use a design-system variable instead of rgb()/rgba().",
      },
      {
        // `background` is in the list because leaving it out is exactly how a
        // literal slipped past this rule: the shorthand is the natural thing to
        // write, and the rule only knew the longhand.
        selector:
          'JSXAttribute[name.name="style"] Property[key.name=/^(color|background|backgroundColor|backgroundImage|borderColor|border|outlineColor|boxShadow|fill|stroke)$/] > Literal[value=/(^|\\s)(#[0-9a-fA-F]{3,8}\\b|rgba?\\()/]',
        message:
          "Hardcoded colour in a style prop. Use a design-system variable — or name the constant in globals.css if it is deliberately theme-independent.",
      },
    ],

    /**
     * tsconfig sets noUncheckedIndexedAccess; a non-null assertion silently
     * undoes it. Warn rather than error: 37 call sites predate this rule, and
     * making them red would either block CI or invite a blanket disable.
     * Clearing them is tracked work, not a drive-by.
     */
    "@typescript-eslint/no-non-null-assertion": "warn",
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  lumeRules,
  {
    // In tests, a missing value is itself the failure, so the assertion is fine.
    files: ["src/__tests__/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
