const accounts = process.env.PROS_ANDROID_ACCOUNTS === 'true';

module.exports = {
  appId: accounts ? 'app.prosrpg' : 'app.prosrpg.preview',
  appName: accounts ? 'PROS' : 'PROS Preview',
  webDir: 'www',
};
