import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const accountBuild = process.argv.includes('--android-accounts');
const mode = accountBuild ? 'native-accounts' : 'native-demo';
const settings = accountBuild ? loadEnv(mode, cwd, 'VITE_FIREBASE_') : {};
const firebaseKeys = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID',
];
const firebase = Object.fromEntries(firebaseKeys.map(key => [key, settings[key]?.trim() || '']));
if (accountBuild && firebaseKeys.some(key => !firebase[key])) {
  throw new Error('Set the four Firebase web settings in .env.native-accounts.local before building the Android accounts app.');
}

execFileSync(process.execPath, [
  'node_modules/vite/bin/vite.js', 'build', '--mode', mode, '--outDir', 'native/www',
], {
  cwd,
  env: {
    ...process.env,
    ...firebase,
    VITE_FIREBASE_EMULATORS: 'false',
    VITE_REQUIRE_CLOUD: String(accountBuild),
  },
  stdio: 'inherit',
});
writeFileSync(new URL('./www/pros-native-build.txt', import.meta.url), `${mode}\n`);

if (accountBuild) {
  execFileSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android'], {
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    env: { ...process.env, PROS_ANDROID_ACCOUNTS: 'true' },
    stdio: 'inherit',
  });
}
