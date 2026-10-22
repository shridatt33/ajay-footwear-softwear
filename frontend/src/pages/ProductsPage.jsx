import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import BarcodeDisplay from '../components/BarcodeDisplay'
import EmptyState from '../components/EmptyState'
import {
  ProductIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  PrintIcon,
  CloseIcon,
  BarcodeNavIcon,
} from '../components/Icons'

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [viewingProduct, setViewingProduct] = useState(null)
  const [printingBarcodeProduct, setPrintingBarcodeProduct] = useState(null)
  const [stickerCopies, setStickerCopies] = useState(4)

  // Form State
  const [formData, setFormData] = useState({
    product_name: '',
    product_code: '',
    category_id: '',
    selling_price: '',
    purchase_price: '',
    description: '',
    status: 'active',
    sizeStocks: [],
  })

  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' })

  const loadData = async () => {
    try {
      setLoading(true)
      const [prodRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/categories`),
      ])

      if (prodRes.ok) {
        const prodData = await prodRes.json()
        setProducts(prodData.products || [])
      }
      if (catRes.ok) {
        const catData = await catRes.json()
        setCategories(catData.categories || [])
      }
    } catch (err) {
      console.error('Failed to load products/categories:', err)
      setAlertMsg({ type: 'error', text: 'Failed to load catalog data.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Open Add Product Modal
  const openAddModal = () => {
    setEditingProduct(null)
    const firstCat = categories[0]
    const defaultSizes = firstCat ? (firstCat.sizes || []) : [6, 7, 8, 9, 10]
    setFormData({
      product_name: '',
      product_code: '',
      category_id: firstCat ? firstCat.id : '',
      selling_price: '',
      purchase_price: '',
      description: '',
      status: 'active',
      sizeStocks: defaultSizes.map((s) => ({ size: s, stock_quantity: 0 })),
    })
    setShowAddEditModal(true)
  }

  // Open Edit Product Modal
  const openEditModal = (p) => {
    setEditingProduct(p)
    setFormData({
      product_name: p.product_name,
      product_code: p.product_code || '',
      category_id: p.category_id || '',
      selling_price: p.selling_price || '',
      purchase_price: p.purchase_price || '',
      description: p.description || '',
      status: p.status || 'active',
      sizeStocks: (p.sizes || []).map((s) => ({
        size: s.size,
        stock_quantity: s.stock_quantity ?? s.stock ?? 0,
      })),
    })
    setShowAddEditModal(true)
  }

  // Handle Category Change inside Add/Edit Modal (updates available sizes)
  const handleCategoryChange = (catId) => {
    const chosen = categories.find((c) => String(c.id) === String(catId))
    const allowedSizes = chosen ? (chosen.sizes || []) : []
    const existingMap = new Map(formData.sizeStocks.map((s) => [s.size, s.stock_quantity]))
    const newSizes = allowedSizes.map((s) => ({
      size: s,
      stock_quantity: existingMap.get(s) || 0,
    }))
    setFormData({
      ...formData,
      category_id: catId,
      sizeStocks: newSizes,
    })
  }

  // Save Product (Create or Update)
  const handleSaveProduct = async (e) => {
    e.preventDefault()
    setAlertMsg({ type: '', text: '' })

    try {
      const url = editingProduct
        ? `${API_BASE_URL}/products/${editingProduct.id}`
        : `${API_BASE_URL}/products`
      const method = editingProduct ? 'PUT' : 'POST'

      const payload = {
        product_name: formData.product_name.trim(),
        product_code: formData.product_code.trim(),
        category_id: Number(formData.category_id),
        selling_price: Number(formData.selling_price),
        purchase_price: Number(formData.purchase_price) || 0,
        description: formData.description.trim(),
        status: formData.status,
        sizes: formData.sizeStocks,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Operation failed')
      }

      setShowAddEditModal(false)
      setAlertMsg({
        type: 'success',
        text: editingProduct
          ? `Product "${payload.product_name}" updated successfully.`
          : `Product "${payload.product_name}" created with barcode ${data.product?.barcode}.`,
      })
      loadData()
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to save product.' })
    }
  }

  // Delete / Deactivate Product
  const handleDeleteProduct = async (productId, name) => {
    if (!window.confirm(`Deactivate product "${name}"?`)) return
    try {
      const res = await fetch(`${API_BASE_URL}/products/${productId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      setAlertMsg({ type: 'info', text: `Product "${name}" deactivated.` })
      loadData()
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to delete product.' })
    }
  }

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    if (selectedCategoryFilter !== 'all' && String(p.category_id) !== String(selectedCategoryFilter)) {
      return false
    }
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      p.product_name.toLowerCase().includes(term) ||
      (p.product_code && p.product_code.toLowerCase().includes(term)) ||
      (p.barcode && p.barcode.includes(term)) ||
      (p.category_name && p.category_name.toLowerCase().includes(term))
    )
  })

  return (
    <div className="erp-page-container">
      {/* Page Header */}
      <div className="erp-page-header">
        <div>
          <h1 className="page-main-title">Products &amp; Catalog</h1>
          <p className="page-sub-title">1 Product = Multi-size Matrix = 1 Unique Barcode. Efficient shoe inventory management.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
            <PlusIcon size={14} />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMsg.text && (
        <div className={`erp-alert-banner ${alertMsg.type}`}>
          <span>{alertMsg.text}</span>
          <button type="button" className="alert-close" onClick={() => setAlertMsg({ type: '', text: '' })}>
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="erp-filter-toolbar">
        <div className="toolbar-search-box">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="erp-input toolbar-input"
            placeholder="Search by product name, code, barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="toolbar-right-group">
          <select
            className="erp-select toolbar-select"
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category_name}
              </option>
            ))}
          </select>

          <span className="results-counter">Showing {filteredProducts.length} items</span>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="erp-card table-card">
        <div className="erp-table-responsive">
          <table className="erp-table products-catalog-table">
            <thead>
              <tr>
                <th style={{ width: '55px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '220px' }}>Product Details</th>
                <th style={{ minWidth: '120px' }}>Category</th>
                <th style={{ minWidth: '130px', textAlign: 'right' }}>Selling Price</th>
                <th style={{ minWidth: '300px' }}>Available Sizes &amp; Stock</th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>Total Stock</th>
                <th style={{ minWidth: '160px' }}>Barcode</th>
                <th style={{ minWidth: '120px', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '140px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="table-loading">Loading catalog products...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <EmptyState
                      title="No Products Found"
                      description="Create a new footwear product with multi-size stock."
                      actionLabel="+ Add Product"
                      onAction={openAddModal}
                    />
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const calculatedTotalStock = (p.sizes && p.sizes.length > 0)
                    ? p.sizes.reduce((sum, s) => sum + (Number(s.stock_quantity ?? s.stock ?? 0)), 0)
                    : (Number(p.total_stock) || 0)

                  const statusConfig = calculatedTotalStock === 0
                    ? { label: 'Out of Stock', cls: 'critical' }
                    : calculatedTotalStock <= 5
                    ? { label: 'Low Stock', cls: 'warning' }
                    : { label: 'In Stock', cls: 'paid' }

                  return (
                    <tr key={p.id}>
                      <td style={{ textAlign: 'center' }} className="text-muted font-medium">
                        {idx + 1}
                      </td>
                      <td className="product-details-cell">
                        <div className="product-name-heading" title={p.product_name}>
                          {p.product_name}
                        </div>
                        <div className="product-code-sub">
                          {p.product_code || `FW-${p.id}`}
                        </div>
                      </td>
                      <td>
                        <span className="product-cat-badge" title={p.category_name || p.category || 'General'}>
                          {p.category_name || p.category || 'General'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="product-selling-price">
                          ₹{Number(p.selling_price || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        <div className="product-sizes-chips-wrap">
                          {p.sizes && p.sizes.length > 0 ? (
                            p.sizes.map((s) => {
                              const qty = Number(s.stock_quantity ?? s.stock ?? 0)
                              const chipCls = qty === 0 ? 'chip-zero' : qty <= 5 ? 'chip-low' : 'chip-healthy'
                              return (
                                <span
                                  key={s.size}
                                  className={`prod-size-chip ${chipCls}`}
                                  title={`Size ${s.size} — ${qty} unit${qty === 1 ? '' : 's'}`}
                                >
                                  <span className="chip-size-lbl">{s.size}</span>
                                  <span className="chip-sep">:</span>
                                  <span className="chip-qty-lbl">{qty}</span>
                                </span>
                              )
                            })
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.78rem' }}>No sizes defined</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`product-total-stock-badge ${calculatedTotalStock === 0 ? 'stock-zero' : calculatedTotalStock <= 5 ? 'stock-low' : 'stock-healthy'}`}
                          title={`Total Stock: ${calculatedTotalStock} pairs`}
                        >
                          {calculatedTotalStock}
                        </span>
                      </td>
                      <td>
                        <span
                          className="product-barcode-pill"
                          title={`Barcode: ${p.barcode} — Click to print label`}
                          onClick={() => setPrintingBarcodeProduct(p)}
                        >
                          {p.barcode}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-badge ${statusConfig.cls}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-actions-inline">
                          <button
                            type="button"
                            className="btn-icon"
                            title="View Details"
                            onClick={() => setViewingProduct({ ...p, calculatedTotalStock, statusConfig })}
                          >
                            <EyeIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Print Barcode Label"
                            onClick={() => setPrintingBarcodeProduct(p)}
                          >
                            <PrintIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Edit Product"
                            onClick={() => openEditModal(p)}
                          >
                            <EditIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-icon-danger"
                            title="Deactivate Product"
                            onClick={() => handleDeleteProduct(p.id, p.product_name)}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {showAddEditModal && (
        <div className="erp-modal-backdrop" onClick={() => setShowAddEditModal(false)}>
          <div className="erp-modal-box large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Footwear Product' : 'Add New Footwear Product'}</h3>
              <button type="button" className="btn-icon" onClick={() => setShowAddEditModal(false)}>
                <CloseIcon size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-body form-grid-2">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    required
                    className="erp-input"
                    placeholder="e.g. Nike Air Max, Sparx Running"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Product Code (SKU)</label>
                  <input
                    type="text"
                    className="erp-input"
                    placeholder="e.g. FW-0025 (auto-generated if empty)"
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    required
                    className="erp-select"
                    value={formData.category_id}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="erp-input"
                    placeholder="e.g. 1999.00"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Purchase / Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="erp-input"
                    placeholder="e.g. 1200.00"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="erp-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Multi-Size Stock Matrix Form Section */}
                <div className="form-group full-width-col">
                  <div className="section-subheading-wrap">
                    <h4>Multi-Size Stock Quantities</h4>
                    <span className="caption">Enter current in-hand stock pairs for each size.</span>
                  </div>

                  <div className="size-stock-input-grid">
                    {formData.sizeStocks.map((item, idx) => (
                      <div key={item.size} className="size-stock-card">
                        <span className="size-label-tag">Size {item.size}</span>
                        <input
                          type="number"
                          min="0"
                          className="erp-input size-stock-input"
                          value={item.stock_quantity}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                            const updated = [...formData.sizeStocks]
                            updated[idx].stock_quantity = val
                            setFormData({ ...formData, sizeStocks: updated })
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group full-width-col">
                  <label>Description / Notes</label>
                  <textarea
                    rows="2"
                    className="erp-input"
                    placeholder="Optional details: color, material, sole type, manufacturer..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingProduct ? 'Save Changes' : 'Create Product & Barcode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PRODUCT MODAL */}
      {viewingProduct && (
        <div className="erp-modal-backdrop" onClick={() => setViewingProduct(null)}>
          <div className="erp-modal-box large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Product Details</h3>
              <button type="button" className="btn-icon" onClick={() => setViewingProduct(null)}>
                <CloseIcon size={14} />
              </button>
            </div>

            <div className="modal-body product-view-body">
              <div className="prod-view-header">
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>{viewingProduct.product_name}</h2>
                  <div className="prod-view-subhead">
                    <span className="code-pill">{viewingProduct.product_code || `FW-${viewingProduct.id}`}</span>
                    <span className="product-cat-badge">{viewingProduct.category_name || viewingProduct.category || 'General'}</span>
                    {(() => {
                      const total = viewingProduct.calculatedTotalStock ?? (
                        (viewingProduct.sizes && viewingProduct.sizes.length > 0)
                          ? viewingProduct.sizes.reduce((sum, s) => sum + (Number(s.stock_quantity ?? s.stock ?? 0)), 0)
                          : (Number(viewingProduct.total_stock) || 0)
                      )
                      const st = total === 0
                        ? { label: 'Out of Stock', cls: 'critical' }
                        : total <= 5
                        ? { label: 'Low Stock', cls: 'warning' }
                        : { label: 'In Stock', cls: 'paid' }
                      return (
                        <span className={`status-badge ${st.cls}`}>
                          {st.label}
                        </span>
                      )
                    })()}
                  </div>
                </div>
              </div>

              <div className="prod-view-meta-grid">
                <div>
                  <span className="label">Category:</span>
                  <strong>{viewingProduct.category_name || viewingProduct.category || 'General'}</strong>
                </div>
                <div>
                  <span className="label">Selling Price:</span>
                  <strong className="text-primary font-bold" style={{ fontSize: '1.05rem' }}>
                    ₹{Number(viewingProduct.selling_price || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span className="label">Purchase Price (Cost):</span>
                  <strong style={{ fontSize: '1.05rem', color: '#475569' }}>
                    ₹{Number(viewingProduct.purchase_price || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span className="label">Total Stock:</span>
                  <strong style={{ fontSize: '1.05rem' }}>
                    {(viewingProduct.sizes && viewingProduct.sizes.length > 0)
                      ? viewingProduct.sizes.reduce((sum, s) => sum + (Number(s.stock_quantity ?? s.stock ?? 0)), 0)
                      : (Number(viewingProduct.total_stock) || 0)} Pairs
                  </strong>
                </div>
                <div>
                  <span className="label">Created Date:</span>
                  <strong>
                    {viewingProduct.created_at
                      ? new Date(viewingProduct.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </strong>
                </div>
                <div>
                  <span className="label">Barcode Number:</span>
                  <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                    {viewingProduct.barcode}
                  </strong>
                </div>
              </div>

              {/* Barcode graphic section */}
              <div className="prod-view-barcode-box">
                <span className="label">Barcode Label:</span>
                <BarcodeDisplay value={viewingProduct.barcode} width={2} height={60} />
              </div>

              {/* Size breakdown */}
              <div className="prod-view-sizes-box">
                <span className="label">Size-wise Stock Breakdown:</span>
                <div className="view-sizes-chips">
                  {viewingProduct.sizes?.map((s) => {
                    const qty = Number(s.stock_quantity ?? s.stock ?? 0)
                    const chipCls = qty === 0 ? 'stock-zero' : qty <= 5 ? 'stock-low' : 'stock-healthy'
                    return (
                      <div key={s.size} className={`view-size-card ${chipCls}`}>
                        <span className="s-num">Size {s.size}</span>
                        <strong className="s-stock">{qty} pairs</strong>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setPrintingBarcodeProduct(viewingProduct)
                  setViewingProduct(null)
                }}
              >
                <PrintIcon size={14} />
                <span>Print Barcode Label</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const pToEdit = viewingProduct
                  setViewingProduct(null)
                  openEditModal(pToEdit)
                }}
              >
                <EditIcon size={14} />
                <span>Edit Product</span>
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setViewingProduct(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT BARCODE STICKER MODAL */}
      {printingBarcodeProduct && (
        <div className="erp-modal-backdrop" onClick={() => setPrintingBarcodeProduct(null)}>
          <div className="erp-modal-box barcode-print-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header no-print">
              <h3>Print Shoe Box Barcode Stickers</h3>
              <button type="button" className="btn-icon" onClick={() => setPrintingBarcodeProduct(null)}>
                <CloseIcon size={14} />
              </button>
            </div>

            <div className="modal-body no-print">
              <div className="sticker-config-row">
                <label>Number of Sticker Copies:</label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  className="erp-input"
                  style={{ width: '90px' }}
                  value={stickerCopies}
                  onChange={(e) => setStickerCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    if (window.electronAPI && typeof window.electronAPI.printCurrentWindow === 'function') {
                      await window.electronAPI.printCurrentWindow({ silent: false, printBackground: true, color: true })
                    } else {
                      window.print()
                    }
                  }}
                >
                  <PrintIcon size={14} />
                  <span>Print Stickers Now</span>
                </button>

              </div>
            </div>

            {/* Printable Stickers Sheet */}
            <div className="printable-stickers-grid printable-area">
              {Array.from({ length: stickerCopies }).map((_, i) => (
                <div key={i} className="thermal-sticker-label">
                  <div className="sticker-prod-name">{printingBarcodeProduct.product_name}</div>
                  <div className="sticker-code">{printingBarcodeProduct.product_code}</div>
                  <BarcodeDisplay value={printingBarcodeProduct.barcode} width={1.35} height={28} fontSize={9} margin={1} textMargin={1} />
                  <div className="sticker-price">MRP: ₹{Number(printingBarcodeProduct.purchase_price ?? printingBarcodeProduct.cost_price ?? 0).toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPrintingBarcodeProduct(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
