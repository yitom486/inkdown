declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  interface TaskListOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  export default function markdownItTaskLists(md: MarkdownIt, options?: TaskListOptions): void
}
