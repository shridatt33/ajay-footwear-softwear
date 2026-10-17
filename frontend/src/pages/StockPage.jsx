import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import EmptyState from '../components/EmptyState'
import { StockIcon, SearchIcon } from '../components/Icons'

export default function StockPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const loadStock = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/products`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
  }, [])

  const filteredProducts = products.filter((p) => {
    if (filter === 'low' && p.stock_status !== 'Low Stock') return false
    if (filter === 'out' && p.stock_status !== 'Out of Stock') return false
    if (filter === 'in' && p.stock_status !== 'In Stock') return false

    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      p.product_name.toLowerCase().includes(term) ||
      (p.product_code && p.product_code.toLowerCase().includes(term)) ||
      (p.barcode && p.barcode.includes(term)) ||
      (p.category_name && p.category_name.toLowerCase().includes(term))
    )
  })

  const totalPairsInStock = products.reduce((acc, p) => acc + (p.total_stock || 0), 0)
  const totalRetailValuation = products.reduce(
    (acc, p) => acc + (p.total_stock || 0) * (Number(p.selling_price) || 0),
    0
  )

  return (
    <div className="erp-page-container">
      {/* Page Header */}
      <div className="erp-page-header">
        <div>
          <h1 className="page-main-title">Stock &amp; Inventory Levels</h1>
          <p className="page-sub-title">Per-size pairs breakdown, out-of-stock monitoring, and retail inventory valuation.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={loadStock}>
            <span>Refresh Stock</span>
          </button>
        </div>
      </div>

      {/* KPI Inventory Cards */}
      <div className="kpi-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '16px' }}>
        <div className="kpi-card product-kpi">
          <div className="kpi-data">
            <span className="kpi-label">Total Footwear Models</span>
            <div className="kpi-value">{products.length}</div>
          </div>
        </div>
        <div className="kpi-card stock-kpi">
          <div className="kpi-data">
            <span className="kpi-label">Total Pairs In Stock</span>
            <div className="kpi-value">{totalPairsInStock}</div>
          </div>
        </div>
        <div className="kpi-card sales-kpi">
          <div className="kpi-data">
            <span className="kpi-label">Retail Valuation</span>
            <div className="kpi-value">₹{totalRetailValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="erp-filter-toolbar">
        <div className="toolbar-search-box">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="erp-input toolbar-input"
            placeholder="Search product name, code, barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="toolbar-right-group">
          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Models ({products.length})
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'in' ? 'active' : ''}`}
              onClick={() => setFilter('in')}
            >
              In Stock
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'low' ? 'active' : ''}`}
              onClick={() => setFilter('low')}
            >
              Low Stock (&le;5)
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'out' ? 'active' : ''}`}
              onClick={() => setFilter('out')}
            >
              Out of Stock (0)
            </button>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="erp-card table-card">
        <div className="erp-table-responsive">
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th>Product Details</th>
                <th>Category</th>
                <th style={{ textAlign: 'center' }}>Total Pairs</th>
                <th>Size-by-Size Breakdown</th>
                <th style={{ textAlign: 'right' }}>Unit MRP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="table-loading">Loading stock inventory...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <EmptyState
                      title="No Products Matching Filter"
                      description="Try switching the stock filter to All Models."
                    />
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => (
                  <tr key={p.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <div className="table-main-text font-bold">{p.product_name}</div>
                      <div className="table-code-sub">{p.product_code || `FW-${p.id}`} • {p.barcode}</div>
                    </td>
                    <td>
                      <span className="cat-tag">{p.category_name}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <strong className={`stock-count-highlight ${p.total_stock <= 5 ? 'text-danger' : ''}`}>
                        {p.total_stock}
                      </strong>
                    </td>
                    <td>
                      <div className="table-sizes-chips">
                        {p.sizes?.map((s) => (
                          <span
                            key={s.size}
                            className={`size-mini-badge ${s.stock_quantity === 0 ? 'out' : s.stock_quantity <= 5 ? 'low' : ''}`}
                          >
                            Size <b>{s.size}</b>: {s.stock_quantity}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }} className="font-bold">
                      ₹{Number(p.selling_price).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`status-badge ${p.stock_status === 'Out of Stock' ? 'critical' : p.stock_status === 'Low Stock' ? 'warning' : 'paid'}`}>
                        {p.stock_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
