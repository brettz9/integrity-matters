[![npm](https://img.shields.io/npm/v/integrity-matters.svg)](https://www.npmjs.com/package/integrity-matters)
[![Dependencies](https://img.shields.io/david/brettz9/integrity-matters.svg)](https://david-dm.org/brettz9/integrity-matters)
[![devDependencies](https://img.shields.io/david/dev/brettz9/integrity-matters.svg)](https://david-dm.org/brettz9/integrity-matters?type=dev)

[![eslint badge](https://raw.githubusercontent.com/brettz9/integrity-matters/master/badges/eslint-badge.svg?sanitize=true)](badges/eslint-badge.svg)

[![Build Status](https://travis-ci.org/brettz9/integrity-matters.svg?branch=master)](https://travis-ci.com/github/brettz9/integrity-matters)
[![testing badge](https://raw.githubusercontent.com/brettz9/integrity-matters/master/badges/tests-badge.svg?sanitize=true)](badges/tests-badge.svg)
[![coverage badge](https://raw.githubusercontent.com/brettz9/integrity-matters/master/badges/coverage-badge.svg?sanitize=true)](badges/coverage-badge.svg)

[![Known Vulnerabilities](https://snyk.io/test/github/brettz9/integrity-matters/badge.svg)](https://snyk.io/test/github/brettz9/integrity-matters)
[![Total Alerts](https://img.shields.io/lgtm/alerts/g/brettz9/integrity-matters.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/brettz9/integrity-matters/alerts)
[![Code Quality: Javascript](https://img.shields.io/lgtm/grade/javascript/g/brettz9/integrity-matters.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/brettz9/integrity-matters/context:javascript)

<!--[![License](https://img.shields.io/npm/l/integrity-matters.svg)](LICENSE-MIT.txt)-->
[![Licenses badge](https://raw.githubusercontent.com/brettz9/integrity-matters/master/badges/licenses-badge.svg?sanitize=true)](badges/licenses-badge.svg)

(see also [licenses for dev. deps.](https://raw.githubusercontent.com/brettz9/integrity-matters/master/badges/licenses-badge-dev.svg?sanitize=true))

[![issuehunt-to-marktext](https://issuehunt.io/static/embed/issuehunt-button-v1.svg)](https://issuehunt.io/r/brettz9/integrity-matters)

# integrity-matters

Integrity matters! See [Motivation](#motivation).

## Features

1. **Confirm and update `integrity` and path info** - Confirm the integrity of
    CDN URLs based on currently installed npm packages and modify their
    integrity attribute (HTML) and paths (JS or HTML) to reflect the current
    local version and its contents.
1. **Auto-check CDN URLs** - Confirms that the converted CDN URLs can be
    visited successfully.
1. **File output options**:
    1. Overwriting an existing file - useful for Github Pages demos which you
        want to use with CDNs without an extra build step.
    1. Convert to a local path - useful if you want a local-only build,
        but are storing your source with CDN URLs.
    1. Creating a new file - provides the ability to still have scripts and
        links output with integrity attributes and versioned CDN URLs, but
        while only needing to save scripts/links to local paths in source,
        thereby avoiding version numbers or integrity attributes which are
        likely to produce larger diff noise upon updates.
1. **CDN fallbacks** - Option to detect if globals have loaded by the CDN and
    fallback to a local script if not.
1. **Inject `crossorigin`** - Option to inject `crossorigin` attributes.

## Motivation

Integrity matters, particularly when it comes to third-party sites. A
malicious or compromised CDN could serve files to your users that are
different than those of the package you are expecting.

Even if the CDN is run by the same author as that of a package you have
audited locally, you may wish to verify the CDN is indeed hosting the same
contents as the local files you may have checked (or is at least the same
as that hosted on npm).

[Subresource integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity),
via the HTML `integrity` attribute, allows browsers to confirm that the
external script or stylesheet you are referencing holds a match for the same
contents as are expected.

## Installation

```sh
npm i -D integrity-matters
```

## CLI Usage

![badges/cli.svg](./badges/cli.svg)

## Example projects

- [qiblih-website](https://github.com/bahaidev/qiblih-website) - This project
    uses `integrity-matters` with
    [HTML in source](https://github.com/bahaidev/qiblih-website/blob/master/src/index.html),
    where
    [this npm CLI script](https://github.com/bahaidev/qiblih-website/blob/dce2886e86d82750b3b85db75afa14ffae1ffb24/package.json#L12)
    is used to convert its functional local `node_modules` URLs into
    public production CDN URLs in
    [a separate HTML file](https://github.com/bahaidev/qiblih-website/blob/master/public/index.html). While we could have source the same as output,
    with CDN URLs being replaced with more updated CDN URLs, the approach
    of using `node_modules` URLs not only allows local testing but potentially
    avoids extra diff noise if the output HTML is not committed to the
    repository (though it would be built before deploying).
- [nogin](https://github.com/brettz9/nogin) - This project uses
    `integrity-matters` where the [JSON input file](https://github.com/brettz9/nogin/blob/master/app/server/integrityMap.json)
    is the same as the output file (i.e., when [this npm CLI script](https://github.com/brettz9/nogin/blob/55498837a95b93c8e75a2ea14cbfda8ae18bbd82/package.json#L42)
    is run, it will overwrite the JSON input file based on any new dependency versions and their updated `integrity` info). (The [server-side code](https://github.com/brettz9/nogin/blob/master/app/server/routeUtils.js)
    reads this file at run-time in order to generates the HTML dynamically,
    e.g., based on whether the user wishes to use local or CDN URLs.)

## Forcing new or changed hashing algorithms

If you simply change the `integrity` attribute (or, for JSON, the JSON
property) to have space-separated, algorithms followed by a dash, these
will be replaced on the next run, e.g., `integrity="sha256- sha512-"` will
cause `sha256` and `sha512` hashes to be generated on the next run.

You can also force all `integrity` attributes to possess certain hashes at a
minimum using one or more `--algorithm` flags.

## Notes on strategies

There are currently two strategies which determine how to process certain file
types passed via the `file` option. If a `.json` extension is found, the JSON
strategy will be used in place of the HTML strategy.

### JSON strategy

JSON can be useful for Server-Side Rendering (SSR) in that you can read the
JSON file at runtime and insert its contents into a rendered template
programmatically rather than using static HTML. `integrity-matters` allows you
to auto-update such files as well (also based on checksums (hashes) of your
local npm package files).

The JSON strategy file format expects the following (some of these can be
auto-generated or updated in the output instead of being present in source):

```json
{
  "link": [
    {
      "name": "bootstrap",
      "crossorigin": "anonymous",
      "local": "/node_modules/bootstrap/dist/css/bootstrap.min.css",
      "integrity": "sha384-JcKb8q3iqJ61gNV9KGb8thSsNjpSL0n8PARn9HuZOnIxN0hoP+VmmDGMN5t9UJ0Z",
      "remote": "https://cdn.jsdelivr.net/npm/bootstrap@4.5.2/dist/css/bootstrap.min.css"
    }
  ],
  "script": [
    {
      "name": "jquery",
      "global": "jQuery",
      "fallback": true,
      "local": "/node_modules/jquery/dist/jquery.min.js",
      "integrity": "sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=",
      "remote": "https://code.jquery.com/jquery-3.5.1.min.js"
    }
  ]
}
```

Note that in JSON, `remote` (equivalent to `script src` or `link href`) and
`local` are stored separately. `integrity` can be auto-updated, but to do so,
you should at least have empty algorithms or use `--algorithm` (see
"Forcing new or changed hashing algorithms").

In the JSON strategy, the following additional properties can be added, some
of which do not have exact equivalents in the HTML (See "HTML Strategy").

- `name` - The npm package name
- `fallback` - Ensures server-side renderers can dynamically determine
    whether to add fallback code. Can be forced by `--fallback` CLI.
- `global` - Ensures server-side renderers can dynamically add a global check
    to determine whether to fallback.
- `local` - Ensures server-side renderers can dynamically point to a local
    file for fallback.
- `noLocalIntegrity` - Ensures server-side renderers can dyanmically avoid
    adding `integrity` for indicated files when they are served locally. This
    is a recommended property and is not set by `integrity-matters`. (The CLI
    command of the same name is to get the HTML strategy to avoid inserting
    the attribute.)
- `crossorigin` - This property allows SSR to dynamically add a particular
    `crossorigin`. Overwritten if `addCrossorigin` is used.

### HTML strategy

In HTML, we currently only allow fallbacks to be added in a new auto-generated
file; you should not attempt to set `--fallback` with HTML files if your
source already has fallback code, as we do not auto-detect whether you already
have such fallback code in place. You can, however, use `fallback` with
`--outputPath` and `--globalCheck` and allow the output file to be written
anew each time, adding the fallback code during this process. In place of
`globalCheck`, you can also add a `data-im-global` attribute within your
HTML source file, e.g., `data-im-global="window.jQuery"`. If this attribute is
present, `fallback` will automatically be set to `true` for this element.

In the HTML strategy, the local fallback file path is either the `src`/`href`
used in source or it is derived from the CDN by `--nodeModulesReplacements`.

Another `data-im-*` attribute that can override behavior is `data-im-cdn`
which points to a `cdnName` and can be used in place of `packagesToCdns` to
specify a specific CDN to use for a specific package.

Still another is `data-im-algorithms`, e.g.,
`data-im-algorithms="sha512 sha384"`, which can be used to indicate the
algorithms to generate (useful if you don't want to maintain working
`integrity` in source, e.g., for `node_modules` paths).

A preexisting HTML `crossorigin` attribute will be respected but can be
overridden for all cases using `--addCrossorigin`.

## Tips

You may wish to use a hook, or probably more easily, use
[@hkdobrev/run-if-changed](https://github.com/hkdobrev/run-if-changed) to
indicate that `integrity-matters` should be run whenever `package.json`
(or `package-lock.json`/`yarn.lock`) changes, ensuring that your local
updates are automatically reflected in your CDN URL versions. (You may
wish to have it run a local install first as well to ensure that updates
made by others contributing to your project are reflected locally.)

If you ever open your `node_modules` files within your IDE, and if your IDE
has features like auto-stripping trailing spaces or adding an end-of-file
newline and you save the file even with these minor changes, this will break
your `integrity` against the original. If you accidentally do this, you can
remove the package and re-run `npm install`.

## Developing

Be sure to use `npm` to install rather than `yarn` as our local copy
(which only impacts dev. installations) is deliberately missing an item
(`chai`) and using a version older than that in `package.json` (`mocha@7`)
for testing purposes.

Upon updating `package.json`, and after committing the changes
(without any staged or working copy changes to `package.json`), run
`npm run update-yarn-for-tests` so that most of the updates can be reflected
in the `yarn.lock` file, while reapplying the chai and mocha changes. You can
then commit the resulting `yarn.lock` changes.

You will also need to update the `integrity` and version values within the
test fixture files. (A find-in-files replacement will probably be most
helpful as we do not currently have a script in place to auto-update our own
fixtures.)

## Medium priority to-dos

1. Fix: Allow local file fetches when not `local` but expressed as
    `node_modules` (or auto-act like `--ignoreURLFetches`)
1. Enhancement: Force addition of `integrity` even when attribute not present
1. Fix: See about getting HTML parser to preserve whitespace between attributes
    so that preserves preexisting whitespace when re-serialized?
    Seems `cheerio` is using
    [dom-serializer](https://github.com/cheeriojs/dom-serializer/blob/master/src/index.ts)
    (`render` -> `renderNode` -> `renderTag` -> `formatAttributes`); could pass
    metadata (in addition to `attribs`); but need to add metadata in
    [domhandler](https://github.com/fb55/domhandler/blob/master/src/index.ts#L147)
    perhaps long lines of workaround at
    <https://github.com/fb55/htmlparser2/issues/421>

## Potential to-dos

1. Fix: Avoid reinserting fallbacks (and beginning disclaimer comments) if
    detected in some way as next item
1. Enhancement: Add some auto-fallbacks, e.g., `window.jQuery` for
    well-known libraries?
1. Enhancement: Could make optional to only update URL if that version
    is lower than the `package.json` range
1. Enhancement: Could use `esquery` to find `import` statements (e.g.,
    see usage in `es-file-traverse`) though wouldn't allow updating
    integrity--only the version (and only Deno currently supports full
    URLs).
