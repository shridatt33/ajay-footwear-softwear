import { useEffect, useState, useRef } from 'react'
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
  CalendarIcon,
} from '../components/Icons'
import { generateInvoicePDF } from '../utils/pdfGenerator'
import { useNavigate } from 'react-router-dom'

export default function SalesPage() {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('today') // 'today' | 'yesterday' | 'tomorrow' | 'calendar'
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)
  const dateInputRef = useRef(null)

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

  // Format Date object or ISO string to local YYYY-MM-DD
  const formatLocalDate = (d) => {
    if (!d) return ''
    const dateObj = d instanceof Date ? d : new Date(d)
    if (isNaN(dateObj.getTime())) return ''
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getTodayString = () => formatLocalDate(new Date())

  const getYesterdayString = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return formatLocalDate(d)
  }

  const getTomorrowString = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatLocalDate(d)
  }

  const getActiveTargetDate = () => {
    if (dateFilter === 'yesterday') return getYesterdayString()
    if (dateFilter === 'tomorrow') return getTomorrowString()
    if (dateFilter === 'calendar') return selectedDate
    return getTodayString()
  }

  const getDateLabel = () => {
    if (dateFilter === 'today') return 'today'
    if (dateFilter === 'yesterday') return 'yesterday'
    if (dateFilter === 'tomorrow') return 'tomorrow'
    if (dateFilter === 'calendar' && selectedDate) {
      try {
        const parts = selectedDate.split('-')
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      } catch (_) {
        return selectedDate
      }
    }
    return 'this date'
  }

  // Filter bills by active date filter and search term
  const targetDateStr = getActiveTargetDate()

  const filteredBills = bills.filter((b) => {
    // 1. Date filter (strictly by invoice's creation date/time in local timezone)
    const billLocalDate = formatLocalDate(b.date || b.created_at)
    if (billLocalDate !== targetDateStr) {
      return false
    }

    // 2. Text search (by invoice number, customer name, phone number, payment mode)
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase().trim()
    return (
      (b.bill_no && b.bill_no.toLowerCase().includes(term)) ||
      (b.customer && b.customer.toLowerCase().includes(term)) ||
      (b.phone && String(b.phone).includes(term)) ||
      (b.payment && b.payment.toLowerCase().includes(term))
    )
  })

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
          <div className="filter-pill-group date-filter-pill-group">
            <button
              type="button"
              className={`filter-btn ${dateFilter === 'today' ? 'active' : ''}`}
              onClick={() => setDateFilter('today')}
              title="Show invoices created today"
            >
              Today
            </button>
            <button
              type="button"
              className={`filter-btn ${dateFilter === 'yesterday' ? 'active' : ''}`}
              onClick={() => setDateFilter('yesterday')}
              title="Show invoices created yesterday"
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`filter-btn ${dateFilter === 'tomorrow' ? 'active' : ''}`}
              onClick={() => setDateFilter('tomorrow')}
              title="Show invoices dated tomorrow"
            >
              Tomorrow
            </button>

            <div className={`date-picker-trigger-wrap ${dateFilter === 'calendar' ? 'active' : ''}`}>
              <button
                type="button"
                className={`filter-btn calendar-filter-btn ${dateFilter === 'calendar' ? 'active' : ''}`}
                onClick={() => {
                  setDateFilter('calendar')
                  try {
                    if (dateInputRef.current?.showPicker) {
                      dateInputRef.current.showPicker()
                    } else {
                      dateInputRef.current?.focus()
                    }
                  } catch (_) {
                    dateInputRef.current?.focus()
                  }
                }}
                title={dateFilter === 'calendar' ? `Selected Date: ${selectedDate}` : 'Select specific date from calendar'}
                aria-label="Pick calendar date"
              >
                <CalendarIcon size={15} />
                {dateFilter === 'calendar' && (
                  <span className="calendar-selected-text">
                    {(() => {
                      try {
                        const parts = selectedDate.split('-')
                        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
                        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                      } catch (_) {
                        return selectedDate
                      }
                    })()}
                  </span>
                )}
              </button>
              <input
                ref={dateInputRef}
                type="date"
                className="calendar-hidden-input"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value)
                    setDateFilter('calendar')
                  }
                }}
              />
            </div>
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
                      title="No invoices found for this date"
                      description={
                        searchTerm
                          ? `No sales invoices on ${getDateLabel()} matched "${searchTerm}".`
                          : `No sales invoices were recorded for ${getDateLabel()}.`
                      }
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
