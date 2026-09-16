import type { NativePagesExtraction, NativePdfClassification } from './native-types'

export interface PdfInspectorPort {
  classifyPdf(data: Uint8Array): Promise<NativePdfClassification>
  extractPages(
    data: Uint8Array,
    pages?: number[] | null,
  ): Promise<NativePagesExtraction>
}
