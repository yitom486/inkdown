export interface InspectorPageMarkdown {
  /** 1-indexed */
  page: number
  markdown: string
}

export interface InspectorPagesMarkdown {
  pages: InspectorPageMarkdown[]
  /** 1-indexed */
  pagesWithTables: number[]
  /** 1-indexed */
  pagesWithColumns: number[]
  /** 1-indexed */
  pagesNeedingOcr: number[]
  isComplex: boolean
}
