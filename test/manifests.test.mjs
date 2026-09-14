// The package and the plugin describe the same thing in three manifests; keep them in step.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SOURCE_ROOT } from '../src/install/installer.mjs';

const read = (rel) => JSON.parse(readFileSync(join(SOURCE_ROOT, rel), 'utf8'));
const pkg = read('package.json');
const plugin = read('.claude-plugin/plugin.json');
const marketplace = read('.claude-plugin/marketplace.json');

test('plugin.json agrees with package.json', () => {
    assert.equal(plugin.name, pkg.name);
    assert.equal(plugin.version, pkg.version);
    assert.equal(plugin.description, pkg.description);
    assert.equal(plugin.license, pkg.license);
    assert.equal(plugin.author.name, pkg.author);
    assert.equal(`git+${plugin.repository}.git`, pkg.repository.url);
});

test('the marketplace serves this repository as its only plugin', () => {
    assert.equal(marketplace.name, pkg.name);
    assert.equal(marketplace.owner.name, pkg.author);
    assert.equal(marketplace.metadata.description, pkg.description);
    assert.deepEqual(marketplace.plugins, [{ name: pkg.name, source: './' }]);
});
