import type { Area } from 'react-easy-crop'

type CropImageOptions = {
  imageUrl: string
  crop: Area
  outputSize: number
  mimeType?: string
  quality?: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = src
  })
}

export async function cropImageToBlob({
  imageUrl,
  crop,
  outputSize,
  mimeType = 'image/jpeg',
  quality = 0.9,
}: CropImageOptions): Promise<Blob> {
  const image = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('当前浏览器不支持图片裁剪')

  canvas.width = outputSize
  canvas.height = outputSize
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('图片裁剪失败'))
      },
      mimeType,
      quality,
    )
  })
}
