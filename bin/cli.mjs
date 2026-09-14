#!/usr/bin/env node
// claude-quietline installer: install | uninstall | doctor. The Node.js version check runs
// before anything else is loaded, so an old Node gets a clear message instead of a stack trace.

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
    console.error(`[fail] claude-quietline needs Node.js 22 or later; this is ${process.version}. Install a current LTS from https://nodejs.org and run the command again.`);
    process.exit(1);
}

import('../src/install/cli.mjs')
    .then(({ runCli }) => runCli(process.argv.slice(2)))
    .then((code) => {
        process.exitCode = code;
    });
