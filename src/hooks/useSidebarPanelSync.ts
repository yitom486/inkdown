import { useEffect } from 'react'
import { usePanelRef } from 'react-resizable-panels'

/** 将 Zustand 中的侧栏可见性与 react-resizable-panels 折叠状态同步 */
export function useSidebarPanelSync(visible: boolean) {
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
