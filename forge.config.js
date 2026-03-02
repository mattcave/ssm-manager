const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const { execSync } = require('child_process')
const path = require('path')

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'SSM Manager',
    executableName: 'ssm-manager',
    icon: path.join(__dirname, 'assets', 'icon'),
    // Exclude source files that are not needed in the packaged app
    ignore: [
      /^\/renderer\//,
      /^\/out\//,
      /^\/vite\.config\.mjs$/,
      /^\/plan\.txt$/,
      /^\/\.gitignore$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'SSM Manager',
        icon: path.join(__dirname, 'assets', 'icon.icns'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'ssm_manager',
        authors: 'Augmentt',
        setupExe: 'SSM Manager Setup.exe',
        iconUrl: 'https://raw.githubusercontent.com/mattcave/ssm-manager/main/assets/icon.ico',
        setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
      },
    },
  ],
  hooks: {
    generateAssets: async () => {
      console.log('Building renderer with Vite...')
      execSync('npm run build:renderer', { stdio: 'inherit' })
    },
  },
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
