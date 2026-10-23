import React, { useState, useEffect } from 'react'
import { API_BASE_URL, SHOP_INFO } from '../config'
import BarcodeDisplay from './BarcodeDisplay'
import { PrintIcon, CloseIcon, DownloadIcon } from './Icons'
import { generateInvoicePDFData, generateInvoicePDF } from '../utils/pdfGenerator'
import { groupInvoiceItems, extractInvoiceTotals, formatCurrency } from '../utils/invoiceUtils'

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

      // 3. Generate the invoice PDF using invoice number in filename
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

  // Extract grouped items and calculated totals
  const groupedItems = groupInvoiceItems(currentBill.items || [])
  const totals = extractInvoiceTotals(currentBill)

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
        {/* Top Header Controls (No-Print) */}
        <div className="invoice-modal-header no-print">
          <div className="invoice-modal-title-group">
            <span className="modal-badge-label">TAX INVOICE</span>
            <span className="modal-bill-no">{currentBill.bill_no || 'DRAFT'}</span>
            <span className={`invoice-header-status-pill ${totals.isAccount ? 'unpaid' : 'paid'}`}>
              {currentBill.status || (totals.isAccount ? 'Unpaid' : 'Paid')}
            </span>
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

        {/* Scrollable invoice modal body containing active format view */}
        <div className="invoice-modal-body">
          {printFormat === 'thermal' ? (
            /* =============================================================
               80MM THERMAL RECEIPT PREVIEW & PRINT SHEET
               ============================================================= */
            <div className="thermal-receipt-container printable-area">
              <div className="thermal-receipt-sheet">
                {/* Header */}
                <div className="thermal-center">
                  <div className="thermal-shop-name">{SHOP_INFO.name}</div>
                  <div className="thermal-tagline">{SHOP_INFO.tagline}</div>
                  <div className="thermal-sub">{SHOP_INFO.address}</div>
                  <div className="thermal-sub">Phone: {SHOP_INFO.phone}</div>
                  <div className="thermal-sub">GSTIN: {SHOP_INFO.gst}</div>
                </div>

                <div className="thermal-divider-double" />
                <div className="thermal-center thermal-bold" style={{ fontSize: '13px', letterSpacing: '0.04em' }}>
                  RETAIL TAX INVOICE
                </div>
                <div className="thermal-divider-dashed" />

                {/* Metadata */}
                <div className="thermal-row">
                  <span>Bill No:</span>
                  <span className="thermal-bold">{currentBill.bill_no || 'DRAFT'}</span>
                </div>
                <div className="thermal-row">
                  <span>Date:</span>
                  <span>{formattedDateTime}</span>
                </div>
                <div className="thermal-row">
                  <span>Customer:</span>
                  <span className="thermal-bold">{currentBill.customer_name || 'Walk-in Customer'}</span>
                </div>
                {currentBill.customer_phone && currentBill.customer_phone !== '—' && (
                  <div className="thermal-row">
                    <span>Phone:</span>
                    <span>{currentBill.customer_phone}</span>
                  </div>
                )}
                <div className="thermal-row">
                  <span>Pay Mode:</span>
                  <span className="thermal-bold">{currentBill.payment_mode || 'Cash'}</span>
                </div>
                <div className="thermal-row">
                  <span>Status:</span>
                  <span className="thermal-bold">{totals.isAccount ? 'UNPAID' : 'PAID'}</span>
                </div>

                <div className="thermal-divider-dashed" />

                {/* Grouped Items Table */}
                <table className="thermal-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '52%' }}>Item Description</th>
                      <th style={{ width: '14%', textAlign: 'center' }}>Pairs</th>
                      <th style={{ width: '16%', textAlign: 'right' }}>Rate</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedItems.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '8px 0' }}>
                          No items in bill.
                        </td>
                      </tr>
                    ) : (
                      groupedItems.map((grp, idx) => (
                        <tr key={grp.key || idx}>
                          <td style={{ verticalAlign: 'top' }}>
                            <div className="thermal-item-name">{grp.product_name}</div>
                            <div className="thermal-sizes-breakdown">{grp.size_breakdown_text}</div>
                          </td>
                          <td style={{ textAlign: 'center', verticalAlign: 'top', fontWeight: 700 }}>
                            {grp.total_quantity}
                          </td>
                          <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                            {grp.selling_price.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', verticalAlign: 'top', fontWeight: 700 }}>
                            {grp.total_price.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="thermal-divider-dashed" />

                {/* Calculations */}
                <div className="thermal-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="thermal-row" style={{ color: '#15803d' }}>
                    <span>Discount {totals.discountPercent > 0 ? `(${totals.discountPercent}%)` : ''}:</span>
                    <span>- {formatCurrency(totals.discountAmount)}</span>
                  </div>
                )}
                {totals.deliveryCharges > 0 && (
                  <div className="thermal-row">
                    <span>Delivery / Transport:</span>
                    <span>+ {formatCurrency(totals.deliveryCharges)}</span>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="thermal-row">
                    <span>Tax / GST:</span>
                    <span>+ {formatCurrency(totals.tax)}</span>
                  </div>
                )}
                {totals.roundOff !== 0 && (
                  <div className="thermal-row">
                    <span>Round Off:</span>
                    <span>{totals.roundOff > 0 ? '+' : ''}{formatCurrency(totals.roundOff)}</span>
                  </div>
                )}

                <div className="thermal-divider-dashed" />

                <div className="thermal-row thermal-grand-total">
                  <span>GRAND TOTAL:</span>
                  <span>{formatCurrency(totals.grandTotal)}</span>
                </div>

                {totals.isAccount ? (
                  <>
                    <div className="thermal-row" style={{ marginTop: '3px' }}>
                      <span>Amount Paid:</span>
                      <span>{formatCurrency(totals.amountReceived)}</span>
                    </div>
                    <div className="thermal-row thermal-bold" style={{ color: '#b91c1c' }}>
                      <span>Balance Due:</span>
                      <span>{formatCurrency(totals.outstandingAmount)}</span>
                    </div>
                  </>
                ) : (
                  totals.amountReceived > 0 && (
                    <>
                      <div className="thermal-row" style={{ marginTop: '3px' }}>
                        <span>Received:</span>
                        <span>{formatCurrency(totals.amountReceived)}</span>
                      </div>
                      {totals.changeReturned > 0 && (
                        <div className="thermal-row">
                          <span>Change Return:</span>
                          <span>{formatCurrency(totals.changeReturned)}</span>
                        </div>
                      )}
                    </>
                  )
                )}

                <div className="thermal-divider-dashed" />

                {/* Invoice Barcode */}
                {currentBill.bill_no && (
                  <div className="thermal-barcode-wrap">
                    <BarcodeDisplay value={currentBill.bill_no} width={1.4} height={32} fontSize={10} />
                  </div>
                )}

                <div className="thermal-footer">
                  <div className="thermal-bold">Thank You for Shopping at SWAMIDATT FOOTWEAR!</div>
                  <div style={{ fontSize: '9px', marginTop: '2px' }}>Visit Again.</div>
                </div>
              </div>
            </div>
          ) : (
            /* =============================================================
               A4 RETAIL TAX INVOICE PREVIEW & PRINT SHEET
               ============================================================= */
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
              <div className="inv-heading-title">Retail Tax Invoice</div>

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
                    <span className={`status-badge ${totals.isAccount ? 'unpaid' : 'paid'}`}>
                      {totals.isAccount ? 'UNPAID' : 'PAID'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grouped Footwear Items Table (Identical models grouped into 1 row, NO SKU column) */}
              <table className="inv-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                    <th style={{ minWidth: '180px' }}>Item Description</th>
                    <th style={{ width: '230px' }}>Size-wise Quantity</th>
                    <th style={{ width: '75px', textAlign: 'center' }}>Total Pairs</th>
                    <th style={{ width: '95px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ width: '105px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                        No items in this invoice.
                      </td>
                    </tr>
                  ) : (
                    groupedItems.map((grp, idx) => (
                      <tr key={grp.key || idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td>
                          <div className="inv-item-name">{grp.product_name}</div>
                        </td>
                        <td className="inv-size-cell">
                          <span className="inv-size-pill">{grp.size_breakdown_text}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {grp.total_quantity}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(grp.selling_price)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {formatCurrency(grp.total_price)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Summary & Totals Calculation Box (Notice: NO Terms & Conditions section) */}
              <div className="inv-summary-wrapper" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {/* Optional Customer Note / Left Space */}
                <div className="inv-notes-column" style={{ flex: 1, paddingRight: '24px' }}>
                  {currentBill.description ? (
                    <div className="inv-note-box">
                      <div className="inv-note-title">Invoice Note:</div>
                      <div className="inv-note-text">{currentBill.description}</div>
                    </div>
                  ) : (
                    <div style={{ minHeight: '20px' }} />
                  )}
                </div>

                {/* Right Calculations Card */}
                <div className="inv-calculation-box">
                  <div className="inv-calc-row">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>

                  {totals.discountAmount > 0 && (
                    <div className="inv-calc-row text-success">
                      <span>Discount {totals.discountPercent > 0 ? `(${totals.discountPercent}%)` : ''}:</span>
                      <span>- {formatCurrency(totals.discountAmount)}</span>
                    </div>
                  )}

                  {totals.deliveryCharges > 0 && (
                    <div className="inv-calc-row">
                      <span>Delivery / Transport Charges:</span>
                      <span>+ {formatCurrency(totals.deliveryCharges)}</span>
                    </div>
                  )}

                  {totals.tax > 0 && (
                    <div className="inv-calc-row">
                      <span>Tax / GST:</span>
                      <span>+ {formatCurrency(totals.tax)}</span>
                    </div>
                  )}

                  {totals.roundOff !== 0 && (
                    <div className="inv-calc-row">
                      <span>Round Off:</span>
                      <span>{totals.roundOff > 0 ? '+' : ''}{formatCurrency(totals.roundOff)}</span>
                    </div>
                  )}

                  <div className="inv-divider-single" />

                  <div className="inv-calc-row grand-total-row">
                    <span>Grand Total:</span>
                    <span>{formatCurrency(totals.grandTotal)}</span>
                  </div>

                  {totals.isAccount ? (
                    <>
                      <div className="inv-calc-row small-calc">
                        <span>Amount Paid:</span>
                        <span>{formatCurrency(totals.amountReceived)}</span>
                      </div>
                      <div className="inv-calc-row small-calc" style={{ color: '#dc2626', fontWeight: 700 }}>
                        <span>Balance Due:</span>
                        <span>{formatCurrency(totals.outstandingAmount)}</span>
                      </div>
                    </>
                  ) : (
                    totals.amountReceived > 0 && (
                      <>
                        <div className="inv-calc-row small-calc">
                          <span>Received:</span>
                          <span>{formatCurrency(totals.amountReceived)}</span>
                        </div>
                        {totals.changeReturned > 0 && (
                          <div className="inv-calc-row small-calc">
                            <span>Change Return:</span>
                            <span>{formatCurrency(totals.changeReturned)}</span>
                          </div>
                        )}
                      </>
                    )
                  )}
                </div>
              </div>

              {/* Bottom Sign-off, Barcode & Store Signature */}
              <div className="inv-bottom-signature-row">
                <div className="inv-footer-barcode-col">
                  {currentBill.bill_no && (
                    <BarcodeDisplay value={currentBill.bill_no} width={1.6} height={34} fontSize={10} />
                  )}
                  <div className="inv-thankyou-msg">
                    Thank You for Shopping at SWAMIDATT FOOTWEAR! Visit Again.
                  </div>
                </div>

                <div className="inv-authorized-signature">
                  Authorized Signatory
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Prominent Action Footer with Format Selection & Action Buttons */}
        <div className="invoice-modal-footer no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '12px 18px' }}>
          {/* Print format selection */}
          <div className="print-format-switcher" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Layout:</span>
            <button
              type="button"
              className={`btn btn-sm ${printFormat === 'a4' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPrintFormat('a4')}
              style={{
                padding: '5px 12px',
                fontSize: '0.82rem',
                backgroundColor: printFormat === 'a4' ? '#2563eb' : 'transparent',
                borderColor: printFormat === 'a4' ? '#2563eb' : '#cbd5e1',
                color: printFormat === 'a4' ? '#fff' : '#475569',
                fontWeight: 600,
              }}
            >
              A4 Sheet
            </button>
            <button
              type="button"
              className={`btn btn-sm ${printFormat === 'thermal' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPrintFormat('thermal')}
              style={{
                padding: '5px 12px',
                fontSize: '0.82rem',
                backgroundColor: printFormat === 'thermal' ? '#2563eb' : 'transparent',
                borderColor: printFormat === 'thermal' ? '#2563eb' : '#cbd5e1',
                color: printFormat === 'thermal' ? '#fff' : '#475569',
                fontWeight: 600,
              }}
            >
              80mm Thermal
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
                  ? (printFormat === 'thermal' ? 'Print 80mm Receipt' : 'Print Tax Invoice')
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
