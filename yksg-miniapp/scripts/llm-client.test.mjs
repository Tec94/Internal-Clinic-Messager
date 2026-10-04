import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatCompletion, EXPERIENTIAL_BASE_URL, MODEL_ID } from './llm-client.mjs';

test('the local helper rejects browser-prefixed credentials without a request', async (t) => {
  const previous = process.env.EXPLABS_API_KEY;
  const previousVite = process.env.VITE_EXPLABS_API_KEY;
  t.after(() => {
    if (previous === undefined) delete process.env.EXPLABS_API_KEY;
    else process.env.EXPLABS_API_KEY = previous;
    if (previousVite === undefined) delete process.env.VITE_EXPLABS_API_KEY;
    else process.env.VITE_EXPLABS_API_KEY = previousVite;
  });
  delete process.env.EXPLABS_API_KEY;
  process.env.VITE_EXPLABS_API_KEY = 'browser-key-must-not-be-used';
  const fetch = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('No request is allowed without a server key.');
  });
  await assert.rejects(chatCompletion([]), /EXPLABS_API_KEY is required/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('the local helper sends completion options and parses streaming responses offline', async (t) => {
  const previous = process.env.EXPLABS_API_KEY;
  process.env.EXPLABS_API_KEY = 'synthetic-test-key';
  t.after(() => {
    if (previous === undefined) delete process.env.EXPLABS_API_KEY;
    else process.env.EXPLABS_API_KEY = previous;
  });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(String(url), `${EXPERIENTIAL_BASE_URL}/chat/completions`);
    const body = JSON.parse(init.body);
    requests.push(body);
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer synthetic-test-key');
    if (body.stream) return new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    });
    return Response.json({ choices: [{ message: { content: 'Hello' } }] });
  });
  const messages = [{ role: 'user', content: 'Hello' }];
  const reply = await chatCompletion(messages, { maxTokens: 1 });
  assert.equal(reply.choices[0].message.content, 'Hello');
  assert.deepEqual(requests[0], { model: MODEL_ID, messages, stream: false, max_tokens: 1 });
  const chunks = [];
  for await (const chunk of await chatCompletion(messages, { stream: true })) chunks.push(chunk);
  assert.equal(chunks[0].choices[0].delta.content, 'Hello');
});
