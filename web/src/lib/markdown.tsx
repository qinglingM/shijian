export function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return []
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let inList = false
  let listItems: React.ReactNode[] = []

  function flushList(key: number) {
    if (!inList) return
    nodes.push(<ul key={key}>{listItems}</ul>)
    listItems = []
    inList = false
  }

  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    if (line === '') {
      flushList(nodes.length)
      i++
      continue
    }

    if (line.startsWith('### ')) {
      flushList(nodes.length)
      nodes.push(<h3 key={nodes.length}>{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      flushList(nodes.length)
      nodes.push(<h2 key={nodes.length}>{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      flushList(nodes.length)
      nodes.push(<h1 key={nodes.length}>{renderInline(line.slice(2))}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true
      listItems.push(<li key={listItems.length}>{renderInline(line.slice(2))}</li>)
    } else {
      flushList(nodes.length)
      nodes.push(<p key={nodes.length}>{renderInline(line)}</p>)
    }
    i++
  }
  flushList(nodes.length)

  return nodes
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export function stripMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^### /gm, '')
    .replace(/^## /gm, '')
    .replace(/^# /gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/^- /gm, '')
    .replace(/> /gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
