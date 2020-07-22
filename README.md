# integrity-matters

Confirm the integrity of CDN URLs based on installed npm packages and update
their integrity attribute (HTML) and paths (JS or HTML).

## Installation

```sh
npm i -D integrity-matters
```

## To-dos

1. Tests/Coverage (with badges, CLI SVG docs, Travis, etc.)
2. Implement `JSONStrategy`
3. See about getting HTML parser to preserve whitespace between attributes
    so that preserves preexisting whitespace when re-serialized?
    Seems `cheerio` is using
    [dom-serializer](https://github.com/cheeriojs/dom-serializer/blob/master/src/index.ts)
    (`render` -> `renderNode` -> `renderTag` -> `formatAttributes`); could pass
    metadata (in addition to `attribs`); but need to add metadata in
    [domhandler](https://github.com/fb55/domhandler/blob/master/src/index.ts#L147)
    perhaps long lines of workaround at
    <https://github.com/fb55/htmlparser2/issues/421>

## Potential to-dos

1. Deterministic logging order
1. Add some auto-fallbacks, e.g., `window.jQuery` for well-known libraries?
1. Could make optional to only update URL if that version is lower
    than the `package.json` range
1. Could use `esquery` to find `import` statements (e.g., see usage in
    `es-file-traverse`) though wouldn't allow updating integrity--only
    the version (and only Deno currently supports full URLs).
