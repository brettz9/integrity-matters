# update-cdn-urls

Confirm the integrity of CDN URLs based on installed npm packages and update
their integrity attribute (HTML) and paths (JS or HTML).

## Installation

```sh
npm i -D update-cdn-urls
```

## To-dos

1. Have a mode to optionally switch the URLs to local npm copies (or to
    auto-add `document.write` to the npm version as a fallback)
2. See about getting HTML parser to preserve whitespace between attributes
    so that preserves preexisting whitespace when re-serialized?
    Seems cheerio is using
    [dom-serializer](https://github.com/cheeriojs/dom-serializer/blob/master/src/index.ts)
    (`render` -> `renderNode` -> `renderTag` -> `formatAttributes`); could pass
    metadata (in addition to `attribs`); but need to add metadata in
    [domhandler](https://github.com/fb55/domhandler/blob/master/src/index.ts#L147)
    perhaps long lines of workaround at
    <https://github.com/fb55/htmlparser2/issues/421>
3. Implement `JSONStrategy`
4. Tests/Coverage

## Potential to-dos

1. Deterministic logging order
1. Could make optional to only update URL if that version is lower
    than the `package.json` range
1. Could use `esquery` to find `import` statements (e.g., see usage in
    `es-file-traverse`) though wouldn't allow updating integrity--only
    the version (and only Deno currently supports full URLs).
