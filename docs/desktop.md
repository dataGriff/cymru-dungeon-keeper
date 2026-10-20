# Desktop builds (Tauri)

The desktop app is a [Tauri v2](https://v2.tauri.app) shell around the same
Vite build that runs in the browser. `src-tauri/` holds the Rust crate and
`tauri.conf.json`; the game itself is untouched and lives in `dist/`.

```sh
cargo install tauri-cli --version "^2"   # once
task desktop        # npm run build, then cargo tauri build
task desktop:dev    # cargo tauri dev against the Vite dev server
```

Bundles land in `src-tauri/target/release/bundle/`:

| Platform | Bundles |
| --- | --- |
| macOS | `macos/Steward of Annwn.app`, `dmg/Steward of Annwn_0.1.0_<arch>.dmg` |
| Windows | `msi/Steward of Annwn_0.1.0_x64_en-US.msi`, `nsis/Steward of Annwn_0.1.0_x64-setup.exe` |
| Linux | `deb/`, `rpm/`, `appimage/` |

The window opens at 1120×860 (minimum 900×700), resizable. The identifier
is `com.hungovercoders.annwn`.

## Prerequisites

Rust (stable) plus the platform's WebView:

- **Debian/Ubuntu**
  ```sh
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```
- **macOS**: `xcode-select --install` (Xcode Command Line Tools). WebKit is part of the OS.
- **Windows**: Visual Studio Build Tools (C++ workload) and the
  [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/)
  (preinstalled on Windows 10/11).

The container this project was scaffolded in has Rust but not the GTK
development packages, so `cargo check` in `src-tauri/` stops at the system
library step (the crates themselves download and compile):

```
  The system library `gdk-3.0` required by crate `gdk-sys` was not found.
  The file `gdk-3.0.pc` needs to be installed and the PKG_CONFIG_PATH environment variable must contain its parent directory.
```

Install the Debian packages above and it builds.

## Icons

`src-tauri/icons/icon.png` (1024²), `32x32.png`, `128x128.png` and
`128x128@2x.png` are rendered from the box front (`docs/box/front.png`).
`icon.icns` and `icon.ico` are listed in `tauri.conf.json` but not committed:
generate them with `cargo tauri icon src-tauri/icons/icon.png` (it writes
every size Tauri needs, including both). Until then, remove those two entries
or run that command before `task desktop`.

## Signing

Builds are **unsigned** by default. Users on macOS will see "unidentified
developer"; on Windows, SmartScreen.

- **macOS**: set `APPLE_SIGNING_IDENTITY` to your Developer ID certificate
  name (and `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` to notarize) when
  running `cargo tauri build`. `bundle.macOS.signingIdentity` in
  `tauri.conf.json` is `null` so the environment variable wins.
- **Windows**: put the certificate thumbprint in
  `bundle.windows.certificateThumbprint` (and `timestampUrl`); Tauri calls
  `signtool` from the Windows SDK.

## In-game display options

Fullscreen and scaling are implemented in the web app, not the shell, so they
behave identically in a browser and on the desktop:

- **F11** toggles fullscreen (the toolbar also has a button).
- **Integer scaling 1×–4×** picks a crisp pixel multiple for the board when
  the window is big enough; the HUD and manual lay out around it.
