// A stand-in for the Anthropic API on 127.0.0.1, so a real Claude Code session runs without an
// account and without spending anything. Every /v1/messages call gets a short canned answer whose
// usage numbers the test chooses, which is what the status line's context bar is drawn from.

import { createServer } from 'node:http';

// usages: one override per streamed (main conversation) request, in order; the rest get `fallback`.
export function startMockApi({ usages = [], fallback = { input_tokens: 40, cache_creation_input_tokens: 900, cache_read_input_tokens: 96_960, output_tokens: 5 } } = {}) {
    const requests = [];
    let streamed = 0;
    const server = createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            let json = {};
            try {
                json = JSON.parse(body);
            } catch {}
            requests.push({ method: req.method, url: req.url, model: json.model, stream: json.stream === true });
            if (!req.url.startsWith('/v1/messages') || req.url.includes('count_tokens')) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ input_tokens: fallback.input_tokens + fallback.cache_read_input_tokens + fallback.cache_creation_input_tokens }));
                return;
            }
            const usage = { ...fallback, ...(json.stream ? usages[streamed++] : undefined) };
            const message = { id: `msg_mock_${requests.length}`, type: 'message', role: 'assistant', model: json.model, content: [], stop_reason: null, stop_sequence: null, usage };
            const text = 'Mock answer.';
            if (!json.stream) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ...message, content: [{ type: 'text', text }], stop_reason: 'end_turn' }));
                return;
            }
            res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
            const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
            send('message_start', { message });
            send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
            send('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
            send('content_block_stop', { index: 0 });
            send('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
            send('message_stop', {});
            res.end();
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, requests, close: () => server.close() })));
}
