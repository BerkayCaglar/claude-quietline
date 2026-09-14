// Argument parsing and output for bin/cli.mjs. Output is plain text with [ok]/[warn]/[fail]
// markers, readable by a person and by an agent following INSTALL.md.

import { SettingsFileError } from './settings-file.mjs';
import { InstallError, doctor, install, packageVersion, uninstall } from './installer.mjs';

const HELP = `claude-quietline — a fast status line for Claude Code that stays quiet until something matters

Usage:
  claude-quietline install [--dry-run] [--dev]
      Copy the status line into Claude Code's config folder and point settings.json at it.
      --dry-run  show what would change, write nothing
      --dev      point settings.json at this git checkout instead of copying it
  claude-quietline uninstall [--dry-run]
      Put back the status line you had before, and remove the installed copy.
  claude-quietline doctor
      Check the installation and time one render.
  claude-quietline --version

Honours CLAUDE_CONFIG_DIR. Needs Node.js 22 or later.`;

const FLAGS = { install: ['--dry-run', '--dev'], uninstall: ['--dry-run'], doctor: [] };

function printInstall(r) {
    if (r.dryRun) {
        console.log('Dry run: nothing was written.');
        if (r.mode === 'copy') console.log(`  ${r.files.length} files would be copied to ${r.root}`);
        else console.log(`  settings.json would point at the checkout ${r.root}`);
        for (const c of r.changes) console.log(`  ${c.key}:\n    from ${c.from}\n    to   ${c.to}`);
        return 0;
    }
    if (r.mode === 'copy') {
        console.log(`[ok] claude-quietline ${r.version} is in ${r.installDir} (${r.copied.written} of ${r.copied.total} files updated${r.copied.removed ? `, ${r.copied.removed} stale removed` : ''})`);
    } else {
        console.log(`[warn] dev mode: every session now runs the checkout at ${r.root}`);
    }
    const v = r.verification;
    console.log(`[ok] renders through ${v.shell} with Node.js ${v.node}: status line ${Math.round(v.mainMs)} ms, agent rows ${Math.round(v.agentsMs)} ms`);
    console.log(r.settingsChanged ? `[ok] settings.json updated (backup: ${r.backupPath ?? 'none, the file was new'})` : '[ok] settings.json already pointed here; nothing to change');
    console.log('Running Claude Code sessions pick the change up on their next status line refresh.');
    return 0;
}

function printUninstall(r) {
    if (!r.installed) {
        console.log(`[ok] claude-quietline is not installed in ${r.installDir}; nothing to do.`);
        return 0;
    }
    if (r.dryRun) console.log('Dry run: nothing was written.');
    for (const [key, what] of Object.entries(r.outcome)) console.log(`[ok] ${key}: ${what}`);
    for (const warning of r.warnings) console.log(`[warn] ${warning}`);
    if (!r.dryRun) console.log(`[ok] removed ${r.installDir} (settings backups kept in ${r.backups})`);
    return 0;
}

function printDoctor(checks) {
    for (const c of checks) console.log(`[${c.status}] ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
    return checks.some((c) => c.status === 'fail') ? 1 : 0;
}

export async function runCli(argv) {
    const [command, ...rest] = argv;
    if (command === '--version' || command === '-v') {
        console.log(packageVersion());
        return 0;
    }
    if (!FLAGS[command] || rest.some((flag) => !FLAGS[command].includes(flag))) {
        console.log(HELP);
        return command === undefined || command === 'help' || command === '--help' || command === '-h' ? 0 : 1;
    }
    try {
        if (command === 'install') return printInstall(await install({ dev: rest.includes('--dev'), dryRun: rest.includes('--dry-run') }));
        if (command === 'uninstall') return printUninstall(await uninstall({ dryRun: rest.includes('--dry-run') }));
        return printDoctor(doctor());
    } catch (err) {
        if (err instanceof InstallError || err instanceof SettingsFileError) {
            console.error(`[fail] ${err.message}`);
            return 1;
        }
        throw err;
    }
}
