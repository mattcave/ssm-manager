import { useState, useEffect, useRef, useCallback } from 'react'
import EnvironmentGroup from './components/EnvironmentGroup'
import LogPanel from './components/LogPanel'

export default function App () {
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState(null)
  const [depError, setDepError] = useState(null)
  const [activeTunnels, setActiveTunnels] = useState(new Set())
  const [logs, setLogs] = useState({})
  const [selectedTunnelId, setSelectedTunnelId] = useState(null)
  const [portWarnings, setPortWarnings] = useState([])
  const [search, setSearch] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark-blue')
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const THEMES = ['dark-blue', 'light', 'homebrew', 'ansi']
  const THEME_LABELS = { 'dark-blue': 'Dark', light: 'Light', homebrew: 'Term', ansi: 'ANSI' }
  function cycleTheme () {
    setTheme(t => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length])
  }

  const onDragStart = useCallback((e) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  useEffect(() => {
    function onMouseMove (e) {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const next = Math.min(600, Math.max(180, dragStartWidth.current + delta))
      setSidebarWidth(next)
    }
    function onMouseUp () {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    async function init () {
      const deps = await window.api.checkDeps()
      if (!deps.ok) setDepError(deps.error)

      const result = await window.api.loadConfig()
      if (result.error) {
        setConfigError(result.error)
      } else {
        setConfig(result.config)
        if (result.portWarnings && result.portWarnings.length > 0) {
          setPortWarnings(result.portWarnings)
        }
      }

      const active = await window.api.getActiveTunnels()
      setActiveTunnels(new Set(active))

      const restoredLogs = {}
      for (const tunnelId of active) {
        restoredLogs[tunnelId] = await window.api.getLogHistory(tunnelId)
      }
      setLogs(restoredLogs)
    }
    init()

    window.api.onLog(({ tunnelId, line }) => {
      setLogs(prev => ({
        ...prev,
        [tunnelId]: [...(prev[tunnelId] || []), line]
      }))
    })

    window.api.onTunnelExited(({ tunnelId }) => {
      setActiveTunnels(prev => {
        const next = new Set(prev)
        next.delete(tunnelId)
        return next
      })
    })

    return () => window.api.removeAllListeners()
  }, [])

  async function handleConnect (envName, tunnelId) {
    setSelectedTunnelId(tunnelId)
    const result = await window.api.connect(envName, tunnelId)
    if (result?.error) return
    setActiveTunnels(prev => new Set([...prev, tunnelId]))
  }

  async function handleDisconnect (tunnelId) {
    await window.api.disconnect(tunnelId)
    setActiveTunnels(prev => {
      const next = new Set(prev)
      next.delete(tunnelId)
      return next
    })
  }

  function clearLog (tunnelId) {
    setLogs(prev => ({ ...prev, [tunnelId]: [] }))
  }

  if (!config && !configError) return <div className="loading">Loading...</div>

  const q = search.trim().toLowerCase()
  const visibleEnvironments = (config?.environments || []).flatMap(env => {
    if (!q) return [env]
    const tunnels = env.tunnels.filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.remoteHost.toLowerCase().includes(q) ||
      String(t.localPort).includes(q) ||
      String(t.remotePort).includes(q)
    )
    return tunnels.length ? [{ ...env, tunnels }] : []
  })

  return (
    <div className="app-wrapper">
      {depError && (
        <div className="dep-warning">
          <strong>Missing dependency:</strong> {depError}
        </div>
      )}
      {configError && (
        <div className="dep-warning">
          <strong>Config error:</strong> {configError}
        </div>
      )}
      {portWarnings.length > 0 && (
        <div className="port-warning">
          <div className="port-warning-body">
            <strong>Port conflicts</strong> — Your config file has multiple tunnels assigned to the same local port, which may result in a conflict:
            <ul>
              {portWarnings.map(w => <li key={w}>{w}</li>)}
            </ul>
          </div>
          <button className="port-warning-dismiss" onClick={() => setPortWarnings([])}>✕</button>
        </div>
      )}
      <div className="app">
      <div className="sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
        <div className="sidebar-header">
          <h1>SSM Manager</h1>
          <div className="sidebar-header-actions">
            <button
              className="btn-theme"
              title="Switch colour theme"
              onClick={cycleTheme}
            >
              {THEME_LABELS[theme]}
            </button>
            <button
              className="btn-icon"
              title="Open config file"
              onClick={() => window.api.openConfigFile()}
            >
              ⚙
            </button>
          </div>
        </div>

        <div className="search-wrap">
          <input
            className="search-input"
            type="search"
            placeholder="Search tunnels…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <div className="environments">
          {visibleEnvironments.map(env => (
            <EnvironmentGroup
              key={env.name}
              env={env}
              activeTunnels={activeTunnels}
              selectedTunnelId={selectedTunnelId}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onSelect={setSelectedTunnelId}
            />
          ))}
        </div>
      </div>

      <div className="resize-handle" onMouseDown={onDragStart} />

      <div className="main">
        <LogPanel
          tunnelId={selectedTunnelId}
          lines={selectedTunnelId ? (logs[selectedTunnelId] || []) : []}
          onClear={() => selectedTunnelId && clearLog(selectedTunnelId)}
        />
      </div>
    </div>
    </div>
  )
}
