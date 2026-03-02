const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron')

// Handle Squirrel install/uninstall events on Windows (creates/removes shortcuts).
// Must be called before anything else.
if (require('electron-squirrel-startup')) app.quit()

const path = require('path')
const { spawn } = require('child_process')
const { homedir } = require('os')
const { existsSync, readFileSync, writeFileSync } = require('fs')

const isDev = process.env.NODE_ENV === 'development'
const ICON_PATH = path.join(__dirname, 'assets', 'augmentt_ssm_icon_512.png')

app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication')

// ─── PATH helpers ─────────────────────────────────────────────────────────────

// GUI apps don't always inherit the shell PATH. Prepend common install
// locations so aws and session-manager-plugin are found regardless of how the
// user installed them.
const isWin = process.platform === 'win32'

const EXTRA_PATHS = isWin ? [
  'C:\\Program Files\\Amazon\\AWSCLIV2',
  'C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin',
] : [
  '/opt/homebrew/bin',                          // Homebrew (Apple Silicon)
  '/usr/local/bin',                             // Homebrew (Intel) / pip / direct
  '/usr/local/sessionmanagerplugin/bin',        // AWS official installer
  '/usr/bin',
  '/bin',
]

// On Windows the PATH variable is typically named 'Path', not 'PATH'.
// Find the key case-insensitively so we extend the right one.
const childEnv = (() => {
  const env = { ...process.env }
  const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH'
  env[pathKey] = [...EXTRA_PATHS, env[pathKey] || ''].join(path.delimiter)
  env.PYTHONUNBUFFERED = '1'  // force AWS CLI (Python) to flush output immediately
  return env
})()

// ─── Dependency Check ─────────────────────────────────────────────────────────

function checkBinary (bin, missingMsg) {
  return new Promise((resolve) => {
    const proc = spawn(bin, ['--version'], { stdio: 'pipe', env: childEnv })
    proc.on('error', () => resolve({ ok: false, error: missingMsg }))
    proc.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: `${bin} exited with code ${code}` }))
  })
}

async function checkDependencies () {
  const aws = await checkBinary('aws', 'AWS CLI not found. Install it from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html')
  if (!aws.ok) return aws
  const plugin = await checkBinary('session-manager-plugin', 'session-manager-plugin not found. Install it from https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html')
  return plugin
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(homedir(), '.ssm-manager')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

function checkPortConflicts (config) {
  const portMap = {}
  for (const env of config.environments || []) {
    for (const tunnel of env.tunnels || []) {
      const p = tunnel.localPort
      if (!portMap[p]) portMap[p] = []
      portMap[p].push(`${env.name} / ${tunnel.name}`)
    }
  }
  return Object.entries(portMap)
    .filter(([, entries]) => entries.length > 1)
    .map(([port, entries]) => `Local port ${port} is shared by: ${entries.join(', ')}`)
}

function loadConfig () {
  if (!existsSync(CONFIG_PATH)) {
    return { error: `No config file found at ${CONFIG_PATH}. Create it to get started.` }
  }
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    const portWarnings = checkPortConflicts(config)
    return { config, portWarnings }
  } catch (err) {
    return { error: `Failed to parse ${CONFIG_PATH}: ${err.message}` }
  }
}

function saveConfig (config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

// ─── Port Check ───────────────────────────────────────────────────────────────

// Returns { command, pid } if something is already listening on the port,
// or null if the port is free (or the check isn't supported on this platform).
// Uses lsof on macOS — net.createServer() misses conflicts when the existing
// listener is on ::1 (IPv6), which is where session-manager-plugin binds.
function checkPortOccupant (port) {
  if (isWin) return Promise.resolve(null) // TODO: implement via netstat on Windows

  return new Promise((resolve) => {
    // -F cpn: field output — c=command name, p=pid, n=network address
    // -sTCP:LISTEN: only LISTEN state, not established connections
    // -n -P: skip hostname/port-name resolution for speed
    const proc = spawn(
      'lsof',
      [`-iTCP:${port}`, '-sTCP:LISTEN', '-n', '-P', '-F', 'cpn'],
      { stdio: ['ignore', 'pipe', 'ignore'], env: childEnv }
    )

    let output = ''
    proc.stdout.on('data', d => { output += d.toString() })

    proc.on('close', (code) => {
      if (code !== 0 || !output.trim()) return resolve(null)

      let command = null, pid = null
      for (const line of output.trim().split('\n')) {
        if (line.startsWith('c') && !command) command = line.slice(1)
        if (line.startsWith('p') && !pid) pid = line.slice(1)
      }
      resolve({ command: command || 'unknown', pid: pid || '?' })
    })

    proc.on('error', () => resolve(null)) // lsof unavailable — skip check
  })
}

// ─── Process Management ───────────────────────────────────────────────────────

// Map of tunnelId -> { process, log[] }
const activeTunnels = new Map()

function buildSSMArgs (env, tunnel) {
  return [
    'ssm', 'start-session',
    '--target', env.bastion,
    '--document-name', 'AWS-StartPortForwardingSessionToRemoteHost',
    '--parameters', JSON.stringify({
      host: [tunnel.remoteHost],
      portNumber: [String(tunnel.remotePort)],
      localPortNumber: [String(tunnel.localPort)]
    }),
    '--region', env.region,
    '--profile', env.profile
  ]
}

function connectTunnel (win, env, tunnel) {
  if (activeTunnels.has(tunnel.id)) return

  const args = buildSSMArgs(env, tunnel)
  // detached: true makes aws the leader of a new process group so we can
  // signal the whole group (aws + session-manager-plugin) on disconnect.
  // On Windows we use taskkill instead, so detached is not needed (and
  // causes an unwanted visible console window).
  const proc = spawn('aws', args, { stdio: ['ignore', 'pipe', 'pipe'], env: childEnv, detached: !isWin })

  const entry = { process: proc, log: [] }
  activeTunnels.set(tunnel.id, entry)

  function logLine (text) {
    const ts = new Date().toLocaleTimeString(undefined, { hour12: false })
    const line = `[${ts}] ${text}`
    entry.log.push(line)
    win.webContents.send('tunnel:log', { tunnelId: tunnel.id, line })
  }

  logLine(`Connecting → ${tunnel.remoteHost}:${tunnel.remotePort} via local port ${tunnel.localPort} (PID ${proc.pid})`)

  function handleOutput (data) {
    data.toString().split('\n').filter(l => l.trim() !== '').forEach(l => logLine(l))
  }

  proc.stdout.on('data', handleOutput)
  proc.stderr.on('data', handleOutput)

  proc.on('exit', (code) => {
    logLine(code === 0 || code === null ? 'Disconnected' : `Disconnected (exit code ${code})`)
    activeTunnels.delete(tunnel.id)
    win.webContents.send('tunnel:exited', { tunnelId: tunnel.id, code })
  })

  proc.on('error', (err) => {
    logLine(`[error] Failed to start: ${err.message}`)
    activeTunnels.delete(tunnel.id)
    win.webContents.send('tunnel:exited', { tunnelId: tunnel.id, code: -1 })
  })
}

// Kill the spawned process and all its children.
// On macOS/Linux: send SIGTERM to the entire process group (negative pid).
// On Windows: use taskkill /T which walks the process tree.
function killProcess (proc) {
  if (isWin) {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try {
      process.kill(-proc.pid, 'SIGTERM')
    } catch {
      proc.kill()
    }
  }
}

function disconnectTunnel (tunnelId) {
  const entry = activeTunnels.get(tunnelId)
  if (!entry) return
  killProcess(entry.process)
  activeTunnels.delete(tunnelId)
}

// ─── About Window (Windows / Linux) ──────────────────────────────────────────

let aboutWindow = null

function showAboutWindow () {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus()
    return
  }
  aboutWindow = new BrowserWindow({
    width: 360,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'About SSM Manager',
    icon: ICON_PATH,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  aboutWindow.setMenuBarVisibility(false)
  aboutWindow.loadFile(path.join(__dirname, 'about.html'), { query: { version: app.getVersion() } })
  aboutWindow.on('closed', () => { aboutWindow = null })
}

// ─── Application Menu ─────────────────────────────────────────────────────────

function buildMenu () {
  const template = []

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  template.push({ role: 'editMenu' })

  template.push({
    role: 'help',
    submenu: [
      {
        label: 'About SSM Manager',
        click: () => process.platform === 'darwin' ? app.showAboutPanel() : showAboutWindow()
      }
    ]
  })

  return Menu.buildFromTemplate(template)
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    title: 'SSM Manager',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('deps:check', () => checkDependencies())

ipcMain.handle('config:load', () => loadConfig())

ipcMain.handle('config:save', (_e, config) => {
  saveConfig(config)
  return true
})

ipcMain.handle('config:open-file', () => {
  shell.openPath(CONFIG_PATH)
})

ipcMain.handle('tunnel:connect', async (_e, envName, tunnelId) => {
  const { config, error } = loadConfig()
  if (error) return { error }
  const env = config.environments.find(e => e.name === envName)
  if (!env) return { error: `Environment "${envName}" not found` }
  const tunnel = env.tunnels.find(t => t.id === tunnelId)
  if (!tunnel) return { error: `Tunnel "${tunnelId}" not found` }

  const occupant = await checkPortOccupant(tunnel.localPort)
  if (occupant) {
    const msg = `Port ${tunnel.localPort} is already in use by ${occupant.command} (PID ${occupant.pid})`
    const ts = new Date().toLocaleTimeString(undefined, { hour12: false })
    mainWindow.webContents.send('tunnel:log', { tunnelId, line: `[${ts}] [error] ${msg}` })
    return { error: msg }
  }

  connectTunnel(mainWindow, env, tunnel)
  return { ok: true }
})

ipcMain.handle('tunnel:disconnect', (_e, tunnelId) => {
  disconnectTunnel(tunnelId)
  return { ok: true }
})

ipcMain.handle('tunnel:active', () => [...activeTunnels.keys()])

ipcMain.handle('tunnel:log-history', (_e, tunnelId) => {
  const entry = activeTunnels.get(tunnelId)
  return entry ? entry.log : []
})

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    if (existsSync(ICON_PATH)) app.dock.setIcon(ICON_PATH)

    app.setAboutPanelOptions({
      applicationName: 'SSM Manager',
      applicationVersion: app.getVersion(),
      version: '',
      copyright: '© Augmentt',
      credits: 'Manages AWS SSM port-forwarding tunnels.\n\nConfig: ~/.ssm-manager/config.json',
      iconPath: path.join(__dirname, 'assets', 'icon.icns'),
    })
  }
  Menu.setApplicationMenu(buildMenu())
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  for (const [, entry] of activeTunnels) {
    try { killProcess(entry.process) } catch {}
  }
  if (process.platform !== 'darwin') app.quit()
})
