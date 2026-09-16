import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { AppTheme, EditorViewMode } from '@shared/types/editor'
import { useAppSettingsStore } from '@/stores/app-settings-store'

export type { AppTheme, EditorViewMode }

export interface FileUiState {
  viewMode: EditorViewMode
  editorScrollRatio: number
  previewScrollRatio: number
}

const DEFAULT_FILE_STATE: FileUiState = {
  viewMode: 'editor',
  editorScrollRatio: 0,
  previewScrollRatio: 0,
}

const UNTITLED_KEY = '__untitled__'

function resolveFileKey(filePath?: string): string {
  return filePath ?? UNTITLED_KEY
}

interface EditorUiStore {
  theme: AppTheme
  outlineExpanded: boolean
  sidebarVisible: boolean
  fileStates: Record<string, FileUiState>
  setTheme: (theme: AppTheme) => void
  toggleTheme: () => void
  setOutlineExpanded: (expanded: boolean) => void
  setSidebarVisible: (visible: boolean) => void
  toggleSidebar: () => void
  getFileState: (filePath?: string) => FileUiState
  setViewMode: (filePath: string | undefined, mode: EditorViewMode) => void
  saveScrollState: (
    filePath: string | undefined,
    editorScrollRatio: number,
    previewScrollRatio: number,
  ) => void
}

export const useEditorUiStore = create<EditorUiStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      outlineExpanded: false,
      sidebarVisible: true,
      fileStates: {},

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      setOutlineExpanded: (expanded) => set({ outlineExpanded: expanded }),

      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

      toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

      getFileState: (filePath) => {
        const key = resolveFileKey(filePath)
        const stored = get().fileStates[key]
        if (stored) return stored
        const defaultViewMode = useAppSettingsStore.getState().defaultViewMode
        return { ...DEFAULT_FILE_STATE, viewMode: defaultViewMode }
      },

      setViewMode: (filePath, mode) => {
        const key = resolveFileKey(filePath)
        const prev = get().fileStates[key]
        if (prev?.viewMode === mode) return

        set((state) => ({
          fileStates: {
            ...state.fileStates,
            [key]: {
              ...(state.fileStates[key] ?? DEFAULT_FILE_STATE),
              viewMode: mode,
            },
          },
        }))
      },

      saveScrollState: (filePath, editorScrollRatio, previewScrollRatio) => {
        const key = resolveFileKey(filePath)
        const prev = get().fileStates[key]
        if (
          prev &&
          prev.editorScrollRatio === editorScrollRatio &&
          prev.previewScrollRatio === previewScrollRatio
        ) {
          return
        }

        set((state) => ({
          fileStates: {
            ...state.fileStates,
            [key]: {
              ...(state.fileStates[key] ?? DEFAULT_FILE_STATE),
              editorScrollRatio,
              previewScrollRatio,
            },
          },
        }))
      },
    }),
    {
      name: 'markdown-editor-ui',
      partialize: (state) => ({
        theme: state.theme,
        outlineExpanded: state.outlineExpanded,
        sidebarVisible: state.sidebarVisible,
        fileStates: state.fileStates,
      }),
    },
  ),
)

/** 读取单文件 UI 状态；须用 useShallow，避免 getFileState 每次返回新对象导致无限重渲染 */
export function useFileUiState(filePath?: string): FileUiState {
  const defaultViewMode = useAppSettingsStore((state) => state.defaultViewMode)

  return useEditorUiStore(
    useShallow((state) => {
      const key = resolveFileKey(filePath)
      const stored = state.fileStates[key]
      if (stored) return stored
      return { ...DEFAULT_FILE_STATE, viewMode: defaultViewMode }
    }),
  )
}
