import { jsPDF } from 'jspdf'
import { SHOP_INFO } from '../config.js'
import { groupInvoiceItems, extractInvoiceTotals, formatCurrency, sanitizeInvoiceFilename } from './invoiceUtils.js'

export function generateInvoicePDFData(bill) {
  if (!bill) return null

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginLeft = 14
  const marginRight = 14
  const contentWidth = pageWidth - marginLeft - marginRight
  let y = 14

  // 1. Shop Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(15, 23, 42) // Slate 900
  doc.text(SHOP_INFO.name, pageWidth / 2, y, { align: 'center' })

  y += 5.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105) // Slate 600
  doc.text(SHOP_INFO.tagline || 'Retail Footwear & Accessories', pageWidth / 2, y, { align: 'center' })

  y += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(SHOP_INFO.address, pageWidth / 2, y, { align: 'center' })

  y += 4.5
  doc.text(`Mobile: ${SHOP_INFO.phone}   |   GSTIN: ${SHOP_INFO.gst}`, pageWidth / 2, y, { align: 'center' })

  // Double divider line
  y += 4
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.6)
  doc.line(marginLeft, y, pageWidth - marginRight, y)
  y += 1.2
  doc.setLineWidth(0.2)
  doc.line(marginLeft, y, pageWidth - marginRight, y)

  // Document Heading
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(37, 99, 235) // Primary Blue
  doc.text('RETAIL TAX INVOICE', pageWidth / 2, y, { align: 'center' })

  // 2. Metadata Box
  y += 4
  const metaBoxHeight = bill.billing_address ? 22 : 18
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(marginLeft, y, contentWidth, metaBoxHeight, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.roundedRect(marginLeft, y, contentWidth, metaBoxHeight, 2, 2, 'S')

  const metaY1 = y + 5
  const metaY2 = y + 10
  const metaY3 = y + 15
  const metaCol2X = 118

  // Left Column Metadata
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('Invoice No:', marginLeft + 4, metaY1)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text(String(bill.bill_no || 'DRAFT'), marginLeft + 28, metaY1)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('Date & Time:', marginLeft + 4, metaY2)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  const formattedDate = bill.created_at
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
  doc.text(formattedDate, marginLeft + 28, metaY2)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('Pay Mode:', marginLeft + 4, metaY3)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(String(bill.payment_mode || 'Cash'), marginLeft + 28, metaY3)

  // Right Column Metadata
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('Customer:', metaCol2X, metaY1)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(String(bill.customer_name || 'Walk-in Customer'), metaCol2X + 22, metaY1)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('Phone:', metaCol2X, metaY2)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(String(bill.customer_phone || '—'), metaCol2X + 22, metaY2)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('Status:', metaCol2X, metaY3)
  const isPaid = String(bill.status || '').toLowerCase() !== 'unpaid' && bill.payment_mode !== 'Add in Account'
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(isPaid ? 22 : 220, isPaid ? 163 : 38, isPaid ? 74 : 38)
  doc.text(isPaid ? 'PAID' : 'UNPAID', metaCol2X + 22, metaY3)

  if (bill.billing_address) {
    const metaY4 = y + 19.5
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('Address:', marginLeft + 4, metaY4)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    doc.text(String(bill.billing_address).slice(0, 95), marginLeft + 28, metaY4)
  }

  y += metaBoxHeight + 6

  // 3. Grouped Footwear Items Table Header
  const renderTableHeader = (currentY) => {
    doc.setFillColor(241, 245, 249)
    doc.rect(marginLeft, currentY, contentWidth, 7.5, 'F')
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.4)
    doc.rect(marginLeft, currentY, contentWidth, 7.5, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(51, 65, 85)
    doc.text('#', marginLeft + 3, currentY + 5)
    doc.text('Item Description', marginLeft + 10, currentY + 5)
    doc.text('Size-wise Quantity', marginLeft + 72, currentY + 5)
    doc.text('Total Pairs', marginLeft + 133, currentY + 5, { align: 'center' })
    doc.text('Unit Price', marginLeft + 155, currentY + 5, { align: 'right' })
    doc.text('Amount', marginLeft + 180, currentY + 5, { align: 'right' })
    return currentY + 7.5
  }

  y = renderTableHeader(y)

  // Group items by footwear model identity & unit price
  const groupedItems = groupInvoiceItems(bill.items || [])

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(15, 23, 42)

  if (groupedItems.length === 0) {
    doc.setTextColor(100, 116, 139)
    doc.text('No items in this invoice.', marginLeft + 10, y + 6)
    y += 10
  } else {
    groupedItems.forEach((grp, idx) => {
      // Check page break safety
      if (y > pageHeight - 45) {
        doc.addPage()
        y = 16
        y = renderTableHeader(y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(15, 23, 42)
      }

      const rowHeight = 7.5
      const baselineY = y + 5

      // 1. Sr. No.
      doc.setFont('helvetica', 'normal')
      doc.text(String(idx + 1), marginLeft + 3, baselineY)

      // 2. Product Name (No SKU/barcode code text)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(String(grp.product_name).slice(0, 36), marginLeft + 10, baselineY)

      // 3. Size-wise Quantity (e.g. Size 1: 3, Size 2: 4, Size 3: 4)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(71, 85, 105)
      doc.text(String(grp.size_breakdown_text || '—').slice(0, 42), marginLeft + 72, baselineY)

      // 4. Total Pairs
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(String(grp.total_quantity), marginLeft + 133, baselineY, { align: 'center' })

      // 5. Unit Price
      doc.setFont('helvetica', 'normal')
      doc.text(`₹${grp.selling_price.toFixed(2)}`, marginLeft + 155, baselineY, { align: 'right' })

      // 6. Total Amount
      doc.setFont('helvetica', 'bold')
      doc.text(`₹${grp.total_price.toFixed(2)}`, marginLeft + 180, baselineY, { align: 'right' })

      y += rowHeight
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.2)
      doc.line(marginLeft, y, pageWidth - marginRight, y)
    })
  }

  // 4. Calculations Summary Box (Right Aligned)
  const totals = extractInvoiceTotals(bill)

  if (y > pageHeight - 55) {
    doc.addPage()
    y = 20
  }

  y += 5
  const summaryBoxWidth = 85
  const summaryBoxX = pageWidth - marginRight - summaryBoxWidth

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)

  let summaryHeight = 24
  if (totals.discountAmount > 0) summaryHeight += 5
  if (totals.deliveryCharges > 0) summaryHeight += 5
  if (totals.tax > 0) summaryHeight += 5
  if (totals.roundOff !== 0) summaryHeight += 5
  if (totals.amountReceived > 0 || totals.isAccount) summaryHeight += 10

  doc.roundedRect(summaryBoxX, y, summaryBoxWidth, summaryHeight, 2, 2, 'FD')

  let calcY = y + 5
  const labelX = summaryBoxX + 4
  const valueX = summaryBoxX + summaryBoxWidth - 4

  // Subtotal
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text('Subtotal:', labelX, calcY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(formatCurrency(totals.subtotal), valueX, calcY, { align: 'right' })

  // Discount (if any)
  if (totals.discountAmount > 0) {
    calcY += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(22, 163, 74)
    const discLabel = totals.discountPercent > 0 ? `Discount (${totals.discountPercent}%):` : 'Discount:'
    doc.text(discLabel, labelX, calcY)
    doc.setFont('helvetica', 'bold')
    doc.text(`- ${formatCurrency(totals.discountAmount)}`, valueX, calcY, { align: 'right' })
  }

  // Delivery / Transport Charges (if any)
  if (totals.deliveryCharges > 0) {
    calcY += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('Delivery / Transport Charges:', labelX, calcY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(`+ ${formatCurrency(totals.deliveryCharges)}`, valueX, calcY, { align: 'right' })
  }

  // Tax / GST (if any)
  if (totals.tax > 0) {
    calcY += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('Tax / GST:', labelX, calcY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(`+ ${formatCurrency(totals.tax)}`, valueX, calcY, { align: 'right' })
  }

  // Round Off (if any)
  if (totals.roundOff !== 0) {
    calcY += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('Round Off:', labelX, calcY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    const sign = totals.roundOff > 0 ? '+' : ''
    doc.text(`${sign}${formatCurrency(totals.roundOff)}`, valueX, calcY, { align: 'right' })
  }

  // Grand Total Divider
  calcY += 3
  doc.setDrawColor(203, 213, 225)
  doc.line(labelX, calcY, valueX, calcY)

  // Grand Total
  calcY += 4.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  doc.text('Grand Total:', labelX, calcY)
  doc.setTextColor(22, 163, 74)
  doc.text(formatCurrency(totals.grandTotal), valueX, calcY, { align: 'right' })

  // Payment Status / Balance details
  if (totals.isAccount) {
    calcY += 5
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('Amount Paid:', labelX, calcY)
    doc.text(formatCurrency(totals.amountReceived), valueX, calcY, { align: 'right' })

    calcY += 4.5
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text('Balance Due:', labelX, calcY)
    doc.text(formatCurrency(totals.outstandingAmount), valueX, calcY, { align: 'right' })
  } else if (totals.amountReceived > 0) {
    calcY += 5
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('Received:', labelX, calcY)
    doc.text(formatCurrency(totals.amountReceived), valueX, calcY, { align: 'right' })

    if (totals.changeReturned > 0) {
      calcY += 4.5
      doc.setFont('helvetica', 'normal')
      doc.text('Change Return:', labelX, calcY)
      doc.text(formatCurrency(totals.changeReturned), valueX, calcY, { align: 'right' })
    }
  }

  // 5. Notes / Description (if provided)
  if (bill.description) {
    const notesY = y + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text('Invoice Note:', marginLeft, notesY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(String(bill.description).slice(0, 75), marginLeft, notesY + 4)
  }

  // 6. Sign-off & Footer (Notice: NO Terms & Conditions section)
  const footerY = Math.max(y + summaryHeight + 12, pageHeight - 22)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(marginLeft, footerY, pageWidth - marginRight, footerY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(37, 99, 235)
  doc.text('Thank You for Shopping at SWAMIDATT ENTERPRISES! Visit Again.', marginLeft, footerY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Authorized Signatory', pageWidth - marginRight, footerY + 6, { align: 'right' })

  const cleanBillNo = sanitizeInvoiceFilename(bill.bill_no, 'SW-bill')
  const filename = `${cleanBillNo}.pdf`
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
