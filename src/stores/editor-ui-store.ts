import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppTheme, EditorViewMode } from '@shared/editor-types'
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
  fileStates: Record<string, FileUiState>
  setTheme: (theme: AppTheme) => void
  toggleTheme: () => void
  setOutlineExpanded: (expanded: boolean) => void
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
      fileStates: {},

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      setOutlineExpanded: (expanded) => set({ outlineExpanded: expanded }),

      getFileState: (filePath) => {
        const key = resolveFileKey(filePath)
        const stored = get().fileStates[key]
        if (stored) return stored
        const defaultViewMode = useAppSettingsStore.getState().defaultViewMode
        return { ...DEFAULT_FILE_STATE, viewMode: defaultViewMode }
      },

      setViewMode: (filePath, mode) => {
        const key = resolveFileKey(filePath)
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
        fileStates: state.fileStates,
      }),
    },
  ),
)
