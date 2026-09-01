import type { WebDocSiteId } from '@shared/types/web-doc'
import { isPeopleDailyPaperHost } from '@shared/web-doc/people-daily'

export function resolveWebDocSiteId(url: URL): WebDocSiteId {
  const host = url.hostname.toLowerCase()
  if (host === 'react.dev' || host.endsWith('.react.dev')) {
    return 'react-dev'
  }
  if (isPeopleDailyPaperHost(host)) {
    return 'people-daily-paper'
  }
  return 'generic-ssr'
}
