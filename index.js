const fs = require("fs").promises;
const path = require("path");
const postcss = require("postcss");

// Cache for parsed CSS files
const fileCache = new Map();

// Cache for resolved variable values
const variableCache = new Map();

/**
 * Loads and parses a CSS file, with caching
 * @param {string} filePath - Path to the CSS file
 * @returns {Promise<postcss.Root>} Parsed CSS AST
 */
const loadCssFile = async (filePath) => {

    if (fileCache.has(filePath)) {
        return fileCache.get(filePath);
    }

    const css = await fs.readFile(filePath, "utf8");
    const root = postcss.parse(css, { from: filePath });

    fileCache.set(filePath, root);

    return root;
};

/**
 * Extracts CSS variable declarations from a PostCSS Root
 * @param {postcss.Root} root - PostCSS Root node
 * @returns {Map<string, string>} Map of variable names to values
 */
const extractVariables = (root) => {
    const variables = new Map();

    root.walkDecls((decl) => {
        if (decl.prop.startsWith("--")) {
            variables.set(decl.prop, decl.value);
        }
    });

    return variables;
};

/**
 * Resolves a variable to its final value by following var() references
 * @param {string} varName - The variable name to resolve
 * @param {Map<string, string>} variableMap - Map of all available variables
 * @param {Set<string>} resolving - Set of variables being resolved (for circular reference detection)
 * @param {Result} result - PostCSS Result object for warnings
 * @returns {string|null} The resolved value or null if unresolvable
 */
const resolveVariable = (varName, variableMap, resolving = new Set(), result = null) => {
    // If this variable is already being resolved, we have a circular reference
    if (resolving.has(varName)) {
        if (result) {
            result.warn(`Circular reference detected for variable ${varName}`, {
                word: varName
            });
        }
        return null;
    }

    // If we don't have this variable, return null
    if (!variableMap.has(varName)) {
        return null;
    }

    const value = variableMap.get(varName);
    const cacheKey = varName + Array.from(variableMap.entries()).join(",");

    // Check cache
    if (variableCache.has(cacheKey)) {
        return variableCache.get(cacheKey);
    }

    // Add to resolving set
    resolving.add(varName);

    // Check if the value contains any var() functions
    const varRegex = /var\(([^,)]+)(?:,([^)]+))?\)/g;
    let match;
    let resolvedValue = value;

    // Create a copy of the value to work with
    let tempValue = value;

    // Check for var() references and resolve them
    while ((match = varRegex.exec(tempValue)) !== null) {
        const [fullMatch, referencedVarName, fallback] = match;
        const nestedResolvedValue = resolveVariable(
            referencedVarName.trim(),
            variableMap,
            new Set(resolving),
            result
        );

        if (nestedResolvedValue !== null) {
            // Replace the var() with the resolved value
            resolvedValue = resolvedValue.replace(fullMatch, nestedResolvedValue);
        } else if (fallback) {
            // Use the fallback if provided and the variable couldn't be resolved
            resolvedValue = resolvedValue.replace(fullMatch, fallback.trim());
        }
    }

    // Remove from resolving set
    resolving.delete(varName);

    // Cache and return the final resolved value
    variableCache.set(cacheKey, resolvedValue);
    return resolvedValue;
};

/**
 * PostCSS plugin to add fallbacks to CSS variables
 */
module.exports = (opts = {}) => {
    const { fallbacks = [] } = opts;

    return {
        postcssPlugin: "postcss-var-fallback",

        async Once(root, { result }) {
            if (!Array.isArray(fallbacks) || fallbacks.length === 0) {
                result.warn("Fallbacks must be an array of file paths");
                return;
            }
            
            // Clear caches for each run
            fileCache.clear();
            variableCache.clear();

            // Build variable map from fallback files
            const variableMap = new Map();

            // Process fallback files in order (last file has highest precedence)
            for (let i = 0; i < fallbacks.length; i++) {
                const fallbackPath = fallbacks[i];
                try {
                    const absolutePath = path.resolve(
                        root.source.input.file ? path.dirname(root.source.input.file) : ".",
                        fallbackPath
                    );

                    const fallbackRoot = await loadCssFile(absolutePath);

                    if (fallbackRoot) {
                        const fileVariables = extractVariables(fallbackRoot);
                        // Later files override earlier ones
                        fileVariables.forEach((value, key) => {
                            variableMap.set(key, value);
                        });
                    } else {
                        result.warn(`Could not load CSS file ${fallbackPath}`, {
                            word: fallbackPath,
                            node: root
                        });
                    }
                } catch (error) {
                    result.warn(`Error processing fallback file ${fallbackPath}: ${error.message}`, {
                        word: fallbackPath,
                        node: root
                    });
                }
            }

            // Find circular references
            const circularRefs = new Set();
            const detectCircular = (varName, path = new Set()) => {
                if (path.has(varName)) {
                    circularRefs.add(varName);
                    result.warn(`Circular reference detected for variable ${varName}`, {
                        word: varName
                    });
                    return true;
                }

                if (!variableMap.has(varName)) {
                    return false;
                }

                const value = variableMap.get(varName);
                const varRegex = /var\(([^,)]+)(?:,([^)]+))?\)/g;
                let match;
                let newPath = new Set(path);
                newPath.add(varName);

                while ((match = varRegex.exec(value)) !== null) {
                    const [, refVarName] = match;
                    const trimmedRefVarName = refVarName.trim();
                    if (detectCircular(trimmedRefVarName, newPath)) {
                        circularRefs.add(varName);
                        return true;
                    }
                }

                return false;
            };

            // Detect all circular references first
            for (const [varName] of variableMap.entries()) {
                detectCircular(varName);
            }

            // Process CSS variables
            root.walkDecls(decl => {
                const varRegex = /var\(([^,)]+)(?:,([^)]+))?\)/g;
                let value = decl.value;
                let match;
                let modified = false;
                let lastIndex = 0;
                let newValue = "";

                while ((match = varRegex.exec(value)) !== null) {
                    const [fullMatch, varName] = match;
                    const trimmedVarName = varName.trim();

                    // Add the text between the last match and this match
                    newValue += value.slice(lastIndex, match.index);

                    // Skip circular references
                    if (circularRefs.has(trimmedVarName)) {
                        newValue += fullMatch;
                    } else {
                        const resolvedValue = resolveVariable(trimmedVarName, variableMap, new Set(), result);

                        if (resolvedValue) {
                            // Add the var() with fallback, with comma to match CSS spec
                            newValue += `var(${trimmedVarName}, ${resolvedValue})`;
                            modified = true;
                        } else {
                            // Keep the original var() unchanged for unknown variables
                            newValue += fullMatch;
                        }
                    }

                    lastIndex = match.index + fullMatch.length;
                }

                // Add any remaining text after the last match
                if (lastIndex < value.length) {
                    newValue += value.slice(lastIndex);
                }

                if (modified) {
                    decl.value = newValue;
                }
            });
        }
    };
};

module.exports.postcss = true;
