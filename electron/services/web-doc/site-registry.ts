import type { WebDocSiteId } from '@shared/types/web-doc'

export function resolveWebDocSiteId(url: URL): WebDocSiteId {
  const host = url.hostname.toLowerCase()
  if (host === 'react.dev' || host.endsWith('.react.dev')) {
    return 'react-dev'
  }
  return 'generic-ssr'
}
