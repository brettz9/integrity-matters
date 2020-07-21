# update-cdn-urls

Confirm the integrity of CDN URLs based on installed npm packages and update
their integrity attribute (HTML) and paths (JS or HTML).

## Installation

```sh
npm i -D update-cdn-urls
```

## To-dos

1. Add config to ensure `crossorigin` is on the tag too.
2. Have a mode to optionally switch the URLs to local npm copies (or to
    auto-add `document.write` to the npm version as a fallback)
3. Optionally perform HEAD request to confirm URL exists

## Potential to-dos

1. Deterministic logging order
1. Could make optional to only update URL if that version is lower
    than the `package.json` range
1. Allow updating based on lock file only (even if not locally installed)?
1. Could use `esquery` to find `import` statements (e.g., see usage in
    `es-file-traverse`) though wouldn't allow updating integrity--only
    the version (and only Deno currently supports full URLs).
