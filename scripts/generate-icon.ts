import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const resourcesDir = join(root, 'resources')
const pngPath = join(resourcesDir, 'icon.png')
const icoPath = join(resourcesDir, 'icon.ico')
const faviconPath = join(root, 'src', 'public', 'icon.png')

await mkdir(dirname(faviconPath), { recursive: true })
await mkdir(resourcesDir, { recursive: true })

const png = await readFile(pngPath)
const ico = await pngToIco(png)
await writeFile(icoPath, ico)
await copyFile(pngPath, faviconPath)

console.log(`Created ${icoPath}`)
console.log(`Copied favicon to ${faviconPath}`)
