import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import EmptyState from '../components/EmptyState'
import {
  PurchaseIcon,
  PlusIcon,
  CloseIcon,
  SearchIcon,
  TrashIcon,
} from '../components/Icons'

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [paymentMode, setPaymentMode] = useState('Bank Transfer')
  const [paymentStatus, setPaymentStatus] = useState('Paid')
  const [notes, setNotes] = useState('')
  const [purchaseItems, setPurchaseItems] = useState([
    { product_id: '', size: '', quantity: 1, purchase_price: '' },
  ])

  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' })

  const loadData = async () => {
    try {
      setLoading(true)
      const [purRes, prodRes, supRes] = await Promise.all([
        fetch(`${API_BASE_URL}/purchases`),
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/suppliers`),
      ])

      if (purRes.ok) {
        const d = await purRes.json()
        setPurchases(d.purchases || [])
      }
      if (prodRes.ok) {
        const d = await prodRes.json()
        setProducts(d.products || [])
      }
      if (supRes.ok) {
        const d = await supRes.json()
        setSuppliers(d.suppliers || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openAddModal = () => {
    setSupplierName(suppliers[0]?.supplier_name || 'Direct Stock Inward')
    setPaymentMode('Bank Transfer')
    setPaymentStatus('Paid')
    setNotes('')
    const firstProd = products[0]
    setPurchaseItems([
      {
        product_id: firstProd ? firstProd.id : '',
        size: firstProd?.sizes?.[0]?.size || 6,
        quantity: 10,
        purchase_price: firstProd?.purchase_price || 1000,
      },
    ])
    setShowAddModal(true)
  }

  const addPurchaseRow = () => {
    const firstProd = products[0]
    setPurchaseItems([
      ...purchaseItems,
      {
        product_id: firstProd ? firstProd.id : '',
        size: firstProd?.sizes?.[0]?.size || 6,
        quantity: 10,
        purchase_price: firstProd?.purchase_price || 1000,
      },
    ])
  }

  const removePurchaseRow = (idx) => {
    if (purchaseItems.length === 1) return
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))
  }

  const updatePurchaseRow = (idx, field, val) => {
    const updated = [...purchaseItems]
    updated[idx][field] = val

    // If product changed, update available size & default price
    if (field === 'product_id') {
      const prod = products.find((p) => String(p.id) === String(val))
      if (prod && prod.sizes?.length > 0) {
        updated[idx].size = prod.sizes[0].size
        updated[idx].purchase_price = prod.purchase_price || 0
      }
    }
    setPurchaseItems(updated)
  }

  const totalInwardAmount = purchaseItems.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0),
    0
  )

  const handleSavePurchase = async (e) => {
    e.preventDefault()
    if (!supplierName.trim()) {
      alert('Please enter supplier name.')
      return
    }

    try {
      const payload = {
        supplier_name: supplierName.trim(),
        payment_mode: paymentMode,
        payment_status: paymentStatus,
        notes: notes.trim(),
        items: purchaseItems.map((it) => ({
          product_id: Number(it.product_id),
          size: Number(it.size),
          quantity: Number(it.quantity),
          purchase_price: Number(it.purchase_price),
        })),
      }

      const res = await fetch(`${API_BASE_URL}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to record purchase')

      setShowAddModal(false)
      setAlertMsg({
        type: 'success',
        text: `Purchase ${data.purchase?.purchase_no} recorded successfully! Stock levels updated in inventory.`,
      })
      loadData()
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to save purchase' })
    }
  }

  const filteredPurchases = purchases.filter((p) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      p.purchase_no.toLowerCase().includes(term) ||
      p.supplier_name.toLowerCase().includes(term) ||
      p.payment_mode.toLowerCase().includes(term)
    )
  })

  return (
    <div className="erp-page-container">
      {/* Page Header */}
      <div className="erp-page-header">
        <div>
          <h1 className="page-main-title">Purchases &amp; Stock Inward</h1>
          <p className="page-sub-title">Record footwear wholesale arrivals from manufacturers and increase stock inventory automatically.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
            <PlusIcon size={14} />
            <span>+ Add Purchase (Stock Inward)</span>
          </button>
        </div>
      </div>

      {alertMsg.text && (
        <div className={`erp-alert-banner ${alertMsg.type}`}>
          <span>{alertMsg.text}</span>
          <button type="button" className="alert-close" onClick={() => setAlertMsg({ type: '', text: '' })}>
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="erp-filter-toolbar">
        <div className="toolbar-search-box">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="erp-input toolbar-input"
            placeholder="Search purchase PO number, supplier name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <span className="results-counter">{filteredPurchases.length} Purchase Orders</span>
      </div>

      {/* Purchases Table Card */}
      <div className="erp-card table-card">
        <div className="erp-table-responsive">
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th>PO Number</th>
                <th>Supplier / Source</th>
                <th>Inward Items</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th>Payment Mode</th>
                <th>Status</th>
                <th>Received Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="table-loading">Loading inward purchases...</td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <EmptyState
                      title="No Purchases Recorded"
                      description="Record inward shipments from shoe manufacturers to boost inventory."
                      actionLabel="+ Add Purchase"
                      onAction={openAddModal}
                    />
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p, idx) => (
                  <tr key={p.id || p.purchase_no}>
                    <td>{idx + 1}</td>
                    <td><span className="code-pill font-bold">{p.purchase_no}</span></td>
                    <td><div className="table-main-text font-bold">{p.supplier_name}</div></td>
                    <td><span className="items-count-tag">{p.items_count} items</span></td>
                    <td style={{ textAlign: 'right' }}><strong className="amount-text">{p.total_amount}</strong></td>
                    <td><span className="payment-badge">{p.payment_mode}</span></td>
                    <td><span className="status-badge paid">{p.payment_status}</span></td>
                    <td><span className="date-text">{new Date(p.created_at).toLocaleDateString('en-IN')}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PURCHASE MODAL */}
      {showAddModal && (
        <div className="erp-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="erp-modal-box large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Footwear Inward Purchase</h3>
              <button type="button" className="btn-icon" onClick={() => setShowAddModal(false)}>
                <CloseIcon size={14} />
              </button>
            </div>

            <form onSubmit={handleSavePurchase}>
              <div className="modal-body form-grid-2">
                <div className="form-group">
                  <label>Supplier / Vendor Name *</label>
                  <input
                    type="text"
                    required
                    className="erp-input"
                    placeholder="e.g. Nike India Wholesale, Paragon Distributors"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Payment Mode</label>
                  <select
                    className="erp-select"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit / Payable">Credit / Payable</option>
                  </select>
                </div>

                {/* Items Inward Table */}
                <div className="form-group full-width-col">
                  <div className="section-subheading-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4>Inward Footwear Items (Updates Stock)</h4>
                      <span className="caption">Select shoe product, size, quantity received, and purchase cost.</span>
                    </div>
                    <button type="button" className="btn btn-outline btn-xs" onClick={addPurchaseRow}>
                      <PlusIcon size={12} />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="purchase-items-table-box">
                    <table className="erp-table compact-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th style={{ width: '100px' }}>Size</th>
                          <th style={{ width: '100px' }}>Qty (Pairs)</th>
                          <th style={{ width: '130px' }}>Cost Price (₹)</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Total</th>
                          <th style={{ width: '40px' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseItems.map((item, idx) => {
                          const currentProd = products.find((p) => String(p.id) === String(item.product_id))
                          return (
                            <tr key={idx}>
                              <td>
                                <select
                                  required
                                  className="erp-select"
                                  value={item.product_id}
                                  onChange={(e) => updatePurchaseRow(idx, 'product_id', e.target.value)}
                                >
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.product_name} ({p.product_code || `FW-${p.id}`})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  required
                                  className="erp-select"
                                  value={item.size}
                                  onChange={(e) => updatePurchaseRow(idx, 'size', e.target.value)}
                                >
                                  {currentProd?.sizes?.map((s) => (
                                    <option key={s.size} value={s.size}>
                                      Size {s.size}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  className="erp-input"
                                  value={item.quantity}
                                  onChange={(e) => updatePurchaseRow(idx, 'quantity', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  required
                                  className="erp-input"
                                  value={item.purchase_price}
                                  onChange={(e) => updatePurchaseRow(idx, 'purchase_price', e.target.value)}
                                />
                              </td>
                              <td style={{ textAlign: 'right' }} className="font-bold">
                                ₹{((Number(item.quantity) || 0) * (Number(item.purchase_price) || 0)).toFixed(2)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-icon btn-icon-danger"
                                  onClick={() => removePurchaseRow(idx)}
                                  disabled={purchaseItems.length === 1}
                                  title="Remove item"
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="purchase-total-bar">
                    <span>Total Inward Cost:</span>
                    <strong>₹{totalInwardAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                <div className="form-group full-width-col">
                  <label>Notes / Bill Reference</label>
                  <input
                    type="text"
                    className="erp-input"
                    placeholder="e.g. Manufacturer Invoice #9824, Delivery via VRL Logistics"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Record Purchase &amp; Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
