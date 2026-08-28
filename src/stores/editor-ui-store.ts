import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EditorViewMode = 'editor' | 'preview' | 'split'

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
  outlineExpanded: boolean
  fileStates: Record<string, FileUiState>
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
      outlineExpanded: false,
      fileStates: {},

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
        outlineExpanded: state.outlineExpanded,
        fileStates: state.fileStates,
      }),
    },
  ),
)
