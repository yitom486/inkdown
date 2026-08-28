import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EditorViewMode = 'editor' | 'preview' | 'split'
export type AppTheme = 'dark' | 'light'

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
        return get().fileStates[key] ?? DEFAULT_FILE_STATE
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
