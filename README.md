# PostCSS Auto Var Fallback

[![npm](https://img.shields.io/npm/v/postcss-auto-var-fallback)](https://www.npmjs.com/package/postcss-auto-var-fallback)
[![npm](https://img.shields.io/npm/dw/postcss-auto-var-fallback)](https://www.npmjs.com/package/postcss-auto-var-fallback)
[![license](https://img.shields.io/npm/l/postcss-auto-var-fallback)](https://github.com/Ch-Valentine/postcss-auto-var-fallback/blob/develop/LICENSE)

A [PostCSS](https://github.com/postcss/postcss) plugin that automatically adds fallback values to CSS variables based on their definitions in other CSS files.

## Why CSS Variable Fallbacks Matter

CSS Custom Properties (variables) are powerful, but they have a key limitation: when a variable is undefined, the property using it becomes invalid. This can lead to unexpected styling issues, especially in:

- **Theming systems** where variables might be defined in different files
- **Component libraries** where you want to provide default values
- **Multi-tenant applications** with customizable styling
- **Progressive enhancement** scenarios where you need fallbacks

This plugin solves these problems by automatically adding fallbacks to your CSS variables based on their definitions in other files, ensuring your styles degrade gracefully.

## Features

- 🔄 Automatically adds fallbacks to CSS variables
- 📁 Uses variable definitions from multiple CSS files
- 🔄 Resolves nested variable references
- ⚠️ Handles circular references gracefully
- 🚀 Optimized with caching for performance
- 🧪 Thoroughly tested with a comprehensive test suite

## Installation

```bash
npm install postcss-auto-var-fallback --save-dev
```

or

```bash
pnpm add postcss-auto-var-fallback -D
```

## Usage

### Basic Usage

```js
// postcss.config.js
module.exports = {
    plugins: [
        require('postcss-auto-var-fallback')({
            fallbacks: [
                './src/styles/variables.css',
                './src/styles/theme.css',
                require.resolve("@yourcompany-designsystem/theme.css")
            ]
        })
    ]
}
```

### With Webpack

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  require('postcss-auto-var-fallback')({
                    fallbacks: ['./src/styles/variables.css']
                  })
                ]
              }
            }
          }
        ]
      }
    ]
  }
}
```

## How It Works

Given the following CSS files:

**variables.css**:
```css
:root {
  --primary-color: #3498db;
  --secondary-color: #2ecc71;
  --font-size: 16px;
  --spacing: var(--font-size);
}
```

**component.css**:
```css
.button {
  background-color: var(--primary-color);
  color: var(--text-color);
  padding: var(--spacing);
}
```

After processing with this plugin:

```css
.button {
  background-color: var(--primary-color, #3498db);
  color: var(--text-color); /* Unchanged because --text-color is not defined */
  padding: var(--spacing, 16px); /* Resolves nested variables */
}
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `fallbacks` | `Array<string>` | Paths to CSS files containing variable definitions. Later files override earlier ones. | `[]` |

## Advanced Examples

### Handling Nested Variables

The plugin can resolve deeply nested variable references:

**variables.css**:
```css
:root {
  --base-size: 4px;
  --spacing-unit: var(--base-size);
  --spacing-small: calc(var(--spacing-unit) * 2);
  --spacing-medium: calc(var(--spacing-unit) * 4);
}
```

**component.css**:
```css
.card {
  padding: var(--spacing-medium);
}
```

After processing:

```css
.card {
  padding: var(--spacing-medium, calc(4px * 4));
}
```

### Theme Overrides

The plugin respects the order of fallback files, with later files taking precedence:

**base-theme.css**:
```css
:root {
  --primary-color: blue;
}
```

**custom-theme.css**:
```css
:root {
  --primary-color: purple;
}
```

When configured with `fallbacks: ['base-theme.css', 'custom-theme.css']`, the plugin will use `purple` as the fallback value.

## Best Practices

1. **Order your fallback files by priority** - The last file in the array has the highest precedence.
2. **Use relative paths** - Paths are resolved relative to the CSS file being processed.
3. **Avoid circular references** - The plugin detects and skips circular variable references.
4. **Consider file size** - For large projects, be selective about which variables need fallbacks.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [PostCSS](https://github.com/postcss/postcss) - The amazing tool that makes this plugin possible
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties) - MDN documentation on CSS variables
