const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const EXPORT_SCALE = 2

const inheritedCustomProperties = [
  '--surface',
  '--ink',
  '--ink-soft',
  '--muted',
  '--hairline',
  '--accent',
  '--font-sans',
  '--font-mono',
]

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The chart image could not be created.'))
    image.src = source
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('The PNG file could not be created.'))
      }
    }, 'image/png')
  })
}

export async function downloadChartAsPng(svg: SVGSVGElement, fileName: string): Promise<void> {
  await document.fonts.ready

  const { width, height } = svg.getBoundingClientRect()
  if (width <= 0 || height <= 0) {
    throw new Error('The chart has no visible dimensions to export.')
  }

  const clone = svg.cloneNode(true) as SVGSVGElement
  const computedStyle = window.getComputedStyle(svg)
  clone.setAttribute('xmlns', SVG_NAMESPACE)
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  for (const property of inheritedCustomProperties) {
    clone.style.setProperty(property, computedStyle.getPropertyValue(property))
  }

  const serializedSvg = new XMLSerializer().serializeToString(clone)
  const svgUrl = URL.createObjectURL(new Blob([serializedSvg], { type: 'image/svg+xml' }))

  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * EXPORT_SCALE)
    canvas.height = Math.ceil(height * EXPORT_SCALE)

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('PNG export is not supported by this browser.')
    }

    context.scale(EXPORT_SCALE, EXPORT_SCALE)
    context.fillStyle = computedStyle.getPropertyValue('--surface').trim() || '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    const pngUrl = URL.createObjectURL(await canvasToBlob(canvas))
    const download = document.createElement('a')
    download.href = pngUrl
    download.download = fileName
    download.style.display = 'none'
    document.body.append(download)
    download.click()
    download.remove()
    URL.revokeObjectURL(pngUrl)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
