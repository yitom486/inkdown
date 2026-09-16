import { cn } from '@/lib/utils'

interface ReadingProgressRingProps {
  progress: number
  size?: number
  className?: string
}

export function ReadingProgressRing({
  progress,
  size = 36,
  className,
}: ReadingProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, progress))
  const percent = Math.round(clamped * 100)
  const stroke = 2.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
      title={`全书进度 ${percent}%`}
      aria-label={`全书阅读进度 ${percent}%`}
    >
      <svg width={size} height={size} className="block -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="text-primary transition-[stroke-dashoffset] duration-200"
        />
      </svg>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-medium tabular-nums text-foreground">
        {percent}%
      </span>
    </div>
  )
}
