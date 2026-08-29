import { cn } from '@/lib/utils'
import { buildSimpleDiffLines, type AcpToolDiff } from '@/stores/acp-chat-types'

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

interface AgentDiffPreviewProps {
  diffs: AcpToolDiff[]
}

export function AgentDiffPreview({ diffs }: AgentDiffPreviewProps) {
  if (diffs.length === 0) return null

  return (
    <div className="space-y-2">
      {diffs.map((diff) => {
        const lines = buildSimpleDiffLines(diff.oldText, diff.newText)
        const added = lines.filter((l) => l.kind === 'add').length
        const removed = lines.filter((l) => l.kind === 'del').length
        return (
          <div
            key={diff.path}
            className="overflow-hidden rounded-lg border border-border/50 bg-background/60"
          >
            <div className="flex items-center gap-2 border-b border-border/40 px-2 py-1">
              <span className="truncate font-mono text-[10px] font-medium" title={diff.path}>
                {basename(diff.path)}
              </span>
              <span className="ml-auto shrink-0 text-[10px] tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>
                <span className="mx-1 text-muted-foreground">/</span>
                <span className="text-red-600 dark:text-red-400">−{removed}</span>
              </span>
            </div>
            <pre className="max-h-48 overflow-auto text-[10px] leading-relaxed">
              {lines.map((line, i) => (
                <div
                  key={`${i}-${line.kind}-${line.text.slice(0, 24)}`}
                  className={cn(
                    'whitespace-pre-wrap break-all px-2 py-px',
                    line.kind === 'add' &&
                      'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
                    line.kind === 'del' && 'bg-red-500/10 text-red-800 dark:text-red-300',
                    line.kind === 'same' && 'text-muted-foreground',
                  )}
                >
                  <span className="mr-1 inline-block w-3 select-none opacity-60">
                    {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}
                  </span>
                  {line.text || ' '}
                </div>
              ))}
            </pre>
          </div>
        )
      })}
    </div>
  )
}
