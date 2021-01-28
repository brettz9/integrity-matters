# CHANGES for integrity-matters

## 0.13.1

- Fix: Do not allow downstream to use updated cheerio
- npm: Remove redundant Yarn override in CDN updating script

## 0.13.0

- Breaking change: Default of bootstrap now set to jsdelivr (boostrap CDN on
    stackpath [no longer being maintained](https://github.com/twbs/bootstrap/issues/32790#issuecomment-759942499)); `packagesToCdns` still supports mapping to
    `bootstrap` for the old CDN, though that may be removed in the future

## 0.12.0

- Update: Per new semver regex
- Linting: As per latest ash-nazg
- Docs: Example projects
- Docs: Update badges
- npm: Switch `prepare` to `prepublishOnly`
- npm: Use stable `mocha-multi-reporters`
- npm: Update array.prototype.flat, domhandler, globby, htmlparser2,
    node-fetch, prompts, semver, semver-regex; devDeps

## 0.11.2

- Fix: Avoid overwriting `local` for JSON (server may need more precise path
    for its own purposes)

## 0.11.1

- Fix: semver check to support prerelease formats

## 0.11.0

- Enhancement: Add `dropBase` option for dropping `<base href>` in dev. file
- Docs: Update docs on `cdnName` from CLI

## 0.10.0

- Breaking change: Require slim and min to paths (allowing dropping of min)
- Fix: For `fortawesome/fontawesome-free` CDN, ensure dropping `min`

## 0.9.0

- Breaking change: Let JSON format accept an array of links and scripts
- Testing: Add case where name is repeated (multiple fontawesome links under
    attribute-control test)

## 0.8.0

- Enhancement: Support `@fortawesome/fontawesome-free` CDN

## 0.7.3

- Docs: Update CLI docs to document `ext`

## 0.7.2

- Fix: Proper jquery CDN mapping
- Testing: Check default bootstrap and jquery for convertability from
    `node_modules`
- Testing: Avoid hard-coding bootstrap version in test file; adjust fixtures
- npm: Add script for reapplying yarn changes
- npm: Update devDeps

## 0.7.1

- Fix: Force `integrity` to be added when `data-im-algorithms` present even
    when no `integrity` in source.

## 0.7.0

- Enhancement (HTML and JSON): Use `data-im-*` attributes / JSON property for
    in-data config (`algorithms`)

## 0.6.0

- Enhancement (HTML): Use `data-im-*` attributes in HTML for in-data
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
