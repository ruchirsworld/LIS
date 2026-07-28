// One-time asset generation: pads the leaf-mark logo into square PWA icons.
// Run with: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const source = join(root, 'src/assets/laavin-mark.png')
const outDir = join(root, 'public')

mkdirSync(outDir, { recursive: true })

async function squareIcon(size, markScale, background, outPath) {
  const markSize = Math.round(size * markScale)
  const mark = await sharp(source).resize(markSize, markSize, { fit: 'contain', background }).toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(outPath)

  console.log('wrote', outPath)
}

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

await squareIcon(192, 0.72, WHITE, join(outDir, 'icon-192.png'))
await squareIcon(512, 0.72, WHITE, join(outDir, 'icon-512.png'))
// Maskable icons need extra padding so the OS's mask crop doesn't clip the mark.
await squareIcon(512, 0.5, WHITE, join(outDir, 'icon-maskable-512.png'))
await squareIcon(180, 0.72, WHITE, join(outDir, 'apple-touch-icon.png'))

console.log('done')
