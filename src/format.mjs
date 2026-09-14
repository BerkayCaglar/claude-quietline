// Number, time and name formatting shared by both status lines.

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

// Time since a subagent started; accepts epoch seconds, epoch milliseconds or a date string.
export function elapsed(startTime, now) {
    if (startTime == null) return '';
    const start = typeof startTime === 'number' ? (startTime < 1e12 ? startTime * 1000 : startTime) : Date.parse(startTime);
    if (!Number.isFinite(start)) return '';
    const sec = Math.floor((now - start) / 1000);
    if (sec < 0) return '';
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, '0')}s`;
    return `${Math.floor(sec / 3600)}h${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m`;
}

// A resolved model id, rendered the way the main line renders display_name. Version parts are
// one or two digits, so a snapshot date (claude-sonnet-4-20250514) is never read as a minor.
export function modelDisplay(model) {
    if (!model) return '';
    const id = String(model);
    const m = id.match(/(fable|opus|sonnet|haiku)[-_]?(\d{1,2})(?!\d)(?:[-.](\d{1,2})(?!\d))?/i);
    if (!m) return truncate(id, 20);
    const family = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    const version = m[3] ? `${m[2]}.${m[3]}` : m[2];
    const ctx = /\[1m\]|-1m\b/i.test(id) ? ' (1M)' : '';
    return `${family} ${version}${ctx}`;
}
