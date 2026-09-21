import React, { useState } from 'react'
import {
  Book,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode2,
  FileText,
  FolderOpen,
  Globe,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface LibraryDrawerProps {
  isOpen: boolean
  onClose: () => void
  recentFiles: string[]
  activeFilePath?: string
  onSelectFile: (path: string) => void
  recentWebUrls?: string[]
  webPageUrl?: string | null
  onOpenWebDoc?: (url: string) => void
  onOpenFile?: () => void
}

export const LibraryDrawer: React.FC<LibraryDrawerProps> = ({
  isOpen,
  onClose,
  recentFiles,
  activeFilePath,
  onSelectFile,
  recentWebUrls = [],
  webPageUrl,
  onOpenWebDoc,
  onOpenFile,
}) => {
  const [search, setSearch] = useState('')
  const [expandedWeb, setExpandedWeb] = useState(true)
  const [expandedLocal, setExpandedLocal] = useState(true)

  if (!isOpen) return null

  const getFileName = (fullPath: string) => {
    const parts = fullPath.split(/[/\\]/)
    return parts[parts.length - 1] || fullPath
  }

  const getFileExt = (name: string) => {
    const parts = name.split('.')
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'DOC'
  }

  const filteredFiles = recentFiles.filter((f) => {
    if (!search.trim()) return true
    return f.toLowerCase().includes(search.toLowerCase())
  })

  const filteredUrls = recentWebUrls.filter((u) => {
    if (!search.trim()) return true
    return u.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div
      className="fixed inset-0 z-50 flex select-none"
      role="dialog"
      aria-modal="true"
      aria-label="馆藏书库与在线规范"
    >
      {/* 背景遮罩 */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* 侧滑抽屉（左侧滑出） */}
      <div
        id="library-shelf-drawer"
        className="relative z-10 w-full sm:w-[400px] h-full flex flex-col shadow-2xl border-r border-border/70 bg-card/95 backdrop-blur-xl text-foreground transition-all duration-300 animate-in slide-in-from-left duration-200"
      >
        {/* 抽屉头部 */}
        <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-primary/10 text-primary">
              <Book className="size-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-foreground">馆藏书卷与在线文档</h3>
              <p className="text-[10px] text-muted-foreground">
                共 {recentFiles.length + recentWebUrls.length} 部研读卷宗
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenFile && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 px-2"
                onClick={() => {
                  onOpenFile()
                  onClose()
                }}
                title="导入本地文件"
              >
                <FolderOpen className="size-3" />
                <span>导入</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg hover:text-foreground"
              onClick={onClose}
              title="关闭书库"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* 检索栏 */}
        <div className="p-3 border-b border-border/60 bg-muted/10">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索书名、规范名称或 URL..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-background text-foreground placeholder:text-muted-foreground border border-border/60 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* 书库条目流 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. 在线文档与规范 */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setExpandedWeb(!expandedWeb)}
              className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground py-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Globe className="size-3.5 text-blue-500" />
                <span>在线规约与技术标准</span>
                <span className="text-[10px] font-mono px-1 rounded bg-muted">
                  {recentWebUrls.length}
                </span>
              </div>
              {expandedWeb ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>

            {expandedWeb && (
              <div className="space-y-1 pl-1">
                {filteredUrls.map((url) => {
                  const isActive = webPageUrl === url
                  return (
                    <div
                      key={url}
                      onClick={() => {
                        onOpenWebDoc?.(url)
                        onClose()
                      }}
                      className={`group p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between gap-2 cursor-pointer ${
                        isActive
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border/60 bg-card/60 hover:bg-card hover:border-border text-foreground'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium truncate block text-[11px]">{url}</span>
                      </div>
                      <ExternalLink className="size-3 text-muted-foreground group-hover:text-primary shrink-0" />
                    </div>
                  )
                })}
                {filteredUrls.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 py-2 italic pl-2">
                    暂无在线文档记录
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 2. 本地馆藏书卷 */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setExpandedLocal(!expandedLocal)}
              className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground py-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-amber-500" />
                <span>本地书卷与专著 (EPUB / PDF / MOBI / MD)</span>
                <span className="text-[10px] font-mono px-1 rounded bg-muted">
                  {recentFiles.length}
                </span>
              </div>
              {expandedLocal ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>

            {expandedLocal && (
              <div className="space-y-1 pl-1">
                {filteredFiles.map((file) => {
                  const name = getFileName(file)
                  const ext = getFileExt(name)
                  const isActive = activeFilePath === file
                  return (
                    <div
                      key={file}
                      onClick={() => {
                        onSelectFile(file)
                        onClose()
                      }}
                      className={`group p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between gap-2 cursor-pointer ${
                        isActive
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border/60 bg-card/60 hover:bg-card hover:border-border text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                          {ext}
                        </span>
                        <span className="font-medium truncate text-[11px]">{name}</span>
                      </div>
                      {isActive && <Check className="size-3.5 text-primary shrink-0" />}
                    </div>
                  )
                })}
                {filteredFiles.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 py-2 italic pl-2">
                    暂无本地书卷记录
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
