import React from 'react'

export interface BracketConnectorProps {
  isCollapsed: boolean
  isActive?: boolean
  className?: string
  /** 点击括号跳转正文（与卡片点击同义，让指引箭头有真实功能） */
  onActivate?: () => void
  activateTitle?: string
  /** 悬停括号同样照亮正文（与卡片悬停同义） */
  onHover?: (hovering: boolean) => void
}

/**
 * BracketConnector（细线分支抱合括号引线）
 *
 * 在阅读正文锚点与右侧知识卡片流之间建立发丝级微光指示关系：
 * - 单行折叠态：横向虚/实线微距指向卡片
 * - 展开多功能态：从左侧单一锚点引出平滑弧线，在右侧分叉抱合卡片上中下沿
 */
export const BracketConnector: React.FC<BracketConnectorProps> = ({
  isCollapsed,
  isActive = false,
  className = '',
  onActivate,
  activateTitle = '在正文中定位',
  onHover,
}) => {
  const strokeColor = isActive
    ? 'var(--primary)'
    : 'var(--border)'
  // 有跳转行为时渲染为按钮（可点击、可悬停），否则保持装饰性 div
  const Tag: React.ElementType = onActivate ? 'button' : 'div'
  const interactiveProps = onActivate
    ? {
        type: 'button' as const,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onActivate()
        },
        onMouseEnter: () => onHover?.(true),
        onMouseLeave: () => onHover?.(false),
        title: activateTitle,
        'aria-label': activateTitle,
      }
    : { 'aria-hidden': true } as const

  // 1. 单行折叠态：极细直连虚实线
  if (isCollapsed) {
    return (
      <Tag
        {...interactiveProps}
        className={`w-7 xl:w-9 h-9 flex items-center justify-center shrink-0 select-none ${onActivate ? 'cursor-pointer hover:opacity-100' : ''} ${className}`}
      >
        <svg
          className="w-full h-4 overflow-visible"
          viewBox="0 0 36 16"
          preserveAspectRatio="none"
        >
          <line
            x1="2"
            y1="8"
            x2="34"
            y2="8"
            stroke={strokeColor}
            strokeWidth={isActive ? '1.2' : '1'}
            strokeDasharray={isActive ? 'none' : '3 2'}
            strokeOpacity={isActive ? '0.9' : '0.55'}
          />
          <circle cx="2" cy="8" r="2" fill={strokeColor} opacity={isActive ? '1' : '0.7'} />
          <circle cx="34" cy="8" r="1.5" fill={strokeColor} opacity={isActive ? '0.9' : '0.5'} />
        </svg>
      </Tag>
    )
  }

  // 2. 完整展开态：抱合式右向开口微光弧线
  return (
    <Tag
      {...interactiveProps}
      className={`w-7 xl:w-9 h-full min-h-[90px] flex items-center justify-center shrink-0 relative select-none ${onActivate ? 'cursor-pointer' : ''} ${className}`}
    >
      <svg
        className="w-full h-full overflow-visible"
        viewBox="0 0 36 100"
        preserveAspectRatio="none"
      >
        <g
          stroke={strokeColor}
          strokeWidth={isActive ? '1.2' : '1'}
          strokeOpacity={isActive ? '0.95' : '0.5'}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 左侧主干 */}
          <line x1="2" y1="50" x2="12" y2="50" />

          {/* 向右分叉上弧线（抱合卡片上部） */}
          <path d="M 12 50 Q 20 50 20 34 L 20 22 Q 20 12 36 12" />

          {/* 向右分叉下弧线（抱合卡片下部） */}
          <path d="M 12 50 Q 20 50 20 66 L 20 78 Q 20 88 36 88" />

          {/* 中间指向卡片主干 */}
          <line x1="12" y1="50" x2="36" y2="50" strokeDasharray={isActive ? 'none' : '2 2'} />
        </g>

        {/* 左侧正文单一锚点微晶圆点 */}
        <circle cx="2" cy="50" r="2.2" fill={strokeColor} opacity={isActive ? '1' : '0.8'} />

        {/* 右侧卡片三处抱合微端点 */}
        <circle cx="35" cy="12" r="1.5" fill={strokeColor} opacity={isActive ? '0.8' : '0.45'} />
        <circle cx="35" cy="50" r="1.5" fill={strokeColor} opacity={isActive ? '0.8' : '0.45'} />
        <circle cx="35" cy="88" r="1.5" fill={strokeColor} opacity={isActive ? '0.8' : '0.45'} />
      </svg>
    </Tag>
  )
}
