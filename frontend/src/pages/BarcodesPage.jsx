import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import BarcodeDisplay from '../components/BarcodeDisplay'
import EmptyState from '../components/EmptyState'
import {
  SearchIcon,
  PrintIcon,
  DownloadIcon,
} from '../components/Icons'
import {
  STICKER_FORMATS,
  DEFAULT_STICKER_FORMAT_ID,
} from '../utils/stickerFormats'
import { generateBarcodeStickersPdf } from '../utils/barcodePdfGenerator'

export default function BarcodesPage() {
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [labelCopies, setLabelCopies] = useState(8)
  const [labelFormat, setLabelFormat] = useState(DEFAULT_STICKER_FORMAT_ID)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  const currentFormat = STICKER_FORMATS[labelFormat] || STICKER_FORMATS[DEFAULT_STICKER_FORMAT_ID]

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true)
        const res = await fetch(`${API_BASE_URL}/products`)
        if (res.ok) {
          const d = await res.json()
          const prods = d.products || []
          setProducts(prods)
          if (prods.length > 0) setSelectedProduct(prods[0])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [])

  const filteredProducts = products.filter((p) => {
    if (!searchTerm) return true
    const t = searchTerm.toLowerCase()
    return (
      p.product_name.toLowerCase().includes(t) ||
      (p.product_code && p.product_code.toLowerCase().includes(t)) ||
      (p.barcode && p.barcode.includes(t))
    )
  })

  const handlePrint = async () => {
    if (!selectedProduct) return

    // Inject exact physical @page sizing for thermal roll / label printer
    const styleId = 'dynamic-barcode-print-page'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }

    styleEl.innerHTML = `
      @media print {
        @page {
          size: ${currentFormat.totalWidthIn}in ${currentFormat.labelHeightIn}in !important;
          margin: 0 !important;
        }
      }
    `

    try {
      if (window.electronAPI && typeof window.electronAPI.printCurrentWindow === 'function') {
        await window.electronAPI.printCurrentWindow({
          silent: false,
          printBackground: true,
          color: true,
          pageSize: {
            width: Math.round(currentFormat.totalWidthIn * 25400),
            height: Math.round(currentFormat.labelHeightIn * 25400),
          },
        })
      } else {
        window.print()
      }
    } finally {
      setTimeout(() => {
        const el = document.getElementById(styleId)
        if (el) el.remove()
      }, 1500)
    }
  }

  const handleDownloadPdf = () => {
    if (!selectedProduct) return
    generateBarcodeStickersPdf(selectedProduct, labelCopies, currentFormat)
  }

  return (
    <div className="erp-page-container">
      {/* Header */}
      <div className="erp-page-header no-print">
        <div>
          <h1 className="page-main-title">Barcode Studio &amp; Thermal Printing</h1>
          <p className="page-sub-title">Generate, preview, and print 2.00″ × 1.00″ die-cut barcode stickers for footwear products.</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleDownloadPdf}
            disabled={!selectedProduct}
            title="Export labels to 2 × 1 inch PDF"
          >
            <DownloadIcon size={14} />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handlePrint}
            disabled={!selectedProduct}
          >
            <PrintIcon size={14} />
            <span>Print {labelCopies} Stickers Now</span>
          </button>
        </div>
      </div>

      <div className="barcodes-studio-layout no-print">
        {/* Left Column: Product Selection List */}
        <div className="erp-card barcode-list-card">
          <div className="card-header-bar">
            <h3 className="card-heading">Select Footwear Item</h3>
          </div>
          <div className="toolbar-search-box" style={{ margin: '12px' }}>
            <SearchIcon size={14} className="search-icon" />
            <input
              type="text"
              className="erp-input toolbar-input"
              placeholder="Search shoe name, SKU, code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="barcode-product-select-list">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className={`barcode-select-row ${selectedProduct?.id === p.id ? 'active' : ''}`}
                onClick={() => setSelectedProduct(p)}
              >
                <div className="b-prod-info">
                  <div className="b-prod-name">{p.product_name}</div>
                  <div className="b-prod-code">
                    {p.product_code} • {p.category_name} • MRP: ₹{Number(p.purchase_price ?? p.cost_price ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="b-prod-price">₹{p.selling_price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Print Settings & Live Preview */}
        <div className="erp-card barcode-preview-card">
          <div className="card-header-bar">
            <div className="card-title-group">
              <h3 className="card-heading">Thermal Label Settings &amp; Sheet Preview</h3>
              <span className="card-caption">{currentFormat.description}</span>
            </div>
          </div>

          <div className="card-body">
            {selectedProduct ? (
              <>
                <div className="label-controls-bar">
                  <div className="form-group inline-group">
                    <label>Copies to Print:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="erp-input"
                      style={{ width: '80px' }}
                      value={labelCopies}
                      onChange={(e) => setLabelCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>

                  <div className="form-group inline-group">
                    <label>Sticker Format:</label>
                    <select
                      className="erp-select"
                      value={labelFormat}
                      onChange={(e) => setLabelFormat(e.target.value)}
                    >
                      <option value="diecut_2x1">Die-Cut Label (2 × 1 inch)</option>
                      <option value="box">Shoe Box Label (Standard 50×25mm)</option>
                      <option value="shelf">Shelf / Rack Tag (Compact)</option>
                    </select>
                  </div>
                </div>

                {/* Format Specifications Badge */}
                <div className="sticker-specs-strip">
                  <span><strong>Label Size:</strong> {currentFormat.labelWidthIn.toFixed(2)}″ × {currentFormat.labelHeightIn.toFixed(2)}″ ({currentFormat.labelWidthMm} × {currentFormat.labelHeightMm} mm)</span>
                  <span><strong>Type:</strong> {currentFormat.stickerType}</span>
                  <span><strong>Liner:</strong> {currentFormat.leftLinerIn}″ L / {currentFormat.rightLinerIn}″ R</span>
                  <span><strong>Sticker MRP (Cost):</strong> ₹{Number(selectedProduct.purchase_price ?? selectedProduct.cost_price ?? 0).toFixed(2)}</span>
                  <span><strong>Selling Price:</strong> ₹{Number(selectedProduct.selling_price || 0).toFixed(2)}</span>
                </div>

                <div className="single-preview-wrap">
                  <div className="single-preview-header">
                    <span className="preview-label-tag">Single Sticker Preview</span>
                    <span className="preview-dimension-tag">{currentFormat.labelWidthIn.toFixed(2)}″ × {currentFormat.labelHeightIn.toFixed(2)}″</span>
                  </div>

                  {/* Single Sticker with backing liner representation */}
                  <div
                    className="sticker-liner-carrier single-preview-carrier"
                    style={{
                      width: `${currentFormat.totalWidthIn}in`,
                      paddingLeft: `${currentFormat.leftLinerIn}in`,
                      paddingRight: `${currentFormat.rightLinerIn}in`,
                    }}
                  >
                    <div
                      className="thermal-sticker-label single-preview"
                      style={{
                        width: `${currentFormat.labelWidthIn}in`,
                        height: `${currentFormat.labelHeightIn}in`,
                      }}
                    >
                      <div className="sticker-prod-name" title={selectedProduct.product_name}>
                        {selectedProduct.product_name}
                      </div>
                      <div className="sticker-code">{selectedProduct.product_code}</div>
                      <BarcodeDisplay
                        value={selectedProduct.barcode}
                        width={currentFormat.barcodeWidth}
                        height={currentFormat.barcodeHeight}
                        fontSize={currentFormat.barcodeFontSize}
                        margin={currentFormat.barcodeMargin}
                        textMargin={currentFormat.barcodeTextMargin}
                      />
                      <div className="sticker-price">MRP: ₹{Number(selectedProduct.purchase_price ?? selectedProduct.cost_price ?? 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="No Product Selected" description="Select a footwear item to generate labels." />
            )}
          </div>
        </div>
      </div>

      {/* ALL STICKER PREVIEWS IN GRID (Screen Preview) */}
      {selectedProduct && (
        <div className="erp-card no-print" style={{ marginTop: '20px' }}>
          <div className="card-header-bar">
            <div className="card-title-group">
              <h3 className="card-heading">All Sticker Previews ({labelCopies} Labels)</h3>
              <span className="card-caption">
                {currentFormat.labelWidthIn.toFixed(2)}″ × {currentFormat.labelHeightIn.toFixed(2)}″ Die-Cut Sticker Grid with {currentFormat.leftLinerIn}″ Liner
              </span>
            </div>
          </div>
          <div className="card-body">
            <div className="printable-stickers-grid">
              {Array.from({ length: labelCopies }).map((_, idx) => (
                <div
                  key={idx}
                  className="sticker-liner-carrier"
                  style={{
                    width: `${currentFormat.totalWidthIn}in`,
                    paddingLeft: `${currentFormat.leftLinerIn}in`,
                    paddingRight: `${currentFormat.rightLinerIn}in`,
                  }}
                >
                  <div
                    className="thermal-sticker-label"
                    style={{
                      width: `${currentFormat.labelWidthIn}in`,
                      height: `${currentFormat.labelHeightIn}in`,
                    }}
                  >
                    <div className="sticker-prod-name" title={selectedProduct.product_name}>
                      {selectedProduct.product_name}
                    </div>
                    <div className="sticker-code">{selectedProduct.product_code}</div>
                    <BarcodeDisplay
                      value={selectedProduct.barcode}
                      width={currentFormat.barcodeWidth}
                      height={currentFormat.barcodeHeight}
                      fontSize={currentFormat.barcodeFontSize}
                      margin={currentFormat.barcodeMargin}
                      textMargin={currentFormat.barcodeTextMargin}
                    />
                    <div className="sticker-price">MRP: ₹{Number(selectedProduct.purchase_price ?? selectedProduct.cost_price ?? 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE AREA FOR BROWSER / THERMAL PRINTER */}
      {selectedProduct && (
        <div className="printable-barcode-sheet print-only">
          {Array.from({ length: labelCopies }).map((_, idx) => (
            <div
              key={idx}
              className="print-sticker-carrier"
              style={{
                width: `${currentFormat.totalWidthIn}in`,
                height: `${currentFormat.labelHeightIn}in`,
              }}
            >
              <div
                className="thermal-sticker-label"
                style={{
                  width: `${currentFormat.labelWidthIn}in`,
                  height: `${currentFormat.labelHeightIn}in`,
                }}
              >
                <div className="sticker-prod-name">{selectedProduct.product_name}</div>
                <div className="sticker-code">{selectedProduct.product_code}</div>
                <BarcodeDisplay
                  value={selectedProduct.barcode}
                  width={currentFormat.barcodeWidth}
                  height={currentFormat.barcodeHeight}
                  fontSize={currentFormat.barcodeFontSize}
                  margin={currentFormat.barcodeMargin}
                  textMargin={currentFormat.barcodeTextMargin}
                />
                <div className="sticker-price">MRP: ₹{Number(selectedProduct.purchase_price ?? selectedProduct.cost_price ?? 0).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
