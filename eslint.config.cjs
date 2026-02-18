const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const i18Next = require("eslint-plugin-i18next");
const nextPlugin = require("@next/eslint-plugin-next");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [{
    ignores: [
        ".next/**",
        "**/node_modules/**",
        "eslint.config.cjs",
        "next-env.d.ts",
        "out/**",
        "dist/**",
        "build/**",
        "coverage/**",
        "public/sw.js",
        "public/workbox-*.js",
        "**/*.min.js",
        "playwright-report/**",
        "test-results/**"
    ],
}, ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "next/core-web-vitals",
    "plugin:i18next/recommended",
), {
    plugins: {
        "@next/next": nextPlugin,
        "@typescript-eslint": typescriptEslint,
        i18next: i18Next,
    },

    languageOptions: {
        globals: {
            ...globals.node,
        },

        parser: tsParser,
        ecmaVersion: 13,
        sourceType: "module",
    },
    settings: {
        next: {
            rootDir: ["."],
        },
    },
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
    }
}, {
    files: ["**/*.js"],

    rules: {
        "@typescript-eslint/no-require-imports": "off",
    },
}, {
    files: ["**/seed.ts"],

    rules: {
        "@typescript-eslint/no-require-imports": "off",
    },
}, {
    files: [
        "components/defaultLanding/**/*.tsx",
        "components/emailTemplates/**/*.tsx",
        "pages/index.tsx",
    ],

    rules: {
        "i18next/no-literal-string": "off",
    },
}];
