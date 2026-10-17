import { jsPDF } from 'jspdf'
import { SHOP_INFO } from '../config'

export function generateInvoicePDFData(bill) {
  if (!bill) return null

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 16

  // Shop Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(30, 41, 59)
  doc.text(SHOP_INFO.name, pageWidth / 2, y, { align: 'center' })

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(SHOP_INFO.tagline, pageWidth / 2, y, { align: 'center' })

  y += 5
  doc.setFontSize(9)
  doc.text(SHOP_INFO.address, pageWidth / 2, y, { align: 'center' })

  y += 5
  doc.text(`Mobile: ${SHOP_INFO.phone}  |  GSTIN: ${SHOP_INFO.gst}`, pageWidth / 2, y, { align: 'center' })

  // Divider
  y += 4
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.5)
  doc.line(14, y, pageWidth - 14, y)

  // Invoice Title
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(37, 99, 235)
  doc.text('RETAIL TAX INVOICE', 14, y)

  // Bill Metadata Grid
  y += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('Invoice No:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(String(bill.bill_no || 'PROVISIONAL'), 38, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('Customer:', 115, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(String(bill.customer_name || 'Walk-in Customer'), 135, y)

  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('Date & Time:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  const dateStr = bill.created_at
    ? new Date(bill.created_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
  doc.text(dateStr, 38, y)

  if (bill.customer_phone && bill.customer_phone !== '—') {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text('Phone:', 115, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    doc.text(String(bill.customer_phone), 135, y)
  }

  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('Payment:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(String(bill.payment_mode || 'Cash'), 38, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('Status:', 115, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 163, 74)
  doc.text(String(bill.status || 'PAID'), 135, y)

  if (bill.billing_address) {
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text('Address:', 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    doc.text(String(bill.billing_address).slice(0, 75), 38, y)
  }

  // Function to render table header
  const renderTableHeader = (currentY) => {
    doc.setFillColor(241, 245, 249)
    doc.rect(14, currentY, pageWidth - 28, 7, 'F')
    doc.setDrawColor(203, 213, 225)
    doc.rect(14, currentY, pageWidth - 28, 7, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(51, 65, 85)
    doc.text('#', 17, currentY + 5)
    doc.text('Item Description', 25, currentY + 5)
    doc.text('SKU / Code', 90, currentY + 5)
    doc.text('Size', 125, currentY + 5)
    doc.text('Qty', 140, currentY + 5, { align: 'center' })
    doc.text('Rate (₹)', 162, currentY + 5, { align: 'right' })
    doc.text('Total (₹)', 192, currentY + 5, { align: 'right' })
    return currentY + 7
  }

  // Items Table Header
  y += 8
  y = renderTableHeader(y)

  // Items Rows
  const items = bill.items || []
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(15, 23, 42)

  items.forEach((item, index) => {
    // Page overflow safety
    if (y > 250) {
      doc.addPage()
      y = 16
      y = renderTableHeader(y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(15, 23, 42)
    }

    const rate = Number(item.selling_price ?? item.price ?? 0).toFixed(2)
    const qty = Number(item.quantity || 1)
    const itemTotal = Number(item.total_price ?? (Number(rate) * qty) ?? 0).toFixed(2)

    doc.text(String(index + 1), 17, y + 5)
    doc.text(String(item.product_name || ''), 25, y + 5)
    doc.text(String(item.product_code || item.barcode || '—'), 90, y + 5)
    doc.text(item.size ? `Size ${item.size}` : '—', 125, y + 5)
    doc.text(String(qty), 140, y + 5, { align: 'center' })
    doc.text(rate, 162, y + 5, { align: 'right' })
    doc.text(itemTotal, 192, y + 5, { align: 'right' })

    y += 7
    doc.setDrawColor(241, 245, 249)
    doc.line(14, y, pageWidth - 14, y)
  })

  // Check if summary fits on page, else add page
  if (y > 220) {
    doc.addPage()
    y = 20
  }

  // Calculations Box
  y += 4
  const subtotal = items.reduce(
    (s, it) => s + (Number(it.total_price ?? (Number(it.selling_price || 0) * Number(it.quantity || 1))) || 0),
    0
  )
  const discount = Number(bill.discount || 0)
  const tax = Number(bill.tax || 0)
  const grandTotal = Number(bill.total_amount || (subtotal - discount + tax))

  const summaryLeft = 120
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', summaryLeft, y)
  doc.text(`₹${subtotal.toFixed(2)}`, 192, y, { align: 'right' })

  if (discount > 0) {
    y += 5
    doc.setTextColor(22, 163, 74)
    doc.text('Discount:', summaryLeft, y)
    doc.text(`- ₹${discount.toFixed(2)}`, 192, y, { align: 'right' })
    doc.setTextColor(15, 23, 42)
  }

  if (tax > 0) {
    y += 5
    doc.text('Tax / GST:', summaryLeft, y)
    doc.text(`+ ₹${tax.toFixed(2)}`, 192, y, { align: 'right' })
  }

  const roundOffVal = Number(bill.round_off || 0)
  if (roundOffVal !== 0) {
    y += 5
    doc.text('Round Off:', summaryLeft, y)
    doc.text(`${roundOffVal > 0 ? '+' : ''}₹${roundOffVal.toFixed(2)}`, 192, y, { align: 'right' })
  }

  y += 6
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.5)
  doc.line(summaryLeft, y - 1, 194, y - 1)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text('Grand Total:', summaryLeft, y + 4)
  doc.setTextColor(37, 99, 235)
  doc.text(`₹${grandTotal.toFixed(2)}`, 192, y + 4, { align: 'right' })

  // Footer notes & terms
  y += 18
  if (bill.description) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text('Note / Description:', 14, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.text(String(bill.description).slice(0, 90), 14, y)
    y += 6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('Terms & Conditions:', 14, y)

  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)

  if (bill.terms_conditions) {
    const termLines = String(bill.terms_conditions).split('\n').filter(Boolean)
    termLines.forEach((t) => {
      doc.text(t.slice(0, 95), 14, y)
      y += 3.5
    })
  } else {
    doc.text('1. Goods once sold will not be refunded.', 14, y)
    y += 3.5
    doc.text('2. Exchange allowed within 7 days with this original receipt and unworn condition.', 14, y)
    y += 3.5
    doc.text('3. Footwear must be in unworn, original box condition.', 14, y)
  }

  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text('Thank You for Shopping at SWAMIDATT FOOTWEAR! Visit Again.', pageWidth / 2, y, { align: 'center' })

  const filename = `${bill.bill_no || 'SW-bill'}.pdf`
  const dataUri = doc.output('datauristring')
  const pdfBase64 = dataUri.split(',')[1] || ''
  const blob = doc.output('blob')

  return {
    doc,
    filename,
    pdfBase64,
    blob,
  }
}

export function generateInvoicePDF(bill) {
  const result = generateInvoicePDFData(bill)
  if (result && result.doc) {
    result.doc.save(result.filename)
  }
  return result
}
