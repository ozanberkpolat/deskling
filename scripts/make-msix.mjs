// Lays out the Microsoft Store package: the packaged app (dist/deskling-win32-x64) + AppxManifest.xml +
// logo assets, in dist/msix/. The release workflow then runs makeappx on it. The Store signs the
// package itself, so it is uploaded unsigned. Identity values come from Partner Center (Product
// identity); they are not secrets.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LOGO_COLORS, logoRows } from '../src/shared/sprites/logo.js'
import { png } from '../src/main/png.js'

export const IDENTITY = {
  name: 'OzanBerkPolat.DesklingDeskBuddy',
  publisher: 'CN=CE54EF76-5C7E-4E9A-99C3-9CD72C74D9E7',
  publisherDisplayName: 'Ozan Berk Polat',
  displayName: 'Deskling Desk Buddy',          // the name reserved in Partner Center ("Deskling" was taken)
}

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(root + 'package.json', 'utf8'))
const version = (process.env.DESKLING_VERSION || pkg.version).split('.').concat('0', '0', '0').slice(0, 3).join('.') + '.0'
const out = root + 'dist/msix/'

rmSync(out, { recursive: true, force: true })
cpSync(root + 'dist/deskling-win32-x64', out, { recursive: true })
mkdirSync(out + 'Assets', { recursive: true })
// Pixel art stays crisp: drawn at its own size, or at a divisor and scaled by a whole number.
const asset = (file, size, base = size) => writeFileSync(out + 'Assets/' + file, png(logoRows(base), LOGO_COLORS, size / base))
asset('StoreLogo.png', 50)
asset('Square44x44Logo.png', 44)
asset('Square44x44Logo.targetsize-44_altform-unplated.png', 44)
asset('Square150x150Logo.png', 150, 50)

const xml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
writeFileSync(out + 'AppxManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:desktop="http://schemas.microsoft.com/appx/manifest/desktop/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap desktop rescap">
  <Identity Name="${xml(IDENTITY.name)}" Publisher="${xml(IDENTITY.publisher)}" Version="${version}" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>${xml(IDENTITY.displayName)}</DisplayName>
    <PublisherDisplayName>${xml(IDENTITY.publisherDisplayName)}</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-us" />
  </Resources>
  <Applications>
    <Application Id="Deskling" Executable="deskling.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="${xml(IDENTITY.displayName)}" Description="A pixel-art desk companion that shows what your Claude Code sessions are doing"
        BackgroundColor="transparent" Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png" />
      <Extensions>
        <desktop:Extension Category="windows.startupTask" Executable="deskling.exe" EntryPoint="Windows.FullTrustApplication">
          <desktop:StartupTask TaskId="DesklingStartup" Enabled="true" DisplayName="Deskling" />
        </desktop:Extension>
      </Extensions>
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
`)
console.log(`dist/msix laid out: ${IDENTITY.name} ${version}`)
