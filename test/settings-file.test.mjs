import assert from 'node:assert/strict';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SettingsFileError, updateSettings } from '../src/install/settings-file.mjs';

const BOM = String.fromCharCode(0xfeff);
const posixOnly = { skip: process.platform === 'win32' ? 'POSIX file modes and symlinks' : false };

function setup(t, content) {
    const dir = mkdtempSync(join(tmpdir(), 'quietline-settings-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const file = join(dir, 'settings.json');
    if (content != null) writeFileSync(file, content);
    return { dir, file, backupDir: join(dir, 'backups') };
}

const set = (key, value) => (s) => ({ ...s, [key]: value });

test('creates settings.json with a two-space indent when it is missing', async (t) => {
    const { file, backupDir } = setup(t);
    const result = await updateSettings(file, set('statusLine', { type: 'command' }), { backupDir });
    assert.equal(result.changed, true);
    assert.equal(result.backupPath, null);
    assert.equal(readFileSync(file, 'utf8'), '{\n  "statusLine": {\n    "type": "command"\n  }\n}\n');
});

test('keeps the BOM, CRLF, indent, key order and a missing final newline', async (t) => {
    const before = `${BOM}{\r\n    "model": "opus",\r\n    "statusLine": {\r\n        "command": "old"\r\n    },\r\n    "theme": "dark"\r\n}`;
    const { file, backupDir } = setup(t, before);
    await updateSettings(file, set('statusLine', { command: 'new' }), { backupDir });
    assert.equal(readFileSync(file, 'utf8'), before.replace('"old"', '"new"'));
});

test('refuses to touch a file it cannot parse', async (t) => {
    const broken = '{ "model": "opus", }';
    const { file, backupDir } = setup(t, broken);
    await assert.rejects(updateSettings(file, set('a', 1), { backupDir }), SettingsFileError);
    assert.equal(readFileSync(file, 'utf8'), broken);
    assert.equal(existsSync(backupDir), false);
});

test('refuses a file that does not hold a JSON object', async (t) => {
    const { file, backupDir } = setup(t, '[]');
    await assert.rejects(updateSettings(file, set('a', 1), { backupDir }), SettingsFileError);
    assert.equal(readFileSync(file, 'utf8'), '[]');
});

test('writes nothing when nothing changes', async (t) => {
    const { file, backupDir } = setup(t, '{"a": 1}');
    const result = await updateSettings(file, (s) => ({ ...s }), { backupDir });
    assert.equal(result.changed, false);
    assert.equal(readFileSync(file, 'utf8'), '{"a": 1}');
    assert.equal(existsSync(backupDir), false);
});

test('a dry run reports the change and writes nothing', async (t) => {
    const { file, backupDir } = setup(t, '{"a": 1}');
    const result = await updateSettings(file, set('b', 2), { backupDir, dryRun: true });
    assert.deepEqual(result.after, { a: 1, b: 2 });
    assert.equal(readFileSync(file, 'utf8'), '{"a": 1}');
    assert.equal(existsSync(backupDir), false);
});

test('starts over from the new version when the file changes underneath', async (t) => {
    const { file, backupDir } = setup(t, '{\n  "model": "opus"\n}\n');
    let calls = 0;
    await updateSettings(
        file,
        (s) => {
            calls++;
            // Another Claude Code session writes while the first merge is in flight.
            if (calls === 1) writeFileSync(file, '{\n  "model": "sonnet"\n}\n');
            return { ...s, statusLine: 'ours' };
        },
        { backupDir },
    );
    assert.equal(calls, 2);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { model: 'sonnet', statusLine: 'ours' });
});

test('keeps the five newest backups', async (t) => {
    const { file, backupDir } = setup(t, '{}');
    for (let i = 0; i < 7; i++) await updateSettings(file, set('n', i), { backupDir, stamp: `2026-09-14T00-00-0${i}` });
    const kept = readdirSync(backupDir).sort();
    assert.deepEqual(kept, [2, 3, 4, 5, 6].map((i) => `settings-2026-09-14T00-00-0${i}.json`));
    assert.equal(readFileSync(join(backupDir, kept[0]), 'utf8'), JSON.stringify({ n: 1 }));
});

test('keeps a 0600 file mode', posixOnly, async (t) => {
    const { file, backupDir } = setup(t, '{}');
    chmodSync(file, 0o600);
    await updateSettings(file, set('a', 1), { backupDir });
    assert.equal(statSync(file).mode & 0o777, 0o600);
});

test('writes a symlinked settings.json through to its target', posixOnly, async (t) => {
    const { dir, file, backupDir } = setup(t);
    const real = join(dir, 'dotfiles', 'settings.json');
    mkdirSync(join(dir, 'dotfiles'));
    writeFileSync(real, '{}');
    symlinkSync(real, file);
    await updateSettings(file, set('a', 1), { backupDir });
    assert.ok(lstatSync(file).isSymbolicLink());
    assert.deepEqual(JSON.parse(readFileSync(real, 'utf8')), { a: 1 });
});
