export default function TunnelRow ({
  tunnel,
  envName,
  isActive,
  isSelected,
  onConnect,
  onDisconnect,
  onSelect
}) {
  function handleToggle (e) {
    e.stopPropagation()
    if (isActive) {
      onDisconnect(tunnel.id)
    } else {
      onConnect(envName, tunnel.id)
    }
  }

  const tooltip = `${tunnel.remoteHost}\nRemote: ${tunnel.remotePort}  ·  Local: ${tunnel.localPort}`

  return (
    <div
      className={`tunnel-row ${isSelected ? 'selected' : ''}`}
      title={tooltip}
      onClick={() => onSelect(tunnel.id)}
    >
      <span className={`status-dot ${isActive ? 'connected' : 'disconnected'}`} />

      <div className="tunnel-info">
        <span className="tunnel-name">{tunnel.name}</span>
        <span className="tunnel-ports">
          <span className="port-local">:{tunnel.localPort}</span> → {tunnel.remoteHost}:{tunnel.remotePort}
        </span>
      </div>

      <button
        className={`btn-connect ${isActive ? 'active' : ''}`}
        onClick={handleToggle}
      >
        {isActive ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  )
}
