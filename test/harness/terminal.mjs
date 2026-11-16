// Draws terminal output the way VS Code does: with xterm.js, the terminal engine VS Code embeds,
// in headless Chrome, with VS Code's Windows defaults. Then measures the pixels, so a check can say
// "the bar spills into the row above" instead of someone having to look.
//
// Defaults read from VS Code Insiders 1.147: Consolas 14px, lineHeight 1, letterSpacing 0,
// minimumContrastRatio 4.5. The DOM renderer is what VS Code uses with
// terminal.integrated.gpuAcceleration "off"; WebGL is its default.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const asset = (id) => readFileSync(require.resolve(id), 'utf8');

// Terminal colors VS Code falls back to under its Dark Modern and Light Modern themes: the
// background is panel.background, the ANSI colors are the workbench defaults.
export const THEMES = {
    dark: { background: '#181818', foreground: '#cccccc', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd' },
    light: { background: '#f8f8f8', foreground: '#3b3b3b', red: '#cd3131', green: '#107c10', yellow: '#949800', blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc' },
};

const CHROME = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
].filter(Boolean);

export function chromePath() {
    return CHROME.find((p) => existsSync(p)) ?? null;
}

export async function openBrowser() {
    const executablePath = chromePath();
    if (!executablePath) throw new Error('No Chrome or Edge found; set CHROME_PATH');
    // SwiftShader gives WebGL without a GPU, so the WebGL renderer can be drawn headless too.
    return puppeteer.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

const PAGE = `<!doctype html><html><head><style>${asset('@xterm/xterm/css/xterm.css')} body{margin:0}</style></head>
<body><div id="t"></div><script>${asset('@xterm/xterm/lib/xterm.js')}</script><script>${asset('@xterm/addon-webgl/lib/addon-webgl.js')}</script></body></html>`;

// Writes `text` (raw terminal output, rows joined by \r\n) into a terminal and screenshots it.
// Returns the PNG, the device pixels per CSS pixel, and the cell size in device pixels.
export async function renderTerminal(browser, { text, cols = 120, rows = 4, renderer = 'dom', dpr = 1, theme = 'dark' }) {
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: Math.ceil(cols * 12), height: Math.ceil(rows * 24) + 40, deviceScaleFactor: dpr });
        await page.setContent(PAGE);
        const colors = THEMES[theme];
        const box = await page.evaluate(
            async ({ text, cols, rows, renderer, colors }) => {
                document.body.style.background = colors.background;
                const term = new Terminal({
                    cols, rows, fontFamily: "Consolas, 'Courier New', monospace", fontSize: 14, lineHeight: 1, letterSpacing: 0,
                    minimumContrastRatio: 4.5, customGlyphs: true, rescaleOverlappingGlyphs: true, allowProposedApi: true, theme: colors,
                });
                term.open(document.getElementById('t'));
                if (renderer === 'webgl') {
                    const addon = new WebglAddon.WebglAddon();
                    term.loadAddon(addon);
                }
                await document.fonts.ready;
                await new Promise((resolve) => term.write(text, resolve));
                // Two frames: the renderers draw on requestAnimationFrame.
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const rect = document.querySelector('.xterm-screen').getBoundingClientRect();
                const b = term.buffer.active;
                const lines = Array.from({ length: rows }, (_, y) => b.getLine(b.viewportY + y)?.translateToString(true) ?? '');
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, lines };
            },
            { text, cols, rows, renderer, colors },
        );
        const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
        // lines: the visible rows as plain text, as this terminal laid them out.
        return { png, dpr, lines: box.lines, cell: { width: (box.width / cols) * dpr, height: (box.height / rows) * dpr }, background: colors.background };
    } finally {
        await page.close();
    }
}

// WCAG contrast ratio between two #rrggbb colors.
export function contrast(a, b) {
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = (h) => [0, 1, 2].map((i) => lin(parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16))).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// xterm.js draws dim text at half strength: the color mixed halfway to the background.
export function dimmed(color, background) {
    const ch = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
    return `#${[0, 1, 2].map((i) => Math.round((ch(color, i) + ch(background, i)) / 2).toString(16).padStart(2, '0')).join('')}`;
}

// For each region { name, x0, x1, y0, y1 } in device pixels, how far each pixel is from the
// background: the rows that hold ink, how many ink pixels each of those rows has (rowInk, by y),
// the region's width in pixels, and the strongest WCAG contrast ratio against the background.
export async function measure(browser, png, background, regions) {
    const page = await browser.newPage();
    try {
        return await page.evaluate(
            async ({ b64, background, regions }) => {
                const img = new Image();
                img.src = `data:image/png;base64,${b64}`;
                await img.decode();
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const g = canvas.getContext('2d');
                g.drawImage(img, 0, 0);
                const { data, width } = g.getImageData(0, 0, img.width, img.height);
                const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
                const lum = (r, gr, b) => 0.2126 * lin(r) + 0.7152 * lin(gr) + 0.0722 * lin(b);
                const hex = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
                const bgLum = lum(hex(background, 0), hex(background, 1), hex(background, 2));
                const ratio = (l) => (Math.max(l, bgLum) + 0.05) / (Math.min(l, bgLum) + 0.05);
                const out = {};
                for (const r of regions) {
                    const inkRows = [];
                    const rowInk = {};
                    let maxContrast = 1;
                    const [x0, x1] = [Math.max(0, Math.floor(r.x0)), Math.min(width, Math.ceil(r.x1))];
                    for (let y = Math.max(0, Math.floor(r.y0)); y < Math.min(img.height, Math.ceil(r.y1)); y++) {
                        let ink = 0;
                        for (let x = x0; x < x1; x++) {
                            const i = (y * width + x) * 4;
                            const c = ratio(lum(data[i], data[i + 1], data[i + 2]));
                            if (c >= 1.15) ink++;
                            if (c > maxContrast) maxContrast = c;
                        }
                        if (ink) {
                            inkRows.push(y);
                            rowInk[y] = ink;
                        }
                    }
                    out[r.name] = { inkRows, rowInk, width: Math.max(0, x1 - x0), maxContrast };
                }
                return out;
            },
            { b64: png.toString('base64'), background, regions },
        );
    } finally {
        await page.close();
    }
}
