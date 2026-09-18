import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const resourcesDir = join(root, 'apps/desktop', 'resources')
const pngPath = join(resourcesDir, 'icon.png')
const icoPath = join(resourcesDir, 'icon.ico')
const faviconPath = join(root, 'apps/desktop', 'src', 'public', 'icon.png')

function roundedRectPath(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/**
 * 跨平台绘制应用图标（此前为 Windows 专属 generate-icon.ps1）。
 * 图形由打开的书页与一枚橙色墨迹构成，表达阅读、理解与知识沉淀。
 */
async function drawIconPng(): Promise<Buffer> {
  const size = 512
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, size, size)

  roundedRectPath(ctx, 28, 28, 456, 456, 112)
  const background = ctx.createLinearGradient(70, 44, 442, 468)
  background.addColorStop(0, '#18294f')
  background.addColorStop(1, '#0c1732')
  ctx.fillStyle = background
  ctx.fill()

  // The rear cover gives the book a little separation from the dark tile.
  ctx.fillStyle = '#465574'
  ctx.globalAlpha = 0.7
  roundedRectPath(ctx, 74, 164, 160, 228, 34)
  ctx.fill()
  roundedRectPath(ctx, 278, 164, 160, 228, 34)
  ctx.fill()
  ctx.globalAlpha = 1

  const page = ctx.createLinearGradient(128, 130, 384, 410)
  page.addColorStop(0, '#fffdf5')
  page.addColorStop(1, '#f3ead8')
  ctx.fillStyle = page

  ctx.beginPath()
  ctx.moveTo(104, 148)
  ctx.bezierCurveTo(160, 124, 213, 142, 256, 194)
  ctx.lineTo(256, 397)
  ctx.bezierCurveTo(211, 360, 159, 345, 104, 359)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(408, 148)
  ctx.bezierCurveTo(352, 124, 299, 142, 256, 194)
  ctx.lineTo(256, 397)
  ctx.bezierCurveTo(301, 360, 353, 345, 408, 359)
  ctx.closePath()
  ctx.fill()

  // A single warm ink mark becomes the visual memory hook at small sizes.
  const ink = ctx.createLinearGradient(256, 132, 256, 222)
  ink.addColorStop(0, '#ff9a68')
  ink.addColorStop(1, '#f36b4b')
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.moveTo(256, 132)
  ctx.bezierCurveTo(232, 160, 218, 179, 229, 199)
  ctx.bezierCurveTo(235, 210, 246, 219, 256, 229)
  ctx.bezierCurveTo(266, 219, 277, 210, 283, 199)
  ctx.bezierCurveTo(294, 179, 280, 160, 256, 132)
  ctx.closePath()
  ctx.fill()

  // Keep the seam crisp without introducing a thin detail that disappears too early.
  ctx.strokeStyle = '#d5c8b3'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(256, 196)
  ctx.lineTo(256, 395)
  ctx.stroke()

  return Buffer.from(await canvas.encode('png'))
}

await mkdir(dirname(faviconPath), { recursive: true })
await mkdir(resourcesDir, { recursive: true })

const png = await drawIconPng()
await writeFile(pngPath, png)
console.log(`Created ${pngPath}`)

const ico = await pngToIco(png)
await writeFile(icoPath, ico)
console.log(`Created ${icoPath}`)

await copyFile(pngPath, faviconPath)
console.log(`Copied favicon to ${faviconPath}`)
