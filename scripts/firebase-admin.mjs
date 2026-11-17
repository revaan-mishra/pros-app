// Operator-only helper using the pinned Firebase CLI's authenticated client.
// This script is never bundled into the app. It never reads or prints tokens.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const project = 'pros-rpg';
const [operation = 'check', uid] = process.argv.slice(2);
if (!['check', 'grant', 'revoke'].includes(operation) || (operation !== 'check' && !/^[A-Za-z0-9_-]{1,128}$/.test(uid || ''))) {
  console.error('Usage: node scripts/firebase-admin.mjs check | grant UID | revoke UID'); process.exit(2);
}
try {
  const cliAuth = require('firebase-tools/lib/auth');
  const options = { project, nonInteractive: true };
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account) throw new Error('Sign in using the Firebase CLI before running this operator command.');
  cliAuth.setActiveAccount(options, account);
  await require('firebase-tools/lib/requireAuth').requireAuth(options);
  if (operation === 'check') {
    const config = await require('firebase-tools/lib/gcp/identityPlatform').getConfig(project);
    console.log(JSON.stringify({ project, emailPasswordEnabled: config.signIn?.email?.enabled === true && config.signIn?.email?.passwordRequired === true, authorizedDomains: config.authorizedDomains || [] }, null, 2));
  } else {
    const { Client } = require('firebase-tools/lib/apiv2');
    const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1', auth: true });
    // An explicit UID only. Access documents are forbidden to app-side writers.
    await client.patch(`/projects/${project}/databases/(default)/documents/access/${uid}`, { fields: { enabled: { booleanValue: operation === 'grant' } } }, { queryParams: { 'updateMask.fieldPaths': 'enabled' } });
    console.log(`Private access ${operation === 'grant' ? 'enabled' : 'paused'} for the supplied UID in ${project}.`);
  }
} catch (error) {
  // Avoid nested HTTP/debug objects, which may include authentication metadata.
  console.error(error instanceof Error ? error.message : 'The operator command could not finish.'); process.exitCode = 1;
}
