import type { WebDocTocEntry } from '@shared/types/web-doc'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'
import { resolveAdjacentFlatNav, type AdjacentFlatNavState } from '@/lib/reader/reader-chapter-nav'

const EMPTY_WEB_NAV: AdjacentFlatNavState<ReaderUnit> = {
  current: null,
  previous: null,
  next: null,
  currentIndex: -1,
  previousIndex: -1,
  nextIndex: -1,
  flatIndex: -1,
}

export function normalizeWebDocNavUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function webDocTocEntriesToReaderUnits(entries: WebDocTocEntry[]): ReaderUnit[] {
  return entries.map((entry) => ({
    label: entry.label,
    href: entry.href,
    level: entry.level,
  }))
}

export function findWebDocFlatIndex(units: ReaderUnit[], pageUrl: string): number {
  const target = normalizeWebDocNavUrl(pageUrl)
  return units.findIndex((unit) => normalizeWebDocNavUrl(unit.href) === target)
}

export function syncWebNavigation(
  units: ReaderUnit[],
  pageUrl: string,
  flatIndex?: number,
): AdjacentFlatNavState<ReaderUnit> {
  const index = typeof flatIndex === 'number' ? flatIndex : findWebDocFlatIndex(units, pageUrl)
  if (index < 0) return EMPTY_WEB_NAV
  return resolveAdjacentFlatNav(units, index)
}
