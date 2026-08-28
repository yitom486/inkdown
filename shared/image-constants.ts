/** 预览支持的本地图片扩展名 → MIME */
export const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

export const SUPPORTED_IMAGE_EXTENSIONS = Object.keys(IMAGE_MIME_BY_EXTENSION)
