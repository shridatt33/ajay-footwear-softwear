import React, { useState, useEffect } from 'react'
import { API_BASE_URL, SHOP_INFO } from '../config'
import BarcodeDisplay from './BarcodeDisplay'
import { PrintIcon, CloseIcon, DownloadIcon } from './Icons'
import { generateInvoicePDFData, generateInvoicePDF } from '../utils/pdfGenerator'

export default function InvoiceModal({ bill, onClose, onSaveBill, onAfterSavePrint }) {
  if (!bill) return null

  const [currentBill, setCurrentBill] = useState(bill)
  const [printFormat, setPrintFormat] = useState('a4') // 'a4' | 'thermal'
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', text: '' })

  useEffect(() => {
    document.body.classList.add('invoice-modal-open')
    return () => {
      document.body.classList.remove('invoice-modal-open')
    }
  }, [])

  useEffect(() => {
    setCurrentBill(bill)
  }, [bill])

  // Automatically save PDF to local folder & backend immediately when bill has ID
  useEffect(() => {
    const autoSavePdf = async () => {
      if (!currentBill || !currentBill.id || !currentBill.bill_no) return
      try {
        const pdfData = generateInvoicePDFData(currentBill)
        if (!pdfData) return

        // 1. Save locally via Electron IPC if desktop environment
        if (window.electronAPI && typeof window.electronAPI.saveInvoicePdf === 'function') {
          await window.electronAPI.saveInvoicePdf({
            billNo: currentBill.bill_no,
            pdfBase64: pdfData.pdfBase64,
          })
        }

        // 2. Sync to backend dedicated invoices folder
        await fetch(`${API_BASE_URL}/bills/${currentBill.id}/save-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bill_no: currentBill.bill_no,
            pdf_base64: pdfData.pdfBase64,
          }),
        })
      } catch (err) {
        console.warn('Auto-save invoice PDF note:', err)
      }
    }

    autoSavePdf()
  }, [currentBill?.id, currentBill?.bill_no])

  // Direct PDF Export via Electron or browser
  const handleExportPdf = async () => {
    if (saving) return
    setStatus({ type: 'info', text: 'Preparing PDF document...' })
    try {
      if (window.electronAPI && typeof window.electronAPI.printToPdf === 'function') {
        const res = await window.electronAPI.printToPdf({
          bill: currentBill,
          printType: printFormat,
        })
        if (res && res.filePath) {
          setStatus({ type: 'success', text: `PDF saved successfully: ${res.filename}` })
        } else if (res && res.cancelled) {
          setStatus({ type: 'info', text: 'PDF export was cancelled.' })
        } else if (res && !res.success) {
          throw new Error(res.error || 'Failed to export PDF')
        }
      } else {
        generateInvoicePDF(currentBill)
        setStatus({ type: 'success', text: 'PDF downloaded successfully!' })
      }
    } catch (err) {
      console.error('PDF export error:', err)
      setStatus({ type: 'error', text: err.message || 'Failed to generate PDF.' })
    }
  }

  // Main Action: SAVE BILL & PRINT
  const handleSaveAndPrint = async () => {
    if (saving) return
    setSaving(true)
    setStatus({ type: 'info', text: 'Processing bill & invoice...' })

    try {
      let activeBill = currentBill

      // 1. Validate that the sale is complete and invoice data is correct
      const itemsList = activeBill.items || []
      if (itemsList.length === 0) {
        throw new Error('Invoice contains no items. Add products before saving.')
      }

      // 2. If bill is not yet saved to database, save it permanently (atomic checkout)
      if (!activeBill.id && onSaveBill) {
        const saved = await onSaveBill()
        if (!saved || !saved.id) {
          throw new Error('Could not save bill to database.')
        }
        activeBill = saved
        setCurrentBill(saved)
      }

      if (!activeBill.bill_no) {
        throw new Error('Invoice number is missing.')
      }

      // 3. Generate the invoice PDF using invoice number in filename (e.g. SW-1029.pdf)
      try {
        const pdfData = generateInvoicePDFData(activeBill)
        if (pdfData) {
          if (window.electronAPI && typeof window.electronAPI.saveInvoicePdf === 'function') {
            await window.electronAPI.saveInvoicePdf({
              billNo: activeBill.bill_no,
              pdfBase64: pdfData.pdfBase64,
            })
          }

          await fetch(`${API_BASE_URL}/bills/${activeBill.id}/save-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bill_no: activeBill.bill_no,
              pdf_base64: pdfData.pdfBase64,
            }),
          }).catch(() => {})
        }
      } catch (pdfErr) {
        console.warn('Backend PDF save notice:', pdfErr)
      }

      // 4. Open native print dialog with installed printers via Electron or browser
      if (window.electronAPI && typeof window.electronAPI.printInvoice === 'function') {
        const printResult = await window.electronAPI.printInvoice({
          bill: activeBill,
          printType: printFormat,
        })

        if (printResult && printResult.cancelled) {
          setStatus({
            type: 'info',
            text: `Bill ${activeBill.bill_no} saved permanently! Print dialog closed.`,
          })
        } else if (printResult && !printResult.success && printResult.error) {
          setStatus({
            type: 'error',
            text: `Print error: ${printResult.error}`,
          })
        } else {
          setStatus({
            type: 'success',
            text: `Bill ${activeBill.bill_no} sent to printer successfully!`,
          })
        }
      } else {
        // Fallback for standard browser
        window.print()
        setStatus({
          type: 'success',
          text: `Bill ${activeBill.bill_no} saved permanently!`,
        })
      }

      if (onAfterSavePrint) {
        onAfterSavePrint(activeBill)
      }
    } catch (err) {
      console.error('Save & Print error:', err)
      setStatus({ type: 'error', text: err.message || 'Failed to complete invoice action.' })
    } finally {
      setSaving(false)
    }
  }


  const items = currentBill.items || []
  const subtotal = items.reduce((sum, item) => {
    const unitPrice = Number(item.selling_price ?? item.price ?? 0)
    const qty = Number(item.quantity ?? 1)
    const total = Number(item.total_price ?? (unitPrice * qty) ?? 0)
    return sum + total
  }, 0)

  const discount = Number(currentBill.discount || 0)
  const tax = Number(currentBill.tax || 0)
  const grandTotal = Number(currentBill.total_amount ?? Math.max(0, subtotal - discount + tax))
  const received = Number(currentBill.amount_received || 0)
  const change = Number(currentBill.change_returned || 0)

  const formattedDateTime = currentBill.created_at
    ? new Date(currentBill.created_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })

  return (
    <div className="erp-modal-backdrop invoice-modal-backdrop" onClick={onClose}>
      <div className="erp-modal-box invoice-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Clean top header: Only badge, bill number, and subtle corner close icon */}
        <div className="invoice-modal-header no-print">
          <div className="invoice-modal-title-group">
            <span className="modal-badge-label">TAX INVOICE</span>
            <span className="modal-bill-no">{currentBill.bill_no || 'DRAFT'}</span>
            <span className="invoice-header-status-pill">{currentBill.status || 'Paid'}</span>
          </div>

          <button
            type="button"
            className="invoice-corner-close-btn"
            onClick={onClose}
            title="Close Preview (Esc)"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Scrollable invoice modal body containing full A4 printable sheet */}
        <div className="invoice-modal-body">
          <div className="invoice-printable-sheet printable-area">
            {/* Shop Branding Header */}
            <div className="inv-header">
              <div className="inv-shop-title">{SHOP_INFO.name}</div>
              <div className="inv-shop-tagline">{SHOP_INFO.tagline}</div>
              <div className="inv-shop-address">{SHOP_INFO.address}</div>
              <div className="inv-shop-contact">
                <span>
                  <b>Mobile:</b> {SHOP_INFO.phone}
                </span>
                <span className="sep">•</span>
                <span>
                  <b>GSTIN:</b> {SHOP_INFO.gst}
                </span>
              </div>
            </div>

            <div className="inv-divider-double" />

            {/* Meta Information Grid */}
            <div className="inv-meta-grid">
              <div className="inv-meta-col">
                <div className="inv-meta-row">
                  <span className="label">Invoice No:</span>
                  <span className="val highlight">{currentBill.bill_no || 'DRAFT'}</span>
                </div>
                <div className="inv-meta-row">
                  <span className="label">Date &amp; Time:</span>
                  <span className="val">{formattedDateTime}</span>
                </div>
                <div className="inv-meta-row">
                  <span className="label">Payment Mode:</span>
                  <span className="val font-bold">{currentBill.payment_mode || 'Cash'}</span>
                </div>
              </div>

              <div className="inv-meta-col text-right">
                <div className="inv-meta-row">
                  <span className="label">Customer Name:</span>
                  <span className="val font-bold">{currentBill.customer_name || 'Walk-in Customer'}</span>
                </div>
                {currentBill.customer_phone && currentBill.customer_phone !== '—' && (
                  <div className="inv-meta-row">
                    <span className="label">Contact Phone:</span>
                    <span className="val">{currentBill.customer_phone}</span>
                  </div>
                )}
                {currentBill.billing_address && (
                  <div className="inv-meta-row">
                    <span className="label">Billing Address:</span>
                    <span className="val">{currentBill.billing_address}</span>
                  </div>
                )}
                <div className="inv-meta-row">
                  <span className="label">Status:</span>
                  <span className={`status-badge ${currentBill.status === 'Unpaid' ? 'unpaid' : 'paid'}`}>
                    {currentBill.status || 'Paid'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table with Shoe Size & Quantities */}
            <table className="inv-items-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                  <th>Product / Item Description</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Shoe Size</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Unit Price (₹)</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Total Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                      No items in this invoice.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const unitPrice = Number(it.selling_price ?? it.price ?? 0)
                    const qty = Number(it.quantity ?? 1)
                    const itemTotal = Number(it.total_price ?? (unitPrice * qty) ?? 0)

                    return (
                      <tr key={it.id || idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td>
                          <div className="inv-item-name">{it.product_name}</div>
                          {(it.barcode || it.product_code) && (
                            <div className="inv-item-code">
                              Code: {it.product_code || it.barcode}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }} className="inv-size-cell">
                          {it.size ? `Size ${it.size}` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }} className="font-bold">
                          {qty}
                        </td>
                        <td style={{ textAlign: 'right' }}>{unitPrice.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">
                          {itemTotal.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>

            {/* Summary & Totals Calculation Box */}
            <div className="inv-summary-wrapper">
              <div className="inv-summary-notes">
                <div className="inv-terms-title">Terms &amp; Conditions:</div>
                <ul className="inv-terms-list">
                  <li>Goods once sold will not be refunded.</li>
                  <li>Exchange allowed within 7 days with this original receipt.</li>
                  <li>Footwear must be in unworn, original box condition.</li>
                  <li>No guarantee on discount / sales items.</li>
                </ul>
              </div>

              <div className="inv-calculation-box">
                <div className="inv-calc-row">
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="inv-calc-row text-success">
                    <span>Discount:</span>
                    <span>- ₹{discount.toFixed(2)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="inv-calc-row">
                    <span>Tax / GST:</span>
                    <span>+ ₹{tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="inv-divider-single" />
                <div className="inv-calc-row grand-total-row">
                  <span>Grand Total:</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
                {currentBill.payment_mode === 'Add in Account' || currentBill.status === 'Unpaid' ? (
                  <>
                    <div className="inv-calc-row small-calc">
                      <span>Amount Paid:</span>
                      <span>₹{Number(currentBill.amount_paid ?? received ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="inv-calc-row small-calc" style={{ color: '#dc2626', fontWeight: 700 }}>
                      <span>Outstanding Due:</span>
                      <span>₹{Number(currentBill.outstanding_amount ?? Math.max(0, grandTotal - (currentBill.amount_paid ?? received ?? 0))).toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  received > 0 && (
                    <>
                      <div className="inv-calc-row small-calc">
                        <span>Received:</span>
                        <span>₹{received.toFixed(2)}</span>
                      </div>
                      {change > 0 && (
                        <div className="inv-calc-row small-calc">
                          <span>Change:</span>
                          <span>₹{change.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )
                )}
              </div>
            </div>

            {/* Bottom Barcode & Store Sign-Off */}
            <div className="inv-footer-barcode">
              {currentBill.bill_no && (
                <BarcodeDisplay value={currentBill.bill_no} width={1.8} height={38} fontSize={11} />
              )}
              <div className="inv-thankyou-msg">
                Thank You for Shopping at SWAMIDATT FOOTWEAR! Visit Again.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Prominent Action Footer with Format Selection & Action Buttons */}
        <div className="invoice-modal-footer no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '12px 18px' }}>
          {/* Print format selection */}
          <div className="print-format-switcher" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Format:</span>
            <button
              type="button"
              className={`btn btn-sm ${printFormat === 'a4' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPrintFormat('a4')}
              style={{
                padding: '4px 10px',
                fontSize: '0.8rem',
                backgroundColor: printFormat === 'a4' ? '#2563eb' : 'transparent',
                borderColor: printFormat === 'a4' ? '#2563eb' : '#cbd5e1',
                color: printFormat === 'a4' ? '#fff' : '#475569',
              }}
            >
              A4 Invoice
            </button>
            <button
              type="button"
              className={`btn btn-sm ${printFormat === 'thermal' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPrintFormat('thermal')}
              style={{
                padding: '4px 10px',
                fontSize: '0.8rem',
                backgroundColor: printFormat === 'thermal' ? '#2563eb' : 'transparent',
                borderColor: printFormat === 'thermal' ? '#2563eb' : '#cbd5e1',
                color: printFormat === 'thermal' ? '#fff' : '#475569',
              }}
            >
              Thermal (80mm)
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleExportPdf}
              disabled={saving}
              title="Save Invoice as PDF file"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <DownloadIcon size={15} />
              <span>Save as PDF</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-save-print"
              onClick={handleSaveAndPrint}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', fontSize: '0.9rem', fontWeight: 600 }}
            >
              <PrintIcon size={18} />
              <span>
                {saving
                  ? 'Processing...'
                  : currentBill.id
                  ? (printFormat === 'thermal' ? 'Print Thermal Receipt' : 'Print Tax Invoice')
                  : 'SAVE BILL & PRINT'}
              </span>
            </button>
          </div>

          {status.text && (
            <div className={`invoice-status-banner ${status.type}`} style={{ width: '100%', marginTop: '6px' }}>
              {status.text}
            </div>
          )}
        </div>
      </div>
    </div>

  )
}
