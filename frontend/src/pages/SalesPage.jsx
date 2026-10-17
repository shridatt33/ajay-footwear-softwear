import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import EmptyState from '../components/EmptyState'
import InvoiceModal from '../components/InvoiceModal'
import {
  SalesIcon,
  SearchIcon,
  EyeIcon,
  PrintIcon,
  PlusIcon,
  DownloadIcon,
} from '../components/Icons'
import { generateInvoicePDF } from '../utils/pdfGenerator'
import { useNavigate } from 'react-router-dom'

export default function SalesPage() {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)

  const loadBills = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/bills?limit=150`)
      if (res.ok) {
        const data = await res.json()
        setBills(data.bills || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBills()
  }, [])

  const viewInvoiceDetail = async (billId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/bills/${billId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedBill(data.bill)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Filter bills
  const filteredBills = bills.filter((b) => {
    // Date filter
    if (dateFilter === 'today') {
      const billDate = new Date(b.date).toDateString()
      const today = new Date().toDateString()
      if (billDate !== today) return false
    } else if (dateFilter === 'week') {
      const billTime = new Date(b.date).getTime()
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      if (billTime < sevenDaysAgo) return false
    }

    // Text search
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      b.bill_no.toLowerCase().includes(term) ||
      b.customer.toLowerCase().includes(term) ||
      (b.phone && b.phone.includes(term)) ||
      b.payment.toLowerCase().includes(term)
    )
  })

  const totalFilteredSales = filteredBills.reduce((sum, b) => sum + (b.raw_amount || 0), 0)

  return (
    <div className="erp-page-container">
      {/* Page Header */}
      <div className="erp-page-header">
        <div>
          <h1 className="page-main-title">Sales Invoices Register</h1>
          <p className="page-sub-title">Complete record of retail sales invoices, payment modes, and customer receipts.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/billing')}>
            <PlusIcon size={14} />
            <span>+ New Sale (POS)</span>
          </button>
        </div>
      </div>

      {/* Filter & Metric Bar */}
      <div className="erp-filter-toolbar">
        <div className="toolbar-search-box">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="erp-input toolbar-input"
            placeholder="Search invoice number, customer, phone, payment mode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="toolbar-right-group">
          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-btn ${dateFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDateFilter('all')}
            >
              All Time
            </button>
            <button
              type="button"
              className={`filter-btn ${dateFilter === 'today' ? 'active' : ''}`}
              onClick={() => setDateFilter('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`filter-btn ${dateFilter === 'week' ? 'active' : ''}`}
              onClick={() => setDateFilter('week')}
            >
              This Week
            </button>
          </div>

          <div className="sales-total-pill">
            <span className="label">Total:</span>
            <strong>₹{totalFilteredSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="erp-card table-card">
        <div className="erp-table-responsive">
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th>Invoice No</th>
                <th>Date &amp; Time</th>
                <th>Customer</th>
                <th>Items Sold</th>
                <th>Payment Mode</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="table-loading">Loading sales register...</td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <EmptyState
                      title="No Sales Invoices Found"
                      description="Create a new sale using POS Billing to generate an invoice."
                      actionLabel="+ New Sale"
                      onAction={() => navigate('/billing')}
                    />
                  </td>
                </tr>
              ) : (
                filteredBills.map((b, idx) => (
                  <tr key={b.id || b.bill_no}>
                    <td>{idx + 1}</td>
                    <td>
                      <span className="code-pill font-bold">{b.bill_no}</span>
                    </td>
                    <td>
                      <span className="date-text">
                        {b.date ? new Date(b.date).toLocaleString('en-IN') : '—'}
                      </span>
                    </td>
                    <td>
                      <div className="table-main-text font-bold">{b.customer}</div>
                      {b.phone && <div className="table-sub-text">{b.phone}</div>}
                    </td>
                    <td>
                      <span className="items-count-tag">{b.items} items</span>
                    </td>
                    <td>
                      <span className="payment-badge">{b.payment}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className="amount-text">{b.amount}</strong>
                    </td>
                    <td>
                      <span className="status-badge paid">{b.status}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="table-actions-inline">
                        <button
                          type="button"
                          className="btn-icon"
                          title="View / Print Tax Invoice"
                          onClick={() => viewInvoiceDetail(b.id)}
                        >
                          <EyeIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Download Invoice PDF"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await fetch(`${API_BASE_URL}/bills/${b.id}`)
                              if (res.ok) {
                                const data = await res.json()
                                generateInvoicePDF(data.bill)
                              }
                            } catch (err) {
                              console.error(err)
                            }
                          }}
                        >
                          <DownloadIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal for Viewing and Thermal/A4 Printing */}
      {selectedBill && (
        <InvoiceModal bill={selectedBill} onClose={() => setSelectedBill(null)} />
      )}
    </div>
  )
}
