import MarkdownIt from 'markdown-it'

export const markdownParser = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})
