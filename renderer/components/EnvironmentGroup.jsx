import TunnelRow from './TunnelRow'

export default function EnvironmentGroup ({
  env,
  activeTunnels,
  selectedTunnelId,
  onConnect,
  onDisconnect,
  onSelect
}) {
  const anyActive = env.tunnels.some(t => activeTunnels.has(t.id))

  return (
    <div className="env-group">
      <div className="env-header">
        <span className={`env-indicator ${anyActive ? 'active' : ''}`} />
        <span className="env-name">{env.name}</span>
        <span className="env-meta">{env.region}</span>
      </div>

      <div className="tunnel-list">
        {env.tunnels.map(tunnel => (
          <TunnelRow
            key={tunnel.id}
            tunnel={tunnel}
            envName={env.name}
            isActive={activeTunnels.has(tunnel.id)}
            isSelected={selectedTunnelId === tunnel.id}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
