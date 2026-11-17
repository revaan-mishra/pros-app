#!/usr/bin/env node
/** Dependency-free production server. Binds only to this Mac. */
import { createServer, request as httpRequest } from 'node:http';
import { createReadStream, constants } from 'node:fs';
import { stat, realpath, access } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { selectByteRange } from './http-range.mjs';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const port = Number(option('--port', '4173'));
const dist = resolve(option('--dist', resolve(projectRoot, 'dist')));
const shouldOpen = !args.includes('--no-open');
const signature = createHash('sha256').update(`${projectRoot}\0${dist}`).digest('hex').slice(0, 16);
const url = `http://127.0.0.1:${port}`;
const healthPath = '/__pros_local_server';
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.txt':'text/plain; charset=utf-8' };
if (!Number.isInteger(port) || port < 1024 || port > 65535) { console.error('Choose a port between 1024 and 65535.'); process.exit(1); }
try { await access(resolve(dist, 'index.html'), constants.R_OK); }
catch { console.error(`\nThe finished app has not been built yet.\n\nOpen a terminal in:\n${projectRoot}\n\nRun pnpm install --frozen-lockfile, then pnpm build.\nAfter the build succeeds, double-click Start PROS.command again.\n`); process.exit(1); }
const canonicalDist = await realpath(dist);
function openBrowser() {
  if (!shouldOpen) return;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const parameters = process.platform === 'win32' ? ['/c','start','',url] : [url];
  const child = spawn(command, parameters, { stdio:'ignore', detached:true });
  child.on('error', () => console.log(`Open this address in your browser: ${url}`)); child.unref();
}
function identifyExisting() {
  return new Promise(done => {
    const req = httpRequest(`${url}${healthPath}`, { timeout:1500 }, response => {
      let body='';response.setEncoding('utf8');response.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy();});
      response.on('end',()=>{try{const data=JSON.parse(body);done(data.app==='pros-local-core'&&data.workspace===signature);}catch{done(false);}});
    });
    req.on('timeout',()=>req.destroy());req.on('error',()=>done(false));req.end();
  });
}
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD','Content-Type':'text/plain; charset=utf-8'});res.end('Method not allowed');return;}
  const rawPath=(req.url||'/').split('?')[0];
  if(rawPath===healthPath){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify({app:'pros-local-core',workspace:signature}));return;}
  let pathname;try{pathname=decodeURIComponent(rawPath);}catch{res.writeHead(400);res.end('Invalid path');return;}
  if(pathname.includes('\0')||pathname.includes('\\')){res.writeHead(400);res.end('Invalid path');return;}
  let file=resolve(canonicalDist,`.${pathname}`);
  if(file!==canonicalDist&&!file.startsWith(canonicalDist+sep)){res.writeHead(403);res.end('Forbidden');return;}
  try{
    let details;try{details=await stat(file);if(details.isDirectory()){file=resolve(file,'index.html');details=await stat(file);}}
    catch{if(extname(pathname)){res.writeHead(404);res.end('Not found');return;}file=resolve(canonicalDist,'index.html');details=await stat(file);}
    if(!details.isFile()){res.writeHead(404);res.end('Not found');return;}
    const actual=await realpath(file);if(!actual.startsWith(canonicalDist+sep)){res.writeHead(403);res.end('Forbidden');return;}
    const extension=extname(actual).toLowerCase();const fresh=extension==='.html'||extension==='.webmanifest'||/(?:sw|workbox-[^/]+)\.js$/.test(actual);
    // With no validator support, an If-Range request safely receives the full
    // representation. Plain byte ranges support local audio seeking/resume.
    const range=selectByteRange(req.headers['if-range']?undefined:req.headers.range,details.size);
    const headers={'Content-Type':mime[extension]||'application/octet-stream','Content-Length':range.length,'Accept-Ranges':'bytes','Cache-Control':range.status===416?'no-store':fresh?'no-cache':actual.includes(`${sep}assets${sep}`)?'public, max-age=31536000, immutable':'public, max-age=86400'};
    if(range.contentRange)headers['Content-Range']=range.contentRange;
    res.writeHead(range.status,headers);
    if(req.method==='HEAD'||range.status===416){res.end();return;}
    const stream=range.status===206?createReadStream(actual,{start:range.start,end:range.end}):createReadStream(actual);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{if(!res.headersSent)res.writeHead(500);res.end('Unable to read this file');}
});
server.on('error',async error=>{
  if(error.code==='EADDRINUSE'&&await identifyExisting()){console.log(`\nPROS is already open at ${url}\n`);openBrowser();process.exit(0);}
  if(error.code==='EADDRINUSE'){console.error(`\nAnother application is using port ${port}.\nClose that server, then start PROS again.\n`);console.error('PROS keeps a stable address so your browser can find the same saved progress.');}
  else console.error(`Unable to start PROS: ${error.message}`);process.exit(1);
});
server.listen(port,'127.0.0.1',()=>{console.log(`\n  PROS · A world of your making\n\n  Open: ${url}\n\n  Leave this window open while using the app.\n  Press Control-C here to stop the local server.\n`);openBrowser();});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
