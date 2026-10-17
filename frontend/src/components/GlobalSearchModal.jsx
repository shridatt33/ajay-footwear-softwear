import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import { SearchIcon, ProductIcon, CustomerIcon, SalesIcon, CloseIcon } from './Icons'

export default function GlobalSearchModal({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState({ products: [], customers: [], bills: [] })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('')
      setResults({ products: [], customers: [], bills: [] })
      return
    }

    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch(searchTerm.trim())
      } else {
        setResults({ products: [], customers: [], bills: [] })
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchTerm, isOpen])

  const performSearch = async (query) => {
    setLoading(true)
    const lower = query.toLowerCase()
    try {
      const [prodRes, custRes, billRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/products`).then(r => r.json()),
        fetch(`${API_BASE_URL}/customers`).then(r => r.json()),
        fetch(`${API_BASE_URL}/bills`).then(r => r.json())
      ])

      const matchedProducts = prodRes.status === 'fulfilled' && Array.isArray(prodRes.value)
        ? prodRes.value.filter(p =>
            p.name?.toLowerCase().includes(lower) ||
            p.product_code?.toLowerCase().includes(lower) ||
            p.barcode?.includes(query) ||
            p.category?.toLowerCase().includes(lower)
          ).slice(0, 6)
        : []

      const matchedCustomers = custRes.status === 'fulfilled' && Array.isArray(custRes.value)
        ? custRes.value.filter(c =>
            c.name?.toLowerCase().includes(lower) ||
            c.phone?.includes(query)
          ).slice(0, 5)
        : []

      const matchedBills = billRes.status === 'fulfilled' && Array.isArray(billRes.value)
        ? billRes.value.filter(b =>
            b.invoice_no?.toLowerCase().includes(lower) ||
            b.customer_name?.toLowerCase().includes(lower)
          ).slice(0, 5)
        : []

      setResults({
        products: matchedProducts,
        customers: matchedCustomers,
        bills: matchedBills
      })
    } catch {
      // Ignore background search errors
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop search-modal-backdrop" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-modal-header">
          <SearchIcon size={20} className="search-modal-icon" />
          <input
            type="text"
            className="search-modal-input"
            placeholder="Type product name, code, barcode, customer name, phone, or invoice no..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
          />
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close search">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="search-modal-body">
          {loading && <div className="search-loading">Searching records...</div>}

          {!loading && searchTerm.trim().length >= 2 && (
            <div className="search-results-list">
              {results.products.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title"><ProductIcon size={14} /> Products &amp; Items</div>
                  {results.products.map(p => (
                    <div
                      key={p.id}
                      className="search-item-row"
                      onClick={() => {
                        navigate('/products')
                        onClose()
                      }}
                    >
                      <div className="search-item-primary">
                        <span className="search-item-title">{p.name}</span>
                        <span className="search-item-sub">Code: {p.product_code || 'N/A'} | Barcode: {p.barcode}</span>
                      </div>
                      <div className="search-item-meta">
                        <span className="badge badge-primary">₹{p.price}</span>
                        <span className="badge badge-info">{p.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {results.customers.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title"><CustomerIcon size={14} /> Customers &amp; Parties</div>
                  {results.customers.map(c => (
                    <div
                      key={c.id}
                      className="search-item-row"
                      onClick={() => {
                        navigate('/customers')
                        onClose()
                      }}
                    >
                      <div className="search-item-primary">
                        <span className="search-item-title">{c.name}</span>
                        <span className="search-item-sub">Phone: {c.phone || 'N/A'}</span>
                      </div>
                      <div className="search-item-meta">
                        <span className="badge badge-secondary">Ledger</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {results.bills.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title"><SalesIcon size={14} /> Invoices &amp; Bills</div>
                  {results.bills.map(b => (
                    <div
                      key={b.id}
                      className="search-item-row"
                      onClick={() => {
                        navigate('/sales')
                        onClose()
                      }}
                    >
                      <div className="search-item-primary">
                        <span className="search-item-title">{b.invoice_no}</span>
                        <span className="search-item-sub">Customer: {b.customer_name || 'Walk-in'} | {b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}</span>
                      </div>
                      <div className="search-item-meta">
                        <span className="badge badge-success">₹{b.total_amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {results.products.length === 0 && results.customers.length === 0 && results.bills.length === 0 && (
                <div className="search-empty">No matching records found for "{searchTerm}"</div>
              )}
            </div>
          )}

          {!loading && searchTerm.trim().length < 2 && (
            <div className="search-hint">
              <span>Quick Navigation:</span>
              <div className="quick-nav-pills">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { navigate('/billing'); onClose() }}>POS Billing</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { navigate('/products'); onClose() }}>Products</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { navigate('/sales'); onClose() }}>Sales Invoices</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { navigate('/stock'); onClose() }}>Inventory</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { navigate('/barcodes'); onClose() }}>Barcode Studio</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
