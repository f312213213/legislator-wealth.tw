import fs from "fs"
import path from "path"
import sharp from "sharp"

const MAX_AVATAR_DIMENSION = 800
const JPEG_QUALITY = 82
const MAX_DEPLOY_FILE_BYTES = 24 * 1024 * 1024

interface DecodedBitmap {
  data: Buffer
  width: number
  height: number
}

function isBmp(buffer: Buffer): boolean {
  return buffer.length > 2 && buffer[0] === 0x42 && buffer[1] === 0x4d
}

function decodeBmp(buffer: Buffer): DecodedBitmap {
  if (!isBmp(buffer)) {
    throw new Error("Not a BMP image")
  }

  const pixelOffset = buffer.readUInt32LE(10)
  const headerSize = buffer.readUInt32LE(14)
  if (headerSize < 40) {
    throw new Error(`Unsupported BMP header size: ${headerSize}`)
  }

  const width = buffer.readInt32LE(18)
  const signedHeight = buffer.readInt32LE(22)
  const planes = buffer.readUInt16LE(26)
  const bitsPerPixel = buffer.readUInt16LE(28)
  const compression = buffer.readUInt32LE(30)

  if (width <= 0 || signedHeight === 0) {
    throw new Error(`Invalid BMP dimensions: ${width}x${signedHeight}`)
  }
  if (planes !== 1 || compression !== 0 || ![24, 32].includes(bitsPerPixel)) {
    throw new Error(
      `Unsupported BMP format: ${bitsPerPixel}bpp compression=${compression}`
    )
  }

  const height = Math.abs(signedHeight)
  const topDown = signedHeight < 0
  const bytesPerPixel = bitsPerPixel / 8
  const rowStride = Math.floor((bitsPerPixel * width + 31) / 32) * 4
  const expectedLength = pixelOffset + rowStride * height
  if (buffer.length < expectedLength) {
    throw new Error("Truncated BMP image")
  }

  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    const sourceY = topDown ? y : height - 1 - y
    const sourceRow = pixelOffset + sourceY * rowStride
    const targetRow = y * width * 3

    for (let x = 0; x < width; x++) {
      const source = sourceRow + x * bytesPerPixel
      const target = targetRow + x * 3
      data[target] = buffer[source + 2]
      data[target + 1] = buffer[source + 1]
      data[target + 2] = buffer[source]
    }
  }

  return { data, width, height }
}

function imagePipeline(buffer: Buffer): sharp.Sharp {
  if (isBmp(buffer)) {
    const bitmap = decodeBmp(buffer)
    return sharp(bitmap.data, {
      raw: {
        width: bitmap.width,
        height: bitmap.height,
        channels: 3,
      },
    })
  }

  return sharp(buffer, { failOn: "none" })
}

async function canUseExistingAvatar(
  buffer: Buffer,
  fileSize: number
): Promise<boolean> {
  if (fileSize > MAX_DEPLOY_FILE_BYTES || isBmp(buffer)) return false

  try {
    const metadata = await sharp(buffer, { failOn: "none" }).metadata()
    return metadata.format === "jpeg"
  } catch {
    return false
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function buildOptimizedAvatar(buffer: Buffer): Promise<Buffer> {
  return imagePipeline(buffer)
    .rotate()
    .resize({
      width: MAX_AVATAR_DIMENSION,
      height: MAX_AVATAR_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}

export async function ensureOptimizedAvatar(dest: string): Promise<boolean> {
  if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
    return false
  }

  const buffer = fs.readFileSync(dest)
  if (await canUseExistingAvatar(buffer, buffer.length)) {
    return true
  }

  try {
    fs.writeFileSync(dest, await buildOptimizedAvatar(buffer))
    return true
  } catch (error) {
    console.warn(
      `  Failed to optimize existing avatar ${path.relative(process.cwd(), dest)}: ${formatError(error)}`
    )
    fs.rmSync(dest, { force: true })
    return false
  }
}

export async function saveOptimizedAvatar(
  buffer: Buffer,
  dest: string,
  sourceUrl: string
): Promise<boolean> {
  try {
    fs.writeFileSync(dest, await buildOptimizedAvatar(buffer))
    return true
  } catch (error) {
    console.warn(`  Failed to optimize ${sourceUrl}: ${formatError(error)}`)
    fs.rmSync(dest, { force: true })
    return false
  }
}
