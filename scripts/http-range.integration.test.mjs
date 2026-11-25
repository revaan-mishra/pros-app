import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONTENT_SECURITY_POLICY } from './security-policy.mjs';

// Protocol checks only: no browser or manual interaction.
test('the local launcher serves partial audio, HEAD, and 416 responses consistently', { timeout: 10000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pros-range-'));
  let child;
  try {
    await writeFile(join(root, 'index.html'), '<!doctype html><title>PROS test</title>');
    await writeFile(join(root, 'track.mp3'), Buffer.from('0123456789'));
    const reserve = createServer();
    await new Promise((resolve, reject) => { reserve.once('error', reject); reserve.listen(0, '127.0.0.1', resolve); });
    const { port } = reserve.address();
    await new Promise((resolve, reject) => reserve.close(error => error ? reject(error) : resolve()));
    child = spawn(process.execPath, [fileURLToPath(new URL('./serve.mjs', import.meta.url)), '--no-open', '--port', String(port), '--dist', root], { stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 3500);
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('Open:')) { clearTimeout(timer); resolve(); } });
      child.stderr.on('data', chunk => { output += chunk; });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
    });
    const url = `http://127.0.0.1:${port}/track.mp3`;
    const full = await fetch(url);
    assert.equal(full.headers.get('content-security-policy'), CONTENT_SECURITY_POLICY);
    assert.equal(full.status, 200); assert.equal(full.headers.get('accept-ranges'), 'bytes');
    assert.equal(full.headers.get('content-type'), 'audio/mpeg'); assert.equal(await full.text(), '0123456789');
    for (const [range, body, contentRange] of [['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=7-', '789', 'bytes 7-9/10'], ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-30', '89', 'bytes 8-9/10']]) {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), contentRange);
      assert.equal(Number(response.headers.get('content-length')), body.length); assert.equal(await response.text(), body);
      assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    }
    const head = await fetch(url, { method: 'HEAD', headers: { Range: 'bytes=2-5' } });
    assert.equal(head.status, 206); assert.equal(head.headers.get('content-length'), '4');
    assert.equal(head.headers.get('content-range'), 'bytes 2-5/10'); assert.equal(await head.text(), '');
    for (const range of ['bytes=30-', 'bytes=0-1,3-4']) {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), 'bytes */10');
      assert.equal(response.headers.get('content-length'), '0'); assert.equal(await response.text(), '');
    }
    const conditional = await fetch(url, { headers: { Range: 'bytes=2-5', 'If-Range': '"unknown-validator"' } });
    assert.equal(conditional.status, 200); assert.equal(await conditional.text(), '0123456789');
  } finally {
    if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited; }
    await rm(root, { recursive: true, force: true });
  }
});
