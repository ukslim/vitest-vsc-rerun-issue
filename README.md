## Vitest VS Code Plugin issue reproduction

This repository is an attempt at a Minimum Reproducible
Example of an issue we are seeing with Vitest in
VS Code and Cursor.

The issue is that re-running tests after a change, does not update the 
test result in the Test Explorer tree.

We witness this in our NX monorepo. What I have done is to anonymise that repository
by:

 - removing the code under test
 - replacing unit tests with `assert(true)`

 - anonymising filenames and test names throughout

We don't know the cause, but my vibe is that it's to do with monorepo layout, and sheer number of tests.

Steps to reproduce:

 - Clone this repo.
 - `pnpm install`

 - Open in Cursor
 - Ensure user setting `vitest.maximumConfigs` is large enough for the project 
 - Test Explorer -> `packages` -> click "Run Test" button
 - Edit a test (for example `packages/calculators/package-ec0znj/src/dir-1z6tn/dir-fq9qni/test-30r4r2s.test.ts` ) from `assert(true)` to `assert(false)`

 - Run this test, or a parent node, using any of the IDE "Run Test" buttons
 - Feedback suggests that the test has run, but the test does not turn red
   in any IDE views
 - Restart IDE or "Restart Extension Host"
 - Rerun tests, failing test may appear
 - Edit back to `assert(true)`

 - Run this test, or a parent node, using any of the IDE "Run Test" buttons
 - The test does not turn green

My environment:

The host:

  Cursor
  Version: 2.0.69
  VSCode Version: 1.99.3
  Commit: 63fcac100bd5d5749f2a98aa47d65f6eca61db30
  Date: 2025-11-07T18:21:29.650Z
  Electron: 37.7.0
  Chromium: 138.0.7204.251
  Node.js: 22.20.0
  V8: 13.8.258.32-electron.0
  OS: Darwin arm64 25.0.0

The plugin:

  Identifier: vitest.explorer
  Version: 1.32.1

Also reproduced in VS Code 1.105.1
