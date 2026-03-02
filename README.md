# SSM Manager

A desktop app for managing AWS SSM port-forwarding tunnels. Connect and disconnect tunnels across multiple environments from a single UI, with live log output and persistent configuration. Runs on macOS and Windows.

## What it does

SSM Manager wraps `aws ssm start-session` with the `AWS-StartPortForwardingSessionToRemoteHost` document, letting you open and close tunnels to remote hosts (RDS, internal services, Windows RDP, etc.) through a bastion EC2 instance — without touching the terminal.

Tunnels are grouped by environment. Each tunnel maps a local port on your machine to a remote host/port through the configured bastion. Logs from each tunnel are shown in real time in the right-hand pane.

## Prerequisites

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- [AWS Session Manager Plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)
- Named AWS CLI profiles with SSM access to the target instances
- Node.js 18+ and npm

Both `aws` and `session-manager-plugin` must be installed. Common install locations are detected automatically (Homebrew on macOS; `C:\Program Files\Amazon\...` on Windows).

## Configuration

Create `~/.ssm-manager/config.json`:

```json
{
  "environments": [
    {
      "name": "Production",
      "bastion": "i-0abc123def456",
      "profile": "my-aws-profile",
      "region": "us-east-1",
      "tunnels": [
        {
          "id": "prod-rds",
          "name": "RDS MySQL",
          "remoteHost": "my-db.cluster-xyz.us-east-1.rds.amazonaws.com",
          "remotePort": 3306,
          "localPort": 3307
        }
      ]
    }
  ]
}
```

Each tunnel requires a unique `id`. The app will warn on startup if any two tunnels share the same `localPort`.

## Development

Install dependencies:

```sh
npm install
```

Run in development mode (Vite dev server + Electron with DevTools):

```sh
npm run dev
```

## Building

Build the renderer bundle only:

```sh
npm run build:renderer
```

Package and produce a distributable:

```sh
npm run make
```

Output is written to `out/make/`. On macOS this produces a DMG and ZIP. On Windows this produces a ZIP.

### Windows icon

Before building on Windows for the first time, generate `assets/icon.ico` from the source PNG:

```sh
npx electron-icon-maker --input=assets/augmentt_ssm_icon_512.png --output=assets
```

Then copy `assets/icons/win/icon.ico` to `assets/icon.ico`. The packager looks for `assets/icon.ico` (no extension needed in config — Forge appends it automatically).

## To Do

- **macOS universal binary** — current CI build targets arm64 (Apple Silicon); add a second `macos-13` job for x64, or switch to `--arch=universal`
- **Connection uptime** — display how long each tunnel has been connected
- **Inactivity disconnect detection** — detect when AWS drops a tunnel due to inactivity and reflect that in the UI automatically