import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const resourcesDir = join(root, 'resources')
const pngPath = join(resourcesDir, 'icon.png')
const icoPath = join(resourcesDir, 'icon.ico')
const faviconPath = join(root, 'src', 'public', 'icon.png')

/**
 * 跨平台绘制应用图标（此前为 Windows 专属 generate-icon.ps1）。
 * 蓝色圆底 + 白色粗体 M，与旧版 System.Drawing 产出保持同构（512px 透明底）。
 */
async function drawIconPng(): Promise<Buffer> {
  const size = 512
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#3b82f6'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, 200, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 220px "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('M', size / 2, size / 2 + 24)

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
