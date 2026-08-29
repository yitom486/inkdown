import {
  IMAGE_EXTENSION_BY_MIME,
  IMAGE_MIME_BY_EXTENSION,
} from '@shared/constants/images'
import type { AcpContentBlock, AcpPromptCapabilities } from '@shared/types/acp'

/** 单张图片上限（发送前） */
export const ACP_MAX_IMAGE_BYTES = 8 * 1024 * 1024

export type ComposerAttachmentKind = 'file' | 'image'

/** 输入区 chip；不把 base64 写入持久化历史 */
export interface ComposerAttachment {
  id: string
  kind: ComposerAttachmentKind
  name: string
  mimeType: string
  /** 工作区绝对路径（resource_link / 无 image 能力时） */
  absolutePath?: string
  size?: number
  /** 仅内存预览（blob: URL），发送后 revoke */
  previewUrl?: string
  /** 有 image 能力时用于 ContentBlock.image；不入 persist */
  base64?: string
}

/** 用户气泡里展示的附件摘要（可持久化） */
export interface AcpMessageAttachment {
  id: string
  kind: ComposerAttachmentKind
  name: string
  mimeType: string
  absolutePath?: string
  size?: number
  /** 历史回看用；过大时可无 */
  previewUrl?: string
}

export function normalizePathForCompare(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function isPathInsideWorkspace(filePath: string, workspaceRoot: string): boolean {
  const root = normalizePathForCompare(workspaceRoot)
  const file = normalizePathForCompare(filePath)
  if (!root || !file) return false
  return file === root || file.startsWith(`${root}/`)
}

export function toFileUri(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`
  }
  if (normalized.startsWith('/')) {
    return `file://${normalized}`
  }
  return `file:///${normalized}`
}

export function mimeFromFileName(fileName: string): string {
  const ext = fileName.includes('.')
    ? `.${fileName.split('.').pop()!.toLowerCase()}`
    : ''
  if (IMAGE_MIME_BY_EXTENSION[ext]) return IMAGE_MIME_BY_EXTENSION[ext]!
  if (ext === '.md' || ext === '.markdown') return 'text/markdown'
  if (ext === '.json') return 'application/json'
  if (ext === '.ts' || ext === '.tsx') return 'text/typescript'
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
    return 'text/javascript'
  }
  if (ext === '.css') return 'text/css'
  if (ext === '.html' || ext === '.htm') return 'text/html'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.txt' || ext === '.log') return 'text/plain'
  return 'application/octet-stream'
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/') && Boolean(IMAGE_EXTENSION_BY_MIME[mimeType])
}

export function newAttachmentId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function attachmentToMessageMeta(att: ComposerAttachment): AcpMessageAttachment {
  return {
    id: att.id,
    kind: att.kind,
    name: att.name,
    mimeType: att.mimeType,
    absolutePath: att.absolutePath,
    size: att.size,
    previewUrl: att.kind === 'image' ? att.previewUrl : undefined,
  }
}

/**
 * 组装 session/prompt ContentBlock[]。
 * 图片：有 image 能力且带 base64 → image；否则必须有 absolutePath → resource_link。
 */
export function buildAcpPromptBlocks(options: {
  text: string
  attachments: ComposerAttachment[]
  promptCapabilities?: AcpPromptCapabilities
}): AcpContentBlock[] {
  const blocks: AcpContentBlock[] = []
  const trimmed = options.text.trim()
  if (trimmed) {
    blocks.push({ type: 'text', text: trimmed })
  }

  const canImage = options.promptCapabilities?.image === true

  for (const att of options.attachments) {
    if (att.kind === 'image' && canImage && att.base64) {
      blocks.push({
        type: 'image',
        data: att.base64,
        mimeType: att.mimeType,
        ...(att.absolutePath ? { uri: toFileUri(att.absolutePath) } : {}),
      })
      continue
    }

    if (!att.absolutePath) {
      continue
    }

    blocks.push({
      type: 'resource_link',
      uri: toFileUri(att.absolutePath),
      name: att.name,
      mimeType: att.mimeType,
      ...(typeof att.size === 'number' ? { size: att.size } : {}),
    })
  }

  return blocks
}

export function canSendComposer(text: string, attachments: ComposerAttachment[]): boolean {
  return text.trim().length > 0 || attachments.length > 0
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
