import { useEffect, useState } from 'react'
import { API_BASE_URL, SHOP_INFO } from '../config'
import BarcodeDisplay from '../components/BarcodeDisplay'
import EmptyState from '../components/EmptyState'
import {
  BarcodeNavIcon,
  SearchIcon,
  PrintIcon,
} from '../components/Icons'

export default function BarcodesPage() {
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [labelCopies, setLabelCopies] = useState(8)
  const [labelFormat, setLabelFormat] = useState('box') // 'box' (50x25mm), 'shelf' (small)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

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
    if (window.electronAPI && typeof window.electronAPI.printCurrentWindow === 'function') {
      await window.electronAPI.printCurrentWindow({
        silent: false,
        printBackground: true,
        color: true,
      })
    } else {
      window.print()
    }
  }


  return (
    <div className="erp-page-container">
      {/* Header */}
      <div className="erp-page-header no-print">
        <div>
          <h1 className="page-main-title">Barcode Studio &amp; Thermal Printing</h1>
          <p className="page-sub-title">Generate, preview, and print 1 unique GS1 / EAN-13 barcode sticker per footwear product.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint} disabled={!selectedProduct}>
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
                  <div className="b-prod-code">{p.product_code} • {p.category_name}</div>
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
              <span className="card-caption">Standard 50mm × 25mm barcode label layout</span>
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
                      max="60"
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
                      <option value="box">Shoe Box Label (Standard 50x25mm)</option>
                      <option value="shelf">Shelf / Rack Tag (Compact)</option>
                    </select>
                  </div>
                </div>

                <div className="single-preview-wrap">
                  <span className="preview-label-tag">Single Sticker Preview</span>
                  <div className="thermal-sticker-label single-preview">
                    <div className="sticker-shop">{SHOP_INFO.name}</div>
                    <div className="sticker-prod-name">{selectedProduct.product_name}</div>
                    <div className="sticker-code">{selectedProduct.product_code}</div>
                    <BarcodeDisplay value={selectedProduct.barcode} width={1.8} height={42} fontSize={11} />
                    <div className="sticker-price">MRP: ₹{Number(selectedProduct.selling_price).toFixed(2)} (Incl. all taxes)</div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="No Product Selected" description="Select a footwear item to generate labels." />
            )}
          </div>
        </div>
      </div>

      {/* PRINTABLE AREA (Only visible during print) */}
      {selectedProduct && (
        <div className="printable-stickers-grid printable-area">
          {Array.from({ length: labelCopies }).map((_, idx) => (
            <div key={idx} className="thermal-sticker-label">
              <div className="sticker-shop">{SHOP_INFO.name}</div>
              <div className="sticker-prod-name">{selectedProduct.product_name}</div>
              <div className="sticker-code">{selectedProduct.product_code}</div>
              <BarcodeDisplay value={selectedProduct.barcode} width={1.6} height={38} fontSize={10} />
              <div className="sticker-price">MRP: ₹{Number(selectedProduct.selling_price).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
