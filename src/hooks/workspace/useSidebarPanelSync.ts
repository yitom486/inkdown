import { useEffect } from 'react'
import { usePanelRef } from 'react-resizable-panels'

/** 将布尔可见性与 react-resizable-panels 折叠状态同步（文件侧栏 / Agent 侧栏） */
export function useCollapsiblePanelSync(visible: boolean) {
  const panelRef = usePanelRef()

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    if (visible) {
      if (panel.isCollapsed()) {
        panel.expand()
      }
      return
    }

    if (!panel.isCollapsed()) {
      panel.collapse()
    }
  }, [panelRef, visible])

  return panelRef
}

/** @deprecated 使用 useCollapsiblePanelSync；保留别名以免旧引用断裂 */
export const useSidebarPanelSync = useCollapsiblePanelSync
