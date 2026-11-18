const pkg = require('./package.json')
module.exports = {
  ...pkg.build,
  artifactName: 'FGO-Bond-Windows-${version}-NoUpdate.${ext}',
  directories: { ...pkg.build.directories, output: 'release-no-update' },
  extraMetadata: { ...(pkg.build.extraMetadata || {}), noUpdate: true },
}
