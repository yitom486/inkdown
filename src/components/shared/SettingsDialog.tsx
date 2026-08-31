import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  AUTO_SAVE_INTERVAL_OPTIONS,
  DEFAULT_VIEW_MODE_OPTIONS,
  EDITOR_FONT_SIZE_OPTION_LABELS,
  PREVIEW_DEBOUNCE_OPTIONS,
  READER_FONT_SIZE_OPTION_LABELS,
  READER_LINE_HEIGHT_OPTION_LABELS,
  RECENT_FILES_LIMIT_OPTIONS,
  TAB_SIZE_OPTION_LABELS,
  useAppSettingsStore,
  type AutoSaveIntervalMs,
  type EditorFontSize,
  type EditorTabSize,
  type PreviewDebounceMs,
  type RecentFilesLimit,
  type ReaderFontSize,
  type ReaderLineHeight,
} from '@/stores/app-settings-store'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import type { AppTheme } from '@shared/types/editor'
import type { EditorViewMode } from '@shared/types/editor'
import { cn } from '@/lib/utils'
import { appApi } from '@/api/app-api'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenErrorLog: () => void
  onOpenAbout: () => void
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 transform rounded-full bg-background transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

function OptionButtons<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {options.map((option) => (
        <Button
          key={String(option.value)}
          type="button"
          size="xs"
          variant={value === option.value ? 'default' : 'outline'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

export function SettingsDialog({ open, onOpenChange, onOpenErrorLog, onOpenAbout }: SettingsDialogProps) {
  const theme = useEditorUiStore((state) => state.theme)
  const setTheme = useEditorUiStore((state) => state.setTheme)

  const autoSaveEnabled = useAppSettingsStore((state) => state.autoSaveEnabled)
  const autoSaveIntervalMs = useAppSettingsStore((state) => state.autoSaveIntervalMs)
  const maxRecentFiles = useAppSettingsStore((state) => state.maxRecentFiles)
  const recentFiles = useAppSettingsStore((state) => state.recentFiles)
  const setAutoSaveEnabled = useAppSettingsStore((state) => state.setAutoSaveEnabled)
  const setAutoSaveIntervalMs = useAppSettingsStore((state) => state.setAutoSaveIntervalMs)
  const setMaxRecentFiles = useAppSettingsStore((state) => state.setMaxRecentFiles)
  const clearRecentFiles = useAppSettingsStore((state) => state.clearRecentFiles)
  const defaultViewMode = useAppSettingsStore((state) => state.defaultViewMode)
  const previewDebounceMs = useAppSettingsStore((state) => state.previewDebounceMs)
  const restoreLastFileOnStartup = useAppSettingsStore((state) => state.restoreLastFileOnStartup)
  const setDefaultViewMode = useAppSettingsStore((state) => state.setDefaultViewMode)
  const setPreviewDebounceMs = useAppSettingsStore((state) => state.setPreviewDebounceMs)
  const setRestoreLastFileOnStartup = useAppSettingsStore((state) => state.setRestoreLastFileOnStartup)
  const tabSize = useAppSettingsStore((state) => state.tabSize)
  const editorFontSize = useAppSettingsStore((state) => state.editorFontSize)
  const setTabSize = useAppSettingsStore((state) => state.setTabSize)
  const setEditorFontSize = useAppSettingsStore((state) => state.setEditorFontSize)
  const readerFontSize = useAppSettingsStore((state) => state.readerFontSize)
  const readerLineHeight = useAppSettingsStore((state) => state.readerLineHeight)
  const setReaderFontSize = useAppSettingsStore((state) => state.setReaderFontSize)
  const setReaderLineHeight = useAppSettingsStore((state) => state.setReaderLineHeight)
  const verboseRendererLogs = useAppSettingsStore((state) => state.verboseRendererLogs)
  const setVerboseRendererLogs = useAppSettingsStore((state) => state.setVerboseRendererLogs)

  const themeOptions: Array<{ value: AppTheme; label: string }> = [
    { value: 'dark', label: '深色' },
    { value: 'light', label: '浅色' },
  ]

  const recentLimitOptions = RECENT_FILES_LIMIT_OPTIONS.map((value) => ({
    value,
    label: String(value),
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>编辑器偏好与应用行为，修改后自动保存到本地。</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto pr-1">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">编辑器</h3>
            <SettingRow
              title="自动保存"
              description="仅对已保存到磁盘的文件生效；未命名文档需先另存为。"
            >
              <ToggleSwitch
                checked={autoSaveEnabled}
                onChange={setAutoSaveEnabled}
                label="自动保存"
              />
            </SettingRow>
            <SettingRow title="自动保存间隔" description={autoSaveEnabled ? '按设定间隔写入文件' : '启用自动保存后可配置'}>
              <OptionButtons<AutoSaveIntervalMs>
                value={autoSaveIntervalMs}
                options={AUTO_SAVE_INTERVAL_OPTIONS}
                onChange={setAutoSaveIntervalMs}
              />
            </SettingRow>
            <SettingRow title="默认视图模式" description="无历史记录的新文档或文件首次打开时使用。">
              <OptionButtons<EditorViewMode>
                value={defaultViewMode}
                options={DEFAULT_VIEW_MODE_OPTIONS}
                onChange={setDefaultViewMode}
              />
            </SettingRow>
            <SettingRow title="预览刷新延迟" description="停止输入后更新预览的等待时间。">
              <OptionButtons<PreviewDebounceMs>
                value={previewDebounceMs}
                options={PREVIEW_DEBOUNCE_OPTIONS}
                onChange={setPreviewDebounceMs}
              />
            </SettingRow>
            <SettingRow title="Tab 宽度" description="影响缩进显示与 Tab 键插入的空格数。">
              <OptionButtons<EditorTabSize>
                value={tabSize}
                options={TAB_SIZE_OPTION_LABELS}
                onChange={setTabSize}
              />
            </SettingRow>
            <SettingRow title="编辑器字号" description="仅作用于 CodeMirror 编辑区。">
              <OptionButtons<EditorFontSize>
                value={editorFontSize}
                options={EDITOR_FONT_SIZE_OPTION_LABELS}
                onChange={setEditorFontSize}
              />
            </SettingRow>
          </section>

          <Separator className="my-2" />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">阅读</h3>
            <SettingRow title="电子书字号" description="作用于 EPUB、MOBI、AZW3 和 AZW 正文；顶部工具栏也可快速调整。">
              <OptionButtons<ReaderFontSize>
                value={readerFontSize}
                options={READER_FONT_SIZE_OPTION_LABELS}
                onChange={setReaderFontSize}
              />
            </SettingRow>
            <SettingRow title="电子书行距" description="作用于 EPUB、MOBI、AZW3 和 AZW 正文。">
              <OptionButtons<ReaderLineHeight>
                value={readerLineHeight}
                options={READER_LINE_HEIGHT_OPTION_LABELS}
                onChange={setReaderLineHeight}
              />
            </SettingRow>
          </section>

          <Separator className="my-2" />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">外观</h3>
            <SettingRow title="主题" description="同步编辑器、预览与界面配色。">
              <OptionButtons<AppTheme>
                value={theme}
                options={themeOptions}
                onChange={setTheme}
              />
            </SettingRow>
          </section>

          <Separator className="my-2" />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">文件</h3>
            <SettingRow title="最近文件数量" description={`当前已记录 ${recentFiles.length} 个路径`}>
              <OptionButtons<RecentFilesLimit>
                value={maxRecentFiles}
                options={recentLimitOptions}
                onChange={setMaxRecentFiles}
              />
            </SettingRow>
            <SettingRow title="清除最近记录" description="不影响磁盘上的实际文件。">
              <Button type="button" size="xs" variant="outline" onClick={clearRecentFiles}>
                清除
              </Button>
            </SettingRow>
            <SettingRow title="启动时恢复上次文件" description="无崩溃草稿时，自动打开上次编辑的文档。">
              <ToggleSwitch
                checked={restoreLastFileOnStartup}
                onChange={setRestoreLastFileOnStartup}
                label="启动时恢复上次文件"
              />
            </SettingRow>
          </section>

          <Separator className="my-2" />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">应用</h3>
            <SettingRow title="检查更新" description="从 GitHub Release 获取新版本（打包版支持一键安装）。">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onOpenAbout()
                }}
              >
                关于
              </Button>
            </SettingRow>
          </section>

          <Separator className="my-2" />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">调试</h3>
            <SettingRow
              title="详细控制台日志"
              description="将渲染进程 Console 转发到启动应用的终端（用于排查黑屏）。"
            >
              <ToggleSwitch
                checked={verboseRendererLogs}
                onChange={setVerboseRendererLogs}
                label="详细控制台日志"
              />
            </SettingRow>
            <SettingRow title="开发者工具" description="快捷键 Ctrl+Shift+I。">
              <Button type="button" size="xs" variant="outline" onClick={() => appApi.toggleDevTools()}>
                打开
              </Button>
            </SettingRow>
            <SettingRow title="错误日志" description="查看本会话错误与磁盘日志路径。">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onOpenErrorLog()
                }}
              >
                查看
              </Button>
            </SettingRow>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
