import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

type AgentMarkProps = SVGProps<SVGSVGElement> & {
  /** 活动栏等大尺寸时略加强描边观感 */
  title?: string
}

/**
 * Agent 标识：对话气泡 + 星芒（对齐 Cursor / Zed，避免机器人剪影）。
 * 单 SVG，便于当 lucide 图标替换使用。
 */
export function AgentMark({ className, title, ...props }: AgentMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={cn('size-4', className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {/* 圆角气泡 */}
      <path
        d="M5.5 4.75h9.5A3.25 3.25 0 0 1 18.25 8v5.5a3.25 3.25 0 0 1-3.25 3.25H11.2L8.1 19.4a.6.6 0 0 1-1.02-.43v-2.22H5.5A3.25 3.25 0 0 1 2.25 13.5V8A3.25 3.25 0 0 1 5.5 4.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 星芒 */}
      <path
        d="M17.6 2.4l.55 1.85 1.85.55-1.85.55-.55 1.85-.55-1.85-1.85-.55 1.85-.55.55-1.85Z"
        fill="currentColor"
      />
      <path
        d="M20.55 6.35l.32 1.08 1.08.32-1.08.32-.32 1.08-.32-1.08-1.08-.32 1.08-.32.32-1.08Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  )
}
