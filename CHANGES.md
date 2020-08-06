# CHANGES for integrity-matters

## 0.7.0

- Enhancement (HTML and JSON): Use `data-*` attributes / JSON property for
    in-data config (`algorithms`)

## 0.6.0

- Enhancement (HTML): Use `data-*` attributes in HTML for in-data
    config (`cdn`, `global`, and auto-set `fallback` if `global` present)
- Enhancement (JSON): Support `cdn` inline override

## 0.5.0

- Breaking change: Expect `dist` normally in replacement paths
    (unless omitted from result)
- Enhancement: `cdnName` and `packagesToCdns` options
- Enhancement: `DomHandler` or `htmlparser2` options
- Enhancement: `jsonSpace` option
- Enhancement: Add `dropModules` option
- Enhancement: Add `disclaimer` option
- Refactoring: Have Strategy's `save` accept an object

## 0.4.3

- Fix: Ensure `rel="stylesheet"` added to fallback links

## 0.4.2

- Fix: Preserve relative path characters at beginning of `node_modules`
    paths (for output)

## 0.4.1

- Fix: Have regexes handle scoped packages

## 0.4.0

- Change (JSON): Add newline to JSON
- Change: Drop dep. vs. devDep. checking (not a critical issue for our
    scope of concern)
- Fix: Throw if `package.json` cannot be reached
- Fix: Properly handle missing `integrity`
- Fix: Avoid stray apostrophe in log/error
- Fix (JSON): Handle JSON missing `script` or `link`
- Fix (JSON): Avoid setting crossorigin to `false`
- Fix (JSON): Reorder to set `crossorigin` with its integrity check before
    changing integrity
- Enhancement: Add `urlIntegrityCheck`
- Testing: Improve coverage
- Testing: Ensure deleting output path before each run

## 0.3.3

- Fix: `node_modules` -> CDN paths
- Fix: Check yarn lock dependency info properly
- Fix: Give warning if `yarn.lock` and `package-lock.json` both installed;
    don't give extra info on yarn if package-lock found and no `yarn.lock`
    found (as is expected)
- Fix: Avoid removing `integrity` before `elem.is([integrity])` check
    (may need to alter `crossorigin`)
- Refactoring: Add period in error message for consistency
- Testing: Fix expected (ternary precedence issue)
- Testing: Improve coverage

## 0.3.2

- Fix: Avoid bad replacement if `forceIntegrityChecks` forces integrity
    change with no version change found
- Fix: Properly handle case where targeted package missing in
    `package.json` dependencies
- Fix: Throw instead of warning when package not present in `node_modules`
    (with `package.json`)
- Testing: Improve coverage

## 0.3.1

- Fix: Ensure `false` `crossorigin` removes the attribute
- Testing: Improve coverage

## 0.3.0

- Fix: Add `flat` polyfill
- Fix: Throw if local `node_modules` path not found for matching CDN
- Fix: Throw for bad CDN status code
- Fix: Do proper filtering of hashes when any are removed
- Enhancement: Have `cdnBasePathReplacements` and `nodeModulesReplacements`
    default to first item in array if not present
- Enhancement: Throw instead of silently ignoring some bad integrity matches
- Testing: Improve coverage
- Testing: Delete outputPath before and after tests
- CI: Ensure folder exists

## 0.2.1

- Fix: Add `flat` polyfill
- CI: Ensure folder exists

## 0.2.0

- Fix: Avoid using globs when `outputPath` is set and need for `noGlobs`
    when using `outputPath`; print proper path
- Enhancement: Log file path when finished writing file
- Enhancement: Deterministic logging order

## 0.1.0

- Initial version
