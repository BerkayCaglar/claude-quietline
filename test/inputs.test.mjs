import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { autoCompactWindow, configDir, parseJson, parseWindow } from '../src/inputs.mjs';

const BOM = String.fromCharCode(0xfeff);

function tempProject(t) {
    const root = mkdtempSync(join(tmpdir(), 'quietline-inputs-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const config = join(root, 'config');
    const project = join(root, 'project');
    mkdirSync(config, { recursive: true });
    mkdirSync(join(project, '.claude'), { recursive: true });
    return { config, project, env: { CLAUDE_CONFIG_DIR: config } };
}

test('parseWindow reads a bare 100-1000 as thousands and accepts k/M suffixes', () => {
    assert.equal(parseWindow(500), 500_000);
    assert.equal(parseWindow(50_000), 50_000);
    assert.equal(parseWindow('400k'), 400_000);
    assert.equal(parseWindow('1M'), 1_000_000);
    assert.equal(parseWindow(' 300 '), 300_000);
    assert.equal(parseWindow('auto'), null);
    assert.equal(parseWindow(null), null);
});

test('configDir honours CLAUDE_CONFIG_DIR', () => {
    assert.equal(configDir({ CLAUDE_CONFIG_DIR: '/custom/claude' }), '/custom/claude');
    assert.equal(configDir({}), join(homedir(), '.claude'));
});

test('parseJson tolerates a byte order mark', () => {
    assert.deepEqual(parseJson(`${BOM}{"a":1}`), { a: 1 });
});

test('autoCompactWindow precedence: env > project local > project > user settings', (t) => {
    const { config, project, env } = tempProject(t);
    assert.equal(autoCompactWindow(project, env), null);
    writeFileSync(join(config, 'settings.json'), `${BOM}{"autoCompactWindow":"800k"}`);
    assert.equal(autoCompactWindow(project, env), 800_000);
    writeFileSync(join(project, '.claude', 'settings.json'), '{"autoCompactWindow":900}');
    assert.equal(autoCompactWindow(project, env), 900_000);
    writeFileSync(join(project, '.claude', 'settings.local.json'), '{"autoCompactWindow":300}');
    assert.equal(autoCompactWindow(project, env), 300_000);
    assert.equal(autoCompactWindow(project, { ...env, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '500000' }), 500_000);
});

test('CLAUDE_CODE_AUTO_COMPACT_WINDOW takes a plain token count only', (t) => {
    const { project, env } = tempProject(t);
    assert.equal(autoCompactWindow(project, { ...env, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '500k' }), null);
    assert.equal(autoCompactWindow(project, { ...env, CLAUDE_CODE_AUTO_COMPACT_WINDOW: ' 250000 ' }), 250_000);
});
