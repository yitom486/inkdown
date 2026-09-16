import { useCallback, useState } from 'react'

/** 阅读器侧栏：目录与书签/批注面板互斥展开 */
export function useReaderSidePanels() {
  const [tocOpen, setTocOpen] = useState(false)
  const [marksOpen, setMarksOpen] = useState(false)

  const toggleToc = useCallback(() => {
    setMarksOpen(false)
    setTocOpen((value) => !value)
  }, [])

  const toggleMarks = useCallback(() => {
    setTocOpen(false)
    setMarksOpen((value) => !value)
  }, [])

  const closeToc = useCallback(() => setTocOpen(false), [])
  const closeMarks = useCallback(() => setMarksOpen(false), [])

  return {
    tocOpen,
    marksOpen,
    toggleToc,
    toggleMarks,
    closeToc,
    closeMarks,
  }
}
