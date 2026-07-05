const { execFileSync } = require('child_process');
const path = require('path');

// electron-builder's default ad-hoc signature omits sealed resources, which
// makes Gatekeeper report the app as "damaged" once quarantine/provenance
// attributes are attached. Re-sign with --deep so resources are sealed.
module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath]);
};
