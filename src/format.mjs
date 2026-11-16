// Number, time and name formatting for the status line.

export const fmtTokens = (n) => {
    if (n == null) return null;
    if (n >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
    return String(Math.round(n));
};

export const truncate = (s, max) => (max <= 1 ? '' : s.length <= max ? s : s.slice(0, max - 1) + '…');

export const baseName = (p) => (p ? String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() : '');

// Age of the prompt cache: minutes, then hours.
export const fmtAge = (ms) => {
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}m`;
};

// Time until a rate-limit window rolls over. resetsAt is unix epoch seconds.
export function fmtEta(resetsAt, now) {
    if (resetsAt == null) return null;
    const ms = Number(resetsAt) * 1000 - now;
    if (!Number.isFinite(ms)) return null;
    if (ms <= 0) return 'now';
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h${String(min % 60).padStart(2, '0')}m`;
    return `${Math.floor(h / 24)}d${h % 24}h`;
}
