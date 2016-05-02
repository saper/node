/* eslint no-irregular-whitespace: 0 */
'use strict';
// Refs: https://github.com/nodejs/node/pull/5950

// This test illustrates the problem that symlinked modules are unable
// to find their peer dependencies. This was fixed in #5950 but that is
// reverted because that particular way of fixing it causes too much
// breakage (breakage that was not caught by either CI or CITGM on multiple
// runs.

// This test passes in v6 with https://github.com/nodejs/node/pull/5950 but
// fails with https://github.com/nodejs/node/pull/5950 reverted. This test
// will fail in Node.js v4 and v5.

const common = require('../common');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

common.refreshTmpDir();

const tmpDir = common.tmpDir;

// Creates the following structure
// {tmpDir}
// ├── app
// │   ├── index.js
// │   └── node_modules
// │       ├── moduleA -> {tmpDir}/moduleA
// │       └── moduleB
// │           ├── index.js
// │           └── package.json
// └── moduleA
//     ├── index.js
//     └── package.json

const moduleA = path.join(tmpDir, 'moduleA');
const app = path.join(tmpDir, 'app');
const moduleB = path.join(app, 'node_modules', 'moduleB');
const moduleA_link = path.join(app, 'node_modules', 'moduleA');
fs.mkdirSync(moduleA);
fs.mkdirSync(app);
fs.mkdirSync(path.join(app, 'node_modules'));
fs.mkdirSync(moduleB);

// Attempt to make the symlink. If this fails due to lack of sufficient
// permissions, the test will bail out and be skipped.
try {
  fs.symlinkSync(moduleA, moduleA_link);
} catch (err) {
  if (err.code !== 'EPERM') throw err;
  console.log('1..0 # Skipped: insufficient privileges for symlinks');
  return;
}

fs.writeFileSync(path.join(moduleA, 'package.json'),
                 JSON.stringify({name: 'moduleA', main: 'index.js'}), 'utf8');
fs.writeFileSync(path.join(moduleA, 'index.js'),
                 'module.exports = require(\'moduleB\');', 'utf8');
fs.writeFileSync(path.join(app, 'index.js'),
                 '\'use strict\'; require(\'moduleA\');', 'utf8');
fs.writeFileSync(path.join(moduleB, 'package.json'),
                 JSON.stringify({name: 'moduleB', main: 'index.js'}), 'utf8');
fs.writeFileSync(path.join(moduleB, 'index.js'),
                 'module.exports = 1;', 'utf8');

// TODO(@jasnell): Update this comment with this issue is fixed and
// this test is moved out of the known_issues directory.
//
// Ideally, this should not throw but it does because moduleA is not
// able to find it's peer dependency moduleB. The reason it cannot find
// it's peer is because moduleA is cached at it's realpath and when it's
// require goes to find moduleA, it can't (because moduleB does not exist
// within it's lookup path).
assert.doesNotThrow(() => {
  require(path.join(app, 'index'));
});
