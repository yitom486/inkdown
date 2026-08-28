import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EditorViewMode } from '@shared/editor-types'

export type AutoSaveIntervalMs = 15000 | 30000 | 60000
export type PreviewDebounceMs = 150 | 300 | 500

export const AUTO_SAVE_INTERVAL_OPTIONS: Array<{ value: AutoSaveIntervalMs; label: string }> = [
  { value: 15000, label: '15 秒' },
  { value: 30000, label: '30 秒' },
  { value: 60000, label: '60 秒' },
]

export const PREVIEW_DEBOUNCE_OPTIONS: Array<{ value: PreviewDebounceMs; label: string }> = [
  { value: 150, label: '150 ms' },
  { value: 300, label: '300 ms' },
  { value: 500, label: '500 ms' },
]

export const DEFAULT_VIEW_MODE_OPTIONS: Array<{ value: EditorViewMode; label: string }> = [
  { value: 'editor', label: '编辑' },
  { value: 'split', label: '分屏' },
  { value: 'preview', label: '预览' },
]

export const RECENT_FILES_LIMIT_OPTIONS = [5, 10, 20] as const
export type RecentFilesLimit = (typeof RECENT_FILES_LIMIT_OPTIONS)[number]

export interface AppSettingsState {
  autoSaveEnabled: boolean
  autoSaveIntervalMs: AutoSaveIntervalMs
  maxRecentFiles: RecentFilesLimit
  recentFiles: string[]
  defaultViewMode: EditorViewMode
  previewDebounceMs: PreviewDebounceMs
  restoreLastFileOnStartup: boolean
  lastOpenedFilePath?: string
}

interface AppSettingsStore extends AppSettingsState {
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveIntervalMs: (intervalMs: AutoSaveIntervalMs) => void
  setMaxRecentFiles: (limit: RecentFilesLimit) => void
  setDefaultViewMode: (mode: EditorViewMode) => void
  setPreviewDebounceMs: (ms: PreviewDebounceMs) => void
  setRestoreLastFileOnStartup: (enabled: boolean) => void
  setLastOpenedFilePath: (filePath?: string) => void
  addRecentFile: (filePath: string) => void
  removeRecentFile: (filePath: string) => void
  clearRecentFiles: () => void
}

function trimRecentFiles(files: string[], limit: number): string[] {
  return files.slice(0, Math.max(1, limit))
}

export const useAppSettingsStore = create<AppSettingsStore>()(
  persist(
    (set) => ({
      autoSaveEnabled: false,
      autoSaveIntervalMs: 30000,
      maxRecentFiles: 10,
      recentFiles: [],
      defaultViewMode: 'split',
      previewDebounceMs: 300,
      restoreLastFileOnStartup: false,
      lastOpenedFilePath: undefined,

      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),

      setAutoSaveIntervalMs: (intervalMs) => set({ autoSaveIntervalMs: intervalMs }),

      setDefaultViewMode: (mode) => set({ defaultViewMode: mode }),

      setPreviewDebounceMs: (ms) => set({ previewDebounceMs: ms }),

      setRestoreLastFileOnStartup: (enabled) => set({ restoreLastFileOnStartup: enabled }),

      setLastOpenedFilePath: (filePath) => set({ lastOpenedFilePath: filePath }),

      setMaxRecentFiles: (limit) =>
        set((state) => ({
          maxRecentFiles: limit,
          recentFiles: trimRecentFiles(state.recentFiles, limit),
        })),

      addRecentFile: (filePath) =>
        set((state) => {
          const normalized = filePath.trim()
          if (!normalized) return state

          const next = [normalized, ...state.recentFiles.filter((item) => item !== normalized)]
          return {
            recentFiles: trimRecentFiles(next, state.maxRecentFiles),
          }
        }),

      removeRecentFile: (filePath) =>
        set((state) => ({
          recentFiles: state.recentFiles.filter((item) => item !== filePath),
        })),

      clearRecentFiles: () => set({ recentFiles: [] }),
    }),
    {
      name: 'markdown-editor-settings',
      partialize: (state) => ({
        autoSaveEnabled: state.autoSaveEnabled,
        autoSaveIntervalMs: state.autoSaveIntervalMs,
        maxRecentFiles: state.maxRecentFiles,
        recentFiles: state.recentFiles,
        defaultViewMode: state.defaultViewMode,
        previewDebounceMs: state.previewDebounceMs,
        restoreLastFileOnStartup: state.restoreLastFileOnStartup,
        lastOpenedFilePath: state.lastOpenedFilePath,
      }),
    },
  ),
)
