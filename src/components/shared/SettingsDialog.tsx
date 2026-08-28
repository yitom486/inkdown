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
  RECENT_FILES_LIMIT_OPTIONS,
  useAppSettingsStore,
  type AutoSaveIntervalMs,
  type RecentFilesLimit,
} from '@/stores/app-settings-store'
import { useEditorUiStore, type AppTheme } from '@/stores/editor-ui-store'
import { cn } from '@/lib/utils'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
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
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
