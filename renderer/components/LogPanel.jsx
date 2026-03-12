import { useEffect, useRef, memo } from 'react'

function classifyLine (line) {
  const lower = line.toLowerCase()
  if (/\berror\b|failed|exception|fatal/.test(lower)) return 'log-error'
  if (/\bwarn(ing)?\b|\[hint\]/.test(lower)) return 'log-warn'
  return 'log-info'
}

const SSO_RE = /aws sso login --profile (\S+)/

function renderLine (line, i, tunnelId) {
  const cls = `log-line ${classifyLine(line)}`
  const match = line.includes('[hint]') && line.match(SSO_RE)
  if (match) {
    const profile = match[1]
    return (
      <span key={i} className={cls}>
        {line}
        <button
          className="btn-reauth"
          onClick={() => window.api.ssoLogin(profile, tunnelId)}
        >Re-authenticate</button>
      </span>
    )
  }
  return <span key={i} className={cls}>{line}</span>
}

export default memo(function LogPanel ({ tunnelId, lines, onClear }) {
  const containerRef = useRef(null)
  const bottomRef = useRef(null)
  const isAtBottom = useRef(true)

  function handleScroll () {
    const el = containerRef.current
    if (!el) return
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
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
      <div className="log-body" ref={containerRef} onScroll={handleScroll}>
        {lines.length === 0
          ? <span className="log-empty">No output yet</span>
          : lines.map((line, i) => renderLine(line, i, tunnelId))
        }
        <div ref={bottomRef} />
      </div>
    </div>
  )
})
