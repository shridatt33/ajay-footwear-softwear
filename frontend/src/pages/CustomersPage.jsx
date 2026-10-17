import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import EmptyState from '../components/EmptyState'
import InvoiceModal from '../components/InvoiceModal'
import {
  CustomerIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  CloseIcon,
  BillIcon,
  PrintIcon,
  ArrowLeftIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  CalendarIcon,
  ShoppingBagIcon,
  SalesIcon,
} from '../components/Icons'
import './CustomersPage.css'

export default function CustomersPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()

  // Master customer list state
  const [customers, setCustomers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  // Dedicated Customer History state
  const [activeCustomerId, setActiveCustomerId] = useState(customerId ? parseInt(customerId, 10) : null)
  const [customerHistory, setCustomerHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // History filtering & search
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('all') // 'all', 'today', 'week', 'month', 'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all') // 'all', 'Cash', 'UPI', 'Add in Account'
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'Paid', 'Unpaid'

  // Invoice Details & Reprint Modal
  const [selectedInvoiceBill, setSelectedInvoiceBill] = useState(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  // Add / Edit Customer Modal
  const [showAddEditModal, setShowAddEditModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    outstanding_amount: 0,
  })

  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' })

  // Load master customers list
  const loadCustomers = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/customers`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch (err) {
      console.error(err)
      setAlertMsg({ type: 'error', text: 'Failed to load customers.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  // Sync with URL parameter
  useEffect(() => {
    if (customerId) {
      const parsedId = parseInt(customerId, 10)
      if (!isNaN(parsedId)) {
        setActiveCustomerId(parsedId)
      }
    } else {
      setActiveCustomerId(null)
      setCustomerHistory(null)
    }
  }, [customerId])

  // Load dedicated customer purchase history when activeCustomerId changes
  const loadCustomerHistory = async (id) => {
    if (!id) return
    try {
      setHistoryLoading(true)
      const res = await fetch(`${API_BASE_URL}/customers/${id}`)
      if (res.ok) {
        const data = await res.json()
        setCustomerHistory(data.customer)
      } else {
        setAlertMsg({ type: 'error', text: 'Customer history not found.' })
      }
    } catch (err) {
      console.error(err)
      setAlertMsg({ type: 'error', text: 'Failed to load customer history.' })
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (activeCustomerId) {
      loadCustomerHistory(activeCustomerId)
    }
  }, [activeCustomerId])

  // Navigation handlers
  const openCustomerHistory = (id) => {
    setActiveCustomerId(id)
    navigate(`/customers/${id}`)
  }

  const closeCustomerHistory = () => {
    setActiveCustomerId(null)
    setCustomerHistory(null)
    navigate('/customers')
  }

  // View / Reprint Invoice Details
  const handleViewInvoiceDetails = async (billId) => {
    try {
      setInvoiceLoading(true)
      const res = await fetch(`${API_BASE_URL}/bills/${billId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedInvoiceBill(data.bill)
      } else {
        alert('Could not load invoice details.')
      }
    } catch (err) {
      console.error(err)
      alert('Error fetching invoice.')
    } finally {
      setInvoiceLoading(false)
    }
  }

  // Modals for Customer creation / editing
  const openAddModal = () => {
    setEditingCustomer(null)
    setFormData({ name: '', phone: '', email: '', address: '', outstanding_amount: 0 })
    setShowAddEditModal(true)
  }

  const openEditModal = (c) => {
    setEditingCustomer(c)
    setFormData({
      name: c.name,
      phone: c.phone === '—' ? '' : c.phone,
      email: c.email === '—' ? '' : c.email,
      address: c.address === '—' ? '' : c.address,
      outstanding_amount: c.outstanding_amount || 0,
    })
    setShowAddEditModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    try {
      const url = editingCustomer
        ? `${API_BASE_URL}/customers/${editingCustomer.id}`
        : `${API_BASE_URL}/customers`
      const method = editingCustomer ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Operation failed')

      setShowAddEditModal(false)
      setAlertMsg({
        type: 'success',
        text: editingCustomer ? 'Customer updated successfully.' : `Customer "${formData.name}" added successfully.`,
      })
      loadCustomers()
      if (activeCustomerId) {
        loadCustomerHistory(activeCustomerId)
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to save customer.' })
    }
  }

  const handleDelete = async (targetId, name) => {
    if (!window.confirm(`Deactivate customer "${name}"?`)) return
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${targetId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      setAlertMsg({ type: 'info', text: `Customer "${name}" deactivated.` })
      loadCustomers()
      if (activeCustomerId === targetId) {
        closeCustomerHistory()
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Delete failed.' })
    }
  }

  // Filter master customers list
  const filteredCustomers = customers.filter((c) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.address && c.address.toLowerCase().includes(term))
    )
  })

  // Filter bills in history view
  const customerBills = customerHistory?.bills || []
  const filteredBills = customerBills.filter((b) => {
    // 1. Invoice search
    if (invoiceSearch.trim()) {
      const searchClean = invoiceSearch.trim().toLowerCase()
      if (!b.bill_no.toLowerCase().includes(searchClean)) {
        return false
      }
    }

    // 2. Date filtering
    if (b.date) {
      const bDate = new Date(b.date)
      const now = new Date()

      if (dateFilter === 'today') {
        if (bDate.toDateString() !== now.toDateString()) return false
      } else if (dateFilter === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(now.getDate() - 7)
        if (bDate < weekAgo) return false
      } else if (dateFilter === 'month') {
        if (bDate.getMonth() !== now.getMonth() || bDate.getFullYear() !== now.getFullYear()) {
          return false
        }
      } else if (dateFilter === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate)
          start.setHours(0, 0, 0, 0)
          if (bDate < start) return false
        }
        if (customEndDate) {
          const end = new Date(customEndDate)
          end.setHours(23, 59, 59, 999)
          if (bDate > end) return false
        }
      }
    }

    // 3. Payment method filter
    if (paymentFilter !== 'all') {
      if (b.payment_mode !== paymentFilter) return false
    }

    // 4. Payment status filter
    if (statusFilter !== 'all') {
      if (b.status !== statusFilter) return false
    }

    return true
  })

  const hasActiveFilters =
    invoiceSearch.trim() !== '' ||
    dateFilter !== 'all' ||
    paymentFilter !== 'all' ||
    statusFilter !== 'all'

  const resetHistoryFilters = () => {
    setInvoiceSearch('')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setPaymentFilter('all')
    setStatusFilter('all')
  }

  // Format currency
  const formatCurrency = (amt) => {
    return `₹${Number(amt || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  // Format date helper
  const formatDateDisplay = (dateStr) => {
    if (!dateStr || dateStr === 'Never') return 'Never'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return String(dateStr)
    }
  }

  const formatDateTimeDisplay = (dateStr) => {
    if (!dateStr || dateStr === 'Never') return '—'
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return String(dateStr)
    }
  }

  // =========================================================================
  // VIEW 1: DEDICATED CUSTOMER DETAILS & PURCHASE HISTORY
  // =========================================================================
  if (activeCustomerId && (customerHistory || historyLoading)) {
    const cust = customerHistory || {}
    const avatarLetter = cust.name ? cust.name.charAt(0).toUpperCase() : 'C'
    const hasOutstanding = Number(cust.outstanding_amount || 0) > 0

    return (
      <div className="erp-page-container">
        {/* Top Header Bar with Back Button */}
        <div className="history-header-bar">
          <div className="history-header-left">
            <button
              type="button"
              className="btn-back"
              onClick={closeCustomerHistory}
              title="Return to customer register"
            >
              <ArrowLeftIcon size={16} />
              <span>Back to Customers</span>
            </button>
            <div className="history-title-group">
              <h1>Customer Details &amp; Purchase History</h1>
              <p>Complete transaction ledger, footwear billing records, and balance tracking.</p>
            </div>
          </div>
          <div className="page-header-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => openEditModal(cust)}
            >
              <EditIcon size={14} />
              <span>Edit Customer Profile</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/billing')}
            >
              <PlusIcon size={14} />
              <span>+ New POS Sale</span>
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

        {historyLoading ? (
          <div className="erp-card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <p>Loading customer profile and complete billing records...</p>
          </div>
        ) : (
          <>
            {/* 1. TOP CUSTOMER PROFILE CARD */}
            <div className="cust-hero-profile-card">
              <div className="cust-hero-left">
                <div className="cust-hero-avatar">{avatarLetter}</div>
                <div className="cust-hero-details">
                  <div className="cust-hero-name-row">
                    <h2 className="cust-hero-name">{cust.name}</h2>
                    <span className="cust-status-badge">Active Customer</span>
                  </div>
                  <div className="cust-hero-meta-grid">
                    <div className="cust-meta-item">
                      <PhoneIcon size={15} />
                      <span><strong>Mobile:</strong> {cust.phone || '—'}</span>
                    </div>
                    <div className="cust-meta-item">
                      <MailIcon size={15} />
                      <span><strong>Email:</strong> {cust.email || '—'}</span>
                    </div>
                    <div className="cust-meta-item">
                      <MapPinIcon size={15} />
                      <span><strong>Billing Address:</strong> {cust.address || '—'}</span>
                    </div>
                    <div className="cust-meta-item">
                      <CalendarIcon size={15} />
                      <span><strong>Last Purchase:</strong> {formatDateDisplay(cust.last_purchase)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Outstanding Balance Highlight Box */}
              <div className={`cust-hero-balance-box ${hasOutstanding ? 'has-dues' : ''}`}>
                <div className="balance-title">Total Outstanding Balance</div>
                <div className={`balance-amount ${hasOutstanding ? 'danger' : ''}`}>
                  {formatCurrency(cust.outstanding_amount)}
                </div>
                <span className={`balance-sub-badge ${hasOutstanding ? 'danger' : ''}`}>
                  {hasOutstanding ? 'Account Dues Pending' : 'Settled / No Dues'}
                </span>
              </div>
            </div>

            {/* 2. CUSTOMER PURCHASE SUMMARY (5 KPI METRIC CARDS) */}
            <div className="cust-kpi-grid">
              {/* Card 1: Total Bills */}
              <div className="cust-kpi-card">
                <div className="cust-kpi-icon-wrap cust-kpi-icon-blue">
                  <BillIcon size={20} />
                </div>
                <div className="cust-kpi-content">
                  <div className="cust-kpi-label">Total Bills</div>
                  <div className="cust-kpi-value">{cust.total_bills ?? 0} Invoices</div>
                  <div className="cust-kpi-sub">Lifetime generated</div>
                </div>
              </div>

              {/* Card 2: Total Pairs Purchased */}
              <div className="cust-kpi-card">
                <div className="cust-kpi-icon-wrap cust-kpi-icon-purple">
                  <ShoppingBagIcon size={20} />
                </div>
                <div className="cust-kpi-content">
                  <div className="cust-kpi-label">Total Pairs Purchased</div>
                  <div className="cust-kpi-value">{cust.total_pairs ?? 0} Pairs</div>
                  <div className="cust-kpi-sub">Across all footwear items</div>
                </div>
              </div>

              {/* Card 3: Total Amount Purchased */}
              <div className="cust-kpi-card">
                <div className="cust-kpi-icon-wrap cust-kpi-icon-indigo">
                  <SalesIcon size={20} />
                </div>
                <div className="cust-kpi-content">
                  <div className="cust-kpi-label">Total Amount Purchased</div>
                  <div className="cust-kpi-value">{formatCurrency(cust.total_spent)}</div>
                  <div className="cust-kpi-sub">Gross purchase value</div>
                </div>
              </div>

              {/* Card 4: Total Amount Paid */}
              <div className="cust-kpi-card">
                <div className="cust-kpi-icon-wrap cust-kpi-icon-green">
                  <CustomerIcon size={20} />
                </div>
                <div className="cust-kpi-content">
                  <div className="cust-kpi-label">Total Amount Paid</div>
                  <div className="cust-kpi-value">{formatCurrency(cust.total_paid)}</div>
                  <div className="cust-kpi-sub">Actual payments received</div>
                </div>
              </div>

              {/* Card 5: Current Outstanding Balance */}
              <div className="cust-kpi-card">
                <div className="cust-kpi-icon-wrap cust-kpi-icon-rose">
                  <BillIcon size={20} />
                </div>
                <div className="cust-kpi-content">
                  <div className="cust-kpi-label">Outstanding Balance</div>
                  <div className="cust-kpi-value" style={{ color: hasOutstanding ? '#e11d48' : '#059669' }}>
                    {formatCurrency(cust.outstanding_amount)}
                  </div>
                  <div className="cust-kpi-sub">{hasOutstanding ? 'Unpaid account dues' : 'Fully cleared'}</div>
                </div>
              </div>
            </div>

            {/* 3. SEARCH & FILTERING CONTROLS */}
            <div className="history-filters-card">
              <div className="history-filter-inputs">
                {/* Search by Invoice Number */}
                <div className="history-search-input-wrap">
                  <SearchIcon size={15} className="search-icon" />
                  <input
                    type="text"
                    className="history-search-input"
                    placeholder="Search by invoice number (e.g. SW-1033)..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                  />
                </div>

                {/* Date Filter Preset */}
                <select
                  className="history-select"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today's Invoices</option>
                  <option value="week">Past 7 Days</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>

                {dateFilter === 'custom' && (
                  <div className="history-custom-dates">
                    <input
                      type="date"
                      className="history-date-picker"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      title="From Date"
                    />
                    <span>to</span>
                    <input
                      type="date"
                      className="history-date-picker"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      title="To Date"
                    />
                  </div>
                )}

                {/* Payment Method Filter */}
                <select
                  className="history-select"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                >
                  <option value="all">All Payment Methods</option>
                  <option value="Cash">Cash Sale</option>
                  <option value="UPI">UPI Digital Payment</option>
                  <option value="Add in Account">Add in Account</option>
                </select>

                {/* Payment Status Filter */}
                <select
                  className="history-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Payment Status</option>
                  <option value="Paid">Paid Only</option>
                  <option value="Unpaid">Unpaid / Dues</option>
                </select>
              </div>

              <div className="history-filter-meta">
                <span className="invoices-counter-badge">
                  Showing {filteredBills.length} of {customerBills.length} Invoices
                </span>
                {hasActiveFilters && (
                  <button type="button" className="btn-reset-filters" onClick={resetHistoryFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* 4. COMPLETE BILLING HISTORY TABLE */}
            <div className="erp-card table-card">
              <div className="erp-table-responsive">
                <table className="erp-table history-invoices-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Invoice Number</th>
                      <th>Invoice Date</th>
                      <th style={{ textAlign: 'center' }}>Items / Pairs</th>
                      <th style={{ textAlign: 'right' }}>Total Bill Amount</th>
                      <th style={{ textAlign: 'center' }}>Payment Method</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                      <th style={{ textAlign: 'right' }}>Outstanding Amount</th>
                      <th style={{ textAlign: 'center' }}>Payment Status</th>
                      <th style={{ textAlign: 'center', width: '110px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerBills.length === 0 ? (
                      <tr>
                        <td colSpan="10">
                          <div className="history-empty-container">
                            <div className="history-empty-icon">
                              <ShoppingBagIcon size={26} />
                            </div>
                            <div className="history-empty-title">No Purchase History Found</div>
                            <p className="history-empty-desc">
                              No sales bills have been generated under {cust.name}'s account yet.
                              Whenever you generate a bill in POS Billing for this customer, it will automatically appear here.
                            </p>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/billing')}
                            >
                              <PlusIcon size={14} />
                              <span>+ Create First Bill in POS</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : filteredBills.length === 0 ? (
                      <tr>
                        <td colSpan="10">
                          <div className="history-empty-container">
                            <div className="history-empty-icon">
                              <SearchIcon size={24} />
                            </div>
                            <div className="history-empty-title">No Invoices Match Your Filters</div>
                            <p className="history-empty-desc">
                              Try clearing your search query or selecting a broader date range or payment filter.
                            </p>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={resetHistoryFilters}
                            >
                              Reset Filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredBills.map((b, idx) => {
                        const billOutstanding = Number(b.outstanding_amount || 0)
                        const isAccount = b.payment_mode === 'Add in Account' || b.payment_mode === 'Credit'

                        return (
                          <tr key={b.id}>
                            <td>{idx + 1}</td>

                            {/* Invoice Number - Clickable */}
                            <td>
                              <button
                                type="button"
                                className="invoice-code-btn"
                                title="Click to view full invoice breakdown & reprint"
                                onClick={() => handleViewInvoiceDetails(b.id)}
                              >
                                <span>#{b.bill_no}</span>
                              </button>
                            </td>

                            {/* Invoice Date */}
                            <td>
                              <span className="date-text">{formatDateTimeDisplay(b.date)}</span>
                            </td>

                            {/* Number of Items / Pairs */}
                            <td style={{ textAlign: 'center' }}>
                              <span className="items-pairs-badge">
                                {b.items_count} {b.items_count === 1 ? 'item' : 'items'} ({b.pairs_count || 0} {b.pairs_count === 1 ? 'pair' : 'pairs'})
                              </span>
                            </td>

                            {/* Total Bill Amount */}
                            <td style={{ textAlign: 'right' }}>
                              <strong className="font-bold">{formatCurrency(b.total_amount)}</strong>
                            </td>

                            {/* Payment Method */}
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className={`payment-method-pill ${
                                  b.payment_mode === 'Cash'
                                    ? 'cash'
                                    : b.payment_mode === 'UPI'
                                    ? 'upi'
                                    : 'account'
                                }`}
                              >
                                {b.payment_mode}
                              </span>
                            </td>

                            {/* Amount Paid */}
                            <td style={{ textAlign: 'right' }}>
                              <span>{formatCurrency(b.amount_paid)}</span>
                            </td>

                            {/* Outstanding Amount */}
                            <td style={{ textAlign: 'right' }}>
                              <span className={billOutstanding > 0 ? 'dues-highlight' : 'dues-settled'}>
                                {formatCurrency(billOutstanding)}
                              </span>
                            </td>

                            {/* Payment Status */}
                            <td style={{ textAlign: 'center' }}>
                              <span className={`status-badge ${b.status === 'Unpaid' ? 'unpaid' : 'paid'}`}>
                                {b.status || 'Paid'}
                              </span>
                            </td>

                            {/* Actions: View Details / Print */}
                            <td style={{ textAlign: 'center' }}>
                              <div className="table-actions-inline">
                                <button
                                  type="button"
                                  className="btn-icon"
                                  title="View Invoice Details"
                                  onClick={() => handleViewInvoiceDetails(b.id)}
                                >
                                  <EyeIcon size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  title="Reprint Invoice"
                                  onClick={() => handleViewInvoiceDetails(b.id)}
                                >
                                  <PrintIcon size={14} />
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
          </>
        )}

        {/* INVOICE DETAILS & REPRINT MODAL */}
        {selectedInvoiceBill && (
          <InvoiceModal
            bill={selectedInvoiceBill}
            onClose={() => setSelectedInvoiceBill(null)}
          />
        )}

        {/* ADD / EDIT CUSTOMER MODAL */}
        {showAddEditModal && (
          <div className="erp-modal-backdrop" onClick={() => setShowAddEditModal(false)}>
            <div className="erp-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
                <button type="button" className="btn-icon" onClick={() => setShowAddEditModal(false)}>
                  <CloseIcon size={14} />
                </button>
              </div>

              <form onSubmit={handleSave}>
                <div className="modal-body form-grid">
                  <div className="form-group">
                    <label>Customer / Party Name *</label>
                    <input
                      type="text"
                      required
                      className="erp-input"
                      placeholder="e.g. Anand Deshmukh"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Mobile Number</label>
                    <input
                      type="tel"
                      className="erp-input"
                      placeholder="10-digit mobile number"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="erp-input"
                      placeholder="Optional email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Address / City</label>
                    <input
                      type="text"
                      className="erp-input"
                      placeholder="Street, Landmark, City"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Opening Outstanding Balance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="erp-input"
                      placeholder="0.00"
                      value={formData.outstanding_amount}
                      onChange={(e) => setFormData({ ...formData, outstanding_amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    {editingCustomer ? 'Save Changes' : 'Create Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: MASTER CUSTOMERS TABLE
  // =========================================================================
  return (
    <div className="erp-page-container">
      {/* Page Header */}
      <div className="erp-page-header">
        <div>
          <h1 className="page-main-title">Parties &amp; Customers</h1>
          <p className="page-sub-title">Maintain customer ledger, purchase histories, and outstanding credit balances.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
            <PlusIcon size={14} />
            <span>+ Add Customer</span>
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

      {/* Search Toolbar */}
      <div className="erp-filter-toolbar">
        <div className="toolbar-search-box">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="erp-input toolbar-input"
            placeholder="Search by customer name, mobile number, address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <span className="results-counter">{filteredCustomers.length} Customers Registered</span>
      </div>

      {/* Customers Table Card */}
      <div className="erp-card table-card">
        <div className="erp-table-responsive">
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th>Customer Name</th>
                <th>Mobile Number</th>
                <th>Address</th>
                <th style={{ textAlign: 'center' }}>Total Bills</th>
                <th style={{ textAlign: 'right' }}>Total Spent</th>
                <th style={{ textAlign: 'right' }}>Outstanding (₹)</th>
                <th>Last Purchase</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="table-loading">Loading customer ledger...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <EmptyState
                      title="No Customers Registered"
                      description="Add your frequent retail or wholesale customers."
                      actionLabel="+ Add Customer"
                      onAction={openAddModal}
                    />
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => (
                  <tr key={c.id}>
                    <td>{idx + 1}</td>

                    {/* Customer Name - Clickable with hover effect */}
                    <td>
                      <button
                        type="button"
                        className="customer-name-link"
                        title="Click to view purchase history & ledger"
                        onClick={() => openCustomerHistory(c.id)}
                      >
                        <span>{c.name}</span>
                      </button>
                      {c.email && c.email !== '—' && (
                        <div className="table-sub-text">{c.email}</div>
                      )}
                    </td>

                    {/* Mobile Number */}
                    <td>
                      <span className="phone-badge">{c.phone}</span>
                    </td>

                    {/* Address */}
                    <td>
                      <span className="address-text">{c.address}</span>
                    </td>

                    {/* Total Bills */}
                    <td style={{ textAlign: 'center' }}>
                      <span className="bills-badge">{c.total_bills}</span>
                    </td>

                    {/* Total Spent */}
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(c.total_spent)}</strong>
                    </td>

                    {/* Outstanding (₹) */}
                    <td style={{ textAlign: 'right' }}>
                      <span className={`balance-badge ${c.outstanding_amount > 0 ? 'debit' : ''}`}>
                        {formatCurrency(c.outstanding_amount)}
                      </span>
                    </td>

                    {/* Last Purchase */}
                    <td>
                      <span className="date-text">
                        {c.last_purchase && c.last_purchase !== 'Never'
                          ? formatDateDisplay(c.last_purchase)
                          : 'Never'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <div className="table-actions-inline">
                        <button
                          type="button"
                          className="btn-icon"
                          title="View Complete Purchase History"
                          onClick={() => openCustomerHistory(c.id)}
                        >
                          <EyeIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit Customer"
                          onClick={() => openEditModal(c)}
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-danger"
                          title="Deactivate"
                          onClick={() => handleDelete(c.id, c.name)}
                        >
                          <TrashIcon size={14} />
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

      {/* ADD / EDIT CUSTOMER MODAL */}
      {showAddEditModal && (
        <div className="erp-modal-backdrop" onClick={() => setShowAddEditModal(false)}>
          <div className="erp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button type="button" className="btn-icon" onClick={() => setShowAddEditModal(false)}>
                <CloseIcon size={14} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label>Customer / Party Name *</label>
                  <input
                    type="text"
                    required
                    className="erp-input"
                    placeholder="e.g. Anand Deshmukh"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Mobile Number</label>
                  <input
                    type="tel"
                    className="erp-input"
                    placeholder="10-digit mobile number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="erp-input"
                    placeholder="Optional email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Address / City</label>
                  <input
                    type="text"
                    className="erp-input"
                    placeholder="Street, Landmark, City"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Opening Outstanding Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="erp-input"
                    placeholder="0.00"
                    value={formData.outstanding_amount}
                    onChange={(e) => setFormData({ ...formData, outstanding_amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingCustomer ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
