import type { ReactNode } from 'react'

interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
}

export function SplitPane({ left, right }: SplitPaneProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-2">
      <section className="min-h-0 min-w-0 overflow-hidden border-r border-border/60 bg-editor">
        {left}
      </section>
      <section className="min-h-0 min-w-0 overflow-hidden bg-preview">{right}</section>
    </div>
  )
}
