# update-cdn-urls

Confirm the integrity of CDN URLs based on installed npm packages and update
their integrity attribute (HTML) and paths (JS or HTML).

## Installation

```sh
npm i -D update-cdn-urls
```

## To-dos

1. Check if that version (1.4.0) is the latest in npm and asks to update npm
    if not. If npm is more up-to-date, ask to update the URL.
2. When the version for the CDN is decided, and the npm package is pointing to
    the same version, check the file's SHA integrity as loaded locally in npm
    (i.e., one has to trust one's npm registry at least) and update the
    `integrity` attribute. Maybe some config to ensure `crossorigin` is on the
    tag too.
3. Have a mode to optionally switch the URLs to local npm copies (or to
    auto-add `document.write` to the npm version as a fallback)
