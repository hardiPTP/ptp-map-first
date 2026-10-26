// Pin photos (DECISIONS.md 2026-10-23). The phone shrinks the picture before it is posted: longest side 800 px, JPEG.
// Re-drawing it on a canvas also drops the file's metadata (EXIF, including where it was taken).
import { PHOTO_MAX_CHARS, PHOTO_PREFIX } from '../types'

/** A posted photo must be a JPEG data URL within the size limit (both repos and the rules check this). */
export function validPhoto(dataUrl: string): boolean {
  return dataUrl.startsWith(PHOTO_PREFIX) && dataUrl.length <= PHOTO_MAX_CHARS
}

/** Width and height that fit inside `max` on the longest side, never upscaled. */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // fall through to <img> (some browsers cannot bitmap every format)
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Shrinks a picked photo to a JPEG data URL under PHOTO_MAX_CHARS (800 px, then 640 px at lower quality). */
export async function shrinkPhoto(file: File): Promise<string> {
  const src = await decode(file)
  for (const [max, q] of [[800, 0.72], [640, 0.6], [480, 0.55]] as const) {
    const { w, h } = fitSize(src.width, src.height, max)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('cannot draw the photo')
    ctx.drawImage(src, 0, 0, w, h)
    const url = canvas.toDataURL('image/jpeg', q)
    if (validPhoto(url)) return url
  }
  throw new Error('the photo is too large')
}
