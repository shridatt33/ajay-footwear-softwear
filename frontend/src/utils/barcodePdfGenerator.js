import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'

/**
 * Generates and downloads a multi-label PDF where every page matches
 * the exact physical sticker dimensions (e.g. 2.00 x 1.00 inches).
 */
export function generateBarcodeStickersPdf(product, copies = 1, formatConfig = {}) {
  if (!product) return

  const labelWidthIn = formatConfig.labelWidthIn || 2.00
  const labelHeightIn = formatConfig.labelHeightIn || 1.00

  // Render barcode to an in-memory HTML5 Canvas to insert into jsPDF
  const canvas = document.createElement('canvas')
  const trimmed = String(product.barcode || '').trim()

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
    JsBarcode(canvas, trimmed, {
      format,
      width: 2,
      height: 48,
      displayValue: true,
      font: 'monospace',
      fontSize: 13,
      textMargin: 2,
      margin: 1,
      background: '#ffffff',
      lineColor: '#000000',
    })
  } catch {
    JsBarcode(canvas, trimmed, {
      format: 'CODE128',
      width: 2,
      height: 48,
      displayValue: true,
      font: 'monospace',
      fontSize: 13,
      textMargin: 2,
      margin: 1,
      background: '#ffffff',
      lineColor: '#000000',
    })
  }

  const barcodeImg = canvas.toDataURL('image/png')

  // PDF page dimensions matching the physical label
  const doc = new jsPDF({
    orientation: labelWidthIn >= labelHeightIn ? 'landscape' : 'portrait',
    unit: 'in',
    format: [labelWidthIn, labelHeightIn],
  })

  const count = Math.max(1, parseInt(copies, 10) || 1)

  for (let i = 0; i < count; i++) {
    if (i > 0) {
      doc.addPage([labelWidthIn, labelHeightIn], labelWidthIn >= labelHeightIn ? 'landscape' : 'portrait')
    }

    // 1. Product Name (Readable, bold, centered at top, shop name removed)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(0, 0, 0)
    const prodName = String(product.product_name || 'Footwear Item')
    doc.text(prodName, labelWidthIn / 2, 0.15, { align: 'center', maxWidth: labelWidthIn - 0.15 })

    // 2. Product SKU or Code (Centered above barcode)
    doc.setFont('courier', 'bold')
    doc.setFontSize(7.5)
    const code = String(product.product_code || product.sku || '')
    if (code) {
      doc.text(code, labelWidthIn / 2, 0.27, { align: 'center' })
    }

    // 3. Barcode with readable number
    const barcodeWidthIn = Math.min(1.68, labelWidthIn - 0.20)
    const barcodeHeightIn = 0.44
    const barcodeX = (labelWidthIn - barcodeWidthIn) / 2
    const barcodeY = code ? 0.31 : 0.24
    doc.addImage(barcodeImg, 'PNG', barcodeX, barcodeY, barcodeWidthIn, barcodeHeightIn)

    // 4. MRP value comes from Purchase / Cost Price
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const mrpVal = Number(product.purchase_price ?? product.cost_price ?? 0)
    const priceText = `MRP: ₹${mrpVal.toFixed(2)}`
    doc.text(priceText, labelWidthIn / 2, labelHeightIn - 0.08, { align: 'center' })
  }

  const safeName = (product.product_code || product.product_name || 'barcode').replace(/[^a-zA-Z0-9_-]/g, '_')
  doc.save(`${safeName}_2x1_stickers.pdf`)
}
