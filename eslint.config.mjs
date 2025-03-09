import globals from "globals";
import pluginJs from "@eslint/js";
import pluginJest from "eslint-plugin-jest";


/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        files: ["**/*.js"],
        languageOptions: { sourceType: "commonjs" },
    },
    {
        languageOptions: { globals: globals.node },
    },
    {
    // update this to match your test files
        files: ["**/*.spec.js", "**/*.test.js"],
        plugins: { jest: pluginJest },
        languageOptions: {
            globals: pluginJest.environments.globals.globals,
        },
        rules: {
            "jest/no-disabled-tests": "warn",
            "jest/no-focused-tests": "error",
            "jest/no-identical-title": "error",
            "jest/prefer-to-have-length": "warn",
            "jest/valid-expect": "error",
        },
    },
    pluginJs.configs.recommended,
    {
        rules: {
            "quotes": ["error", "double"],
            "indent": ["error", 4, { "SwitchCase": 1 }],
            "no-tabs": "off"
        }
    }
];
