/**
 * This function was adapted from the one in the react-easy-crop's documentation
 * https://github.com/valentinhuber/react-easy-crop
 */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
    image.src = url
  })

export default async function getCroppedImg(
  imageSrc,
  pixelCrop,
  flip = { horizontal: false, vertical: false }
) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // set canvas size to the cropped size
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // translate canvas context to a point where the crop happens
  ctx.translate(-pixelCrop.x, -pixelCrop.y)

  // draw the image
  ctx.drawImage(image, 0, 0)

  // As Base64 string
  // return canvas.toDataURL('image/jpeg');

  // As a blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob))
    }, 'image/jpeg')
  })
}
