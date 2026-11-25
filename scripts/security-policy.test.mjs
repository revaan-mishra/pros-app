import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONTENT_SECURITY_POLICY as policy } from './security-policy.mjs';
const directives=new Map(policy.split('; ').map(part=>{const [key,...sources]=part.split(' ');return [key,sources];}));
function allowed(directive,url){const target=new URL(url);return (directives.get(directive)||directives.get('default-src')).some(source=>source==="'self'"?target.origin==='http://127.0.0.1:4173':source.includes('://*.')?target.protocol==='https:'&&target.hostname.endsWith('.'+source.split('*.')[1]):source===target.origin);}
test('signup, session refresh and private sync are reachable under the real served policy',()=>{
 for(const url of ['https://identitytoolkit.googleapis.com/v1/accounts:signUp','https://securetoken.googleapis.com/v1/token','https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel'])assert.equal(allowed('connect-src',url),true,url);
 assert.equal(allowed('frame-src','https://pros-rpg.firebaseapp.com/__/auth/iframe'),true);
});
test('optional model downloads, worker and WASM compile are allowed without arbitrary JavaScript eval',()=>{
 for(const url of ['https://huggingface.co/mlc-ai/model/resolve/revision/file.bin','https://cdn-lfs.huggingface.co/model.bin','https://cas-bridge.xethub.hf.co/model.bin','https://us.aws.cdn.hf.co/model.bin','https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/revision/model.wasm'])assert.equal(allowed('connect-src',url),true,url);
 assert.equal(allowed('worker-src','http://127.0.0.1:4173/assets/local-ai-worker.js'),true);
 assert.ok(directives.get('script-src').includes("'wasm-unsafe-eval'"));assert.ok(!directives.get('script-src').includes("'unsafe-eval'"));
});
test('unrelated origins, remote scripts and arbitrary framing remain blocked',()=>{
 for(const url of ['https://example.com','https://huggingface.co.evil.example','https://identitytoolkit.googleapis.com.evil.example','http://huggingface.co'])assert.equal(allowed('connect-src',url),false,url);
 assert.equal(allowed('script-src','https://huggingface.co/script.js'),false);
 assert.deepEqual(directives.get('frame-ancestors'),["'none'"]);assert.deepEqual(directives.get('object-src'),["'none'"]);
});
test('static hosting and local server use the same reviewed policy',async()=>{
 const headers=await readFile(new URL('../public/_headers',import.meta.url),'utf8');assert.equal(headers.split('\n').find(line=>line.startsWith('  Content-Security-Policy: '))?.slice('  Content-Security-Policy: '.length),policy);
 const { hosting } = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
 const firebaseHeaders = hosting.headers.find(rule => rule.source === '**')?.headers;
 assert.equal(firebaseHeaders?.find(header => header.key === 'Content-Security-Policy')?.value, policy);
});
