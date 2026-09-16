import { create } from 'zustand'

interface ActiveDocumentStore {
  /** 当前主区打开的文件绝对路径；未打开为 null */
  filePath: string | null
  setActiveFilePath: (filePath: string | null) => void
}

/**
 * 主区当前打开的文件。供 Agent 上下文等跨层模块读取，
 * 避免把 filePath 一路透传到 Agent 面板深处。
 */
export const useActiveDocumentStore = create<ActiveDocumentStore>((set, get) => ({
  filePath: null,
  setActiveFilePath: (filePath) => {
    if (get().filePath === filePath) return
    set({ filePath })
  },
}))
