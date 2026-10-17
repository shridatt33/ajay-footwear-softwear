import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function BarcodeDisplay({
  value,
  width = 1.8,
  height = 55,
  fontSize = 13,
  displayValue = true,
  className = '',
}) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || !value) return

    const trimmed = String(value).trim()
    let format = 'CODE128'

    if (/^\d{13}$/.test(trimmed)) {
      const first12 = trimmed.slice(0, 12)
      let sum = 0
      for (let i = 0; i < 12; i++) {
        sum += parseInt(first12[i], 10) * (i % 2 === 0 ? 1 : 3)
      }
      const check = (10 - (sum % 10)) % 10
      if (check === parseInt(trimmed[12], 10)) {
        format = 'EAN13'
      }
    }

    try {
      JsBarcode(svgRef.current, trimmed, {
        format,
        width,
        height,
        displayValue,
        font: 'monospace',
        fontSize,
        textMargin: 4,
        margin: 6,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      try {
        JsBarcode(svgRef.current, trimmed, {
          format: 'CODE128',
          width,
          height,
          displayValue,
          font: 'monospace',
          fontSize,
          textMargin: 4,
          margin: 6,
          background: '#ffffff',
          lineColor: '#000000',
        })
      } catch (err) {
        console.error('Barcode render error:', err)
      }
    }
  }, [value, width, height, fontSize, displayValue])

  if (!value) return null

  return (
    <div className={`barcode-svg-container ${className}`}>
      <svg ref={svgRef} />
    </div>
  )
}
