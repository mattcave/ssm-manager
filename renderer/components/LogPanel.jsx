import { useEffect, useRef } from 'react'

function classifyLine (line) {
  const lower = line.toLowerCase()
  if (/\berror\b|failed|exception|fatal/.test(lower)) return 'log-error'
  if (/\bwarn(ing)?\b/.test(lower)) return 'log-warn'
  return 'log-info'
}

export default function LogPanel ({ tunnelId, lines, onClear }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  if (!tunnelId) {
    return (
      <div className="log-panel empty">
        <p>Select a tunnel to view logs</p>
      </div>
    )
  }

  return (
    <div className="log-panel">
      <div className="log-header">
        <span className="log-title">Logs — {tunnelId}</span>
        <button className="btn-clear" onClick={onClear}>Clear</button>
      </div>
      <div className="log-body">
        {lines.length === 0
          ? <span className="log-empty">No output yet</span>
          : lines.map((line, i) => (
            <span key={i} className={`log-line ${classifyLine(line)}`}>{line}</span>
          ))
        }
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
