import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AgentScrollToBottomButtonProps {
  onClick: () => void
  className?: string
}

export function AgentScrollToBottomButton({ onClick, className }: AgentScrollToBottomButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={
        className ??
        'absolute bottom-3 left-1/2 z-10 h-7 -translate-x-1/2 gap-1 rounded-full border border-border/60 bg-background/95 px-3 text-[11px] shadow-md backdrop-blur-sm'
      }
      onClick={onClick}
    >
      <ChevronDown className="size-3.5" />
      回到底部
    </Button>
  )
}
