import type { Config } from 'dompurify'

/** Markdown 预览消毒：必须保留 class，否则 pre.mermaid / code-block 会失效 */
export const PREVIEW_SANITIZE_OPTIONS: Config = {
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ['input'],
  ADD_ATTR: [
    'type',
    'checked',
    'disabled',
    'class',
    'id',
    'aria-hidden',
    'aria-label',
    'title',
  ],
}
