// electron-builder afterPack hook.
//
// We ship an UNSIGNED build for now (no Developer ID). But on Apple Silicon the kernel refuses to
// execute an app bundle whose code signature is broken — and inserting our app into Electron's
// pre-signed framework breaks the original seal. electron-builder with `identity: null` *skips*
// signing, so the bundle stays broken and the app silently fails to launch ("damaged").
//
// To make the unsigned build actually runnable on this machine, ad-hoc sign the whole bundle
// (codesign --sign -) inside-out. This is NOT a substitute for Developer ID signing + notarization
// (Gatekeeper still warns on other machines) — replace this hook with real signing once certs exist.
const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
