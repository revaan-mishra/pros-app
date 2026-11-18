/** Shared by the local server and the static-host header file.
 * Keep inference local: remote connections are for Firebase or model downloads. */
export const CONNECT_SOURCES = [
  "'self'",
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://firestore.googleapis.com',
  'https://huggingface.co',
  'https://*.huggingface.co',
  'https://*.hf.co',
  'https://raw.githubusercontent.com',
];
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src ${CONNECT_SOURCES.join(' ')}`,
  'frame-src https://pros-rpg.firebaseapp.com https://pros-rpg.web.app',
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
