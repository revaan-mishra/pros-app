import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const env = {
  ...process.env,
  VITE_FIREBASE_API_KEY: '',
  VITE_FIREBASE_AUTH_DOMAIN: '',
  VITE_FIREBASE_PROJECT_ID: '',
  VITE_FIREBASE_APP_ID: '',
  VITE_REQUIRE_CLOUD: 'false',
};

execFileSync(process.execPath, [
  'node_modules/vite/bin/vite.js', 'build', '--mode', 'native-demo', '--outDir', 'native/www',
], { cwd, env, stdio: 'inherit' });
