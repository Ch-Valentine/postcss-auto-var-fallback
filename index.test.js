const postcss = require("postcss");
const fs = require("fs");
const path = require("path");
const varFallback = require("./index");

describe("postcss-var-fallback", () => {
    const tempDir = path.join(__dirname, "temp-test-files");

    // Helper to create test files
    const createTestFiles = (files) => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        Object.entries(files).forEach(([filename, content]) => {
            fs.writeFileSync(path.join(tempDir, filename), content);
        });
    };

    // Helper to process CSS with the plugin
    const process = async (cssFile, options) => {
        const css = fs.readFileSync(path.join(tempDir, cssFile), "utf8");
        const result = await postcss([varFallback(options)]).process(css, {
            from: path.join(tempDir, cssFile)
        });
        return result.css;
    };

    // Helper to process CSS string directly (for unit tests)
    const processString = async (cssString, options) => {
        const result = await postcss([varFallback(options)]).process(cssString, {
            from: undefined
        });
        return result.css;
    };

    // Clean up after each test
    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.readdirSync(tempDir).forEach(file => {
                fs.unlinkSync(path.join(tempDir, file));
            });
            fs.rmdirSync(tempDir);
        }
    });

    describe("Basic Functionality", () => {
        test("should add fallbacks to simple variables", async () => {
            createTestFiles({
                "base-vars.css": ":root { --font-family: \"Arial\"; }",
                "button.css": ".button { font-family: var(--font-family); }"
            });

            const result = await process("button.css", {
                fallbacks: ["base-vars.css"]
            });

            expect(result).toBe(".button { font-family: var(--font-family, \"Arial\"); }");
        });

        test("should handle nested variable references", async () => {
            createTestFiles({
                "base-vars.css": ":root { --size: 16px; --base-padding: var(--size); }",
                "theme.css": ":root { --padding: var(--base-padding); }",
                "button.css": ".button { padding: var(--padding); }"
            });

            const result = await process("button.css", {
                fallbacks: ["base-vars.css", "theme.css"]
            });

            expect(result).toBe(".button { padding: var(--padding, 16px); }");
        });

        test("should leave unknown variables unchanged", async () => {
            createTestFiles({
                "base-vars.css": ":root { --known: blue; }",
                "button.css": ".button { color: var(--unknown); background: var(--known); }"
            });

            const result = await process("button.css", {
                fallbacks: ["base-vars.css"]
            });

            expect(result).toBe(
                ".button { color: var(--unknown); background: var(--known, blue); }"
            );
        });
    });

    describe("Edge Cases", () => {
        test("should handle variables with existing fallbacks", async () => {
            createTestFiles({
                "base-vars.css": ":root { --color: blue; }",
                "button.css": ".button { color: var(--color, red); }"
            });

            const result = await process("button.css", {
                fallbacks: ["base-vars.css"]
            });

            expect(result).toBe(".button { color: var(--color, blue); }");
        });

        test("should handle complex values", async () => {
            createTestFiles({
                "base-vars.css": ":root { --transform: rotate(45deg) scale(1.5); }",
                "button.css": ".button { transform: var(--transform); }"
            });

            const result = await process("button.css", {
                fallbacks: ["base-vars.css"]
            });

            expect(result).toBe(
                ".button { transform: var(--transform, rotate(45deg) scale(1.5)); }"
            );
        });

        test("should handle variables in non-root blocks", async () => {
            createTestFiles({
                "theme.css": `
          .theme-dark {
            --bg-color: #222;
          }
          .theme-light {
            --bg-color: #fff;
          }
        `,
                "button.css": ".button { background: var(--bg-color); }"
            });

            const result = await process("button.css", {
                fallbacks: ["theme.css"]
            });

            expect(result).toBe(".button { background: var(--bg-color, #fff); }");
        });
    });

    describe("Multiple Files and Precedence", () => {
        test("should respect file order for variable precedence", async () => {
            createTestFiles({
                "base.css": ":root { --color: blue; }",
                "theme.css": ":root { --color: red; }",
                "button.css": ".button { color: var(--color); }"
            });

            const result = await process("button.css", {
                fallbacks: ["base.css", "theme.css"]
            });

            expect(result).toBe(".button { color: var(--color, red); }");
        });

        test("should handle multiple variable references in one declaration", async () => {
            createTestFiles({
                "spacing.css": ":root { --gap: 8px; --padding: 16px; }",
                "component.css": ".box { margin: var(--gap) var(--padding); }"
            });

            const result = await process("component.css", {
                fallbacks: ["spacing.css"]
            });

            expect(result).toBe(".box { margin: var(--gap, 8px) var(--padding, 16px); }");
        });
    });

    describe("Error Handling", () => {
        test("should handle missing fallback files gracefully", async () => {
            createTestFiles({
                "button.css": ".button { color: var(--color); }"
            });

            const result = await process("button.css", {
                fallbacks: ["non-existent.css"]
            });

            expect(result).toBe(".button { color: var(--color); }", "Missing files should not affect processing");
        });

        test("should handle malformed CSS in fallback files", async () => {
            createTestFiles({
                "broken.css": ":root { --color: red; /* missing closing brace */",
                "button.css": ".button { color: var(--color); }"
            });

            const result = await process("button.css", {
                fallbacks: ["broken.css"]
            });

            expect(result).toBe(".button { color: var(--color); }", "Malformed CSS should be skipped");
        });

        test("should handle invalid fallbacks option gracefully", async () => {
            createTestFiles({
                "component.css": ".button { color: var(--color); }"
            });

            // Test with non-array fallbacks
            const result1 = await process("component.css", {
                fallbacks: "not-an-array"
            });
            expect(result1).toBe(".button { color: var(--color); }", "Non-array fallbacks should be handled gracefully");

            // Test with null fallbacks
            const result2 = await process("component.css", {
                fallbacks: null
            });
            expect(result2).toBe(".button { color: var(--color); }", "Null fallbacks should be handled gracefully");
        });
    });

    describe("Advanced Variable Resolution", () => {
        test("should handle circular variable references", async () => {
            createTestFiles({
                "circular.css": ":root { --a: var(--b); --b: var(--a); }",
                "button.css": ".button { color: var(--a); }"
            });

            const result = await process("button.css", {
                fallbacks: ["circular.css"]
            });

            // Should not cause infinite loop and should leave variable unchanged
            expect(result).toBe(".button { color: var(--a); }", "Circular references should not cause infinite loops");
        });

        test("should handle deeply nested variables", async () => {
            createTestFiles({
                "deep.css": `
          :root {
            --level1: 10px;
            --level2: var(--level1);
            --level3: var(--level2);
            --level4: var(--level3);
            --level5: var(--level4);
          }
        `,
                "component.css": ".deep { margin: var(--level5); }"
            });

            const result = await process("component.css", {
                fallbacks: ["deep.css"]
            });

            expect(result).toBe(".deep { margin: var(--level5, 10px); }", "Should resolve deeply nested variables");
        });

        test("should handle variables with calc() expressions", async () => {
            createTestFiles({
                "calc.css": ":root { --base: 16px; --spacing: calc(var(--base) * 1.5); }",
                "component.css": ".calc { padding: var(--spacing); margin: var(--spacing); }"
            });

            const result = await process("component.css", {
                fallbacks: ["calc.css"]
            });

            expect(result).toBe(".calc { padding: var(--spacing, calc(16px * 1.5)); margin: var(--spacing, calc(16px * 1.5)); }", "Should handle calc() expressions");
        });

        test("should handle variables with complex CSS functions", async () => {
            createTestFiles({
                "complex.css": ":root { --color: rgba(255, 0, 0, 0.5); --shadow: 0 2px 4px var(--color); }",
                "component.css": ".complex { box-shadow: var(--shadow); }"
            });

            const result = await process("component.css", {
                fallbacks: ["complex.css"]
            });

            expect(result).toBe(".complex { box-shadow: var(--shadow, 0 2px 4px rgba(255, 0, 0, 0.5)); }",
                "Should handle complex CSS functions");
        });
    });

    describe("Performance", () => {
        test("should handle large CSS files efficiently", async () => {
            // Generate a large CSS file with many variables
            const generateLargeCSS = () => {
                let css = ":root {\n";
                for (let i = 0; i < 500; i++) {
                    css += `  --var${i}: value${i};\n`;
                }
                css += "}\n";
                return css;
            };

            // Generate a file that uses many variables
            const generateUsageCSS = () => {
                let css = ".large {\n";
                for (let i = 0; i < 500; i++) {
                    if (i % 100 === 0) css += "  property" + (i/100) + ": ";
                    css += `var(--var${i})` + (i % 100 === 99 ? ";\n" : " ");
                }
                css += "}\n";
                return css;
            };

            createTestFiles({
                "large-vars.css": generateLargeCSS(),
                "large-usage.css": generateUsageCSS()
            });

            // Measure execution time
            const startTime = Date.now();
            await process("large-usage.css", {
                fallbacks: ["large-vars.css"]
            });
            const elapsedMilliseconds = Date.now() - startTime;

            // Assert that execution time is reasonable (adjust threshold as needed)
            expect(elapsedMilliseconds).toBeLessThan(2000), "Should process large files in a reasonable time (< 2000ms)";
        });
    });

    describe("Unit Tests", () => {
        test("should handle empty CSS", async () => {
            const result = await processString("", { fallbacks: [] });
            expect(result).toBe("", "Empty CSS should remain empty");
        });

        test("should handle CSS with no variables", async () => {
            const css = ".no-vars { color: blue; }";
            const result = await processString(css, { fallbacks: [] });
            expect(result).toBe(css, "CSS with no variables should remain unchanged");
        });

        test("should handle CSS with comments", async () => {
            createTestFiles({
                "comments.css": ":root { /* Comment before */ --color: red; /* Comment after */ }",
                "usage.css": ".comment { color: var(--color); }"
            });

            const result = await process("usage.css", {
                fallbacks: ["comments.css"]
            });

            expect(result).toBe(".comment { color: var(--color, red); }", "Should handle variables with comments");
        });
    });
});
