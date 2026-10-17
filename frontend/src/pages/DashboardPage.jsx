import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import EmptyState from '../components/EmptyState'
import InvoiceModal from '../components/InvoiceModal'
import {
  BillIcon,
  PurchaseIcon,
  CustomerIcon,
  ProductIcon,
  SalesIcon,
  AlertTriangleIcon,
  PlusIcon,
  EyeIcon,
  RefreshIcon,
  BarcodeNavIcon,
  TrendingUpIcon,
} from '../components/Icons'

function MetricCard({ title, value, subtitle, icon: Icon, colorClass = 'blue' }) {
  return (
    <div className={`metric-kpi-card ${colorClass}`}>
      <div className="metric-kpi-top">
        <div className={`metric-icon-box ${colorClass}`}>
          <Icon size={18} />
        </div>
        <span className="metric-kpi-title">{title}</span>
      </div>
      <div className="metric-kpi-middle">
        <span className="metric-kpi-value">{value}</span>
      </div>
      <div className="metric-kpi-bottom">
        <span className={`metric-kpi-badge ${colorClass}`}>{subtitle}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    today_sales: '₹ 0.00',
    today_bills: '0',
    today_purchases: '₹ 0.00',
    total_customers: 0,
    total_products: 0,
    low_stock_count: 0,
    outstanding_amount: '₹ 0.00',
    low_stock_products: [],
    weekly_sales: [],
    top_products: [],
  })
  const [recentBills, setRecentBills] = useState([])
  const [chartPeriod, setChartPeriod] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [statsRes, billsRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/dashboard/stats`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE_URL}/bills?limit=6`).then((r) => (r.ok ? r.json() : null)),
      ])

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats((prev) => ({ ...prev, ...statsRes.value }))
      }
      if (billsRes.status === 'fulfilled' && billsRes.value) {
        setRecentBills(billsRes.value.bills || [])
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const viewInvoiceDetail = async (billId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/bills/${billId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedBill(data.bill)
      }
    } catch (err) {
      console.error('Failed to load bill detail:', err)
    }
  }

  // Calculate highest weekly value for chart scaling
  const maxWeeklySale = Math.max(
    ...(stats.weekly_sales?.map((w) => w.value) || [1000]),
    1000
  )

  return (
    <div className="dashboard-page">
      {/* 1. Dashboard Header */}
      <div className="dashboard-header-row">
        <div className="dashboard-title-group">
          <h1 className="dashboard-main-title">Business Overview</h1>
          <p className="dashboard-subtitle">
            Real-time daily retail sales, purchases, inventory and customer metrics.
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshIcon size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/billing')}
          >
            <PlusIcon size={15} />
            <span>+ New Sale</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards: Exactly 6 Cards in 3-Column Responsive Grid */}
      <div className="kpi-metric-grid">
        <MetricCard
          title="Today's Sales"
          value={stats.today_sales}
          subtitle={`${stats.today_bills} bills today`}
          icon={BillIcon}
          colorClass="blue"
        />
        <MetricCard
          title="Today's Purchases"
          value={stats.today_purchases}
          subtitle="Stock Inward"
          icon={PurchaseIcon}
          colorClass="purple"
        />
        <MetricCard
          title="Total Customers"
          value={stats.total_customers}
          subtitle="Registered Parties"
          icon={CustomerIcon}
          colorClass="green"
        />
        <MetricCard
          title="Active Products"
          value={stats.total_products}
          subtitle="Catalog Items"
          icon={ProductIcon}
          colorClass="slate"
        />
        <MetricCard
          title="Low Stock Alerts"
          value={stats.low_stock_count}
          subtitle={stats.low_stock_count > 0 ? 'Requires Reorder' : 'All Healthy'}
          icon={AlertTriangleIcon}
          colorClass="red"
        />
        <MetricCard
          title="Outstanding Balance"
          value={stats.outstanding_amount}
          subtitle="Customer Receivables"
          icon={SalesIcon}
          colorClass="amber"
        />
      </div>

      {/* 3. Sales Analytics & Quick Actions (2 Columns: 2fr 1fr) */}
      <div className="dashboard-analytics-row">
        {/* Left: Sales Overview Chart */}
        <div className="erp-section-card chart-section">
          <div className="section-card-header">
            <div className="section-header-titles">
              <h2 className="section-title">Sales Overview</h2>
              <span className="section-caption">Revenue trend across billing days</span>
            </div>
            <div className="period-pill-group">
              <button
                type="button"
                className={`period-btn ${chartPeriod === 'today' ? 'active' : ''}`}
                onClick={() => setChartPeriod('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`period-btn ${chartPeriod === '7d' ? 'active' : ''}`}
                onClick={() => setChartPeriod('7d')}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`period-btn ${chartPeriod === '30d' ? 'active' : ''}`}
                onClick={() => setChartPeriod('30d')}
              >
                30 Days
              </button>
            </div>
          </div>
          <div className="section-card-body chart-body">
            {stats.weekly_sales && stats.weekly_sales.length > 0 ? (
              <div className="erp-chart-wrapper">
                <div className="chart-y-axis">
                  <span>₹{(maxWeeklySale).toLocaleString('en-IN')}</span>
                  <span>₹{(maxWeeklySale * 0.5).toLocaleString('en-IN')}</span>
                  <span>₹0</span>
                </div>
                <div className="chart-bars-container">
                  <div className="chart-grid-lines">
                    <div className="grid-line" />
                    <div className="grid-line" />
                    <div className="grid-line" />
                  </div>
                  <div className="chart-columns">
                    {stats.weekly_sales.map((item, idx) => {
                      const pct = Math.max(6, Math.min(100, Math.round((item.value / maxWeeklySale) * 100)))
                      return (
                        <div key={idx} className="chart-column-item">
                          <div className="chart-column-bar-wrap">
                            <div
                              className="chart-column-bar"
                              style={{ height: `${pct}%` }}
                              title={`${item.day}: ₹${item.value.toLocaleString('en-IN')}`}
                            >
                              <div className="bar-tooltip">₹{item.value.toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                          <span className="chart-column-label">{item.day}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No sales data" description="Complete sales in POS to view trends." />
            )}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="erp-section-card quick-actions-section">
          <div className="section-card-header">
            <div className="section-header-titles">
              <h2 className="section-title">Quick Actions</h2>
              <span className="section-caption">Frequent shop management tasks</span>
            </div>
          </div>
          <div className="section-card-body quick-actions-body">
            <button
              type="button"
              className="quick-action-tile primary-tile"
              onClick={() => navigate('/billing')}
            >
              <div className="quick-action-icon blue">
                <BillIcon size={20} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">+ New Sale</span>
                <span className="quick-action-sub">Open POS &amp; barcode billing</span>
              </div>
            </button>

            <button
              type="button"
              className="quick-action-tile"
              onClick={() => navigate('/products')}
            >
              <div className="quick-action-icon slate">
                <ProductIcon size={20} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">+ Add Product</span>
                <span className="quick-action-sub">Configure multi-size stock</span>
              </div>
            </button>

            <button
              type="button"
              className="quick-action-tile"
              onClick={() => navigate('/customers')}
            >
              <div className="quick-action-icon green">
                <CustomerIcon size={20} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">+ Customer</span>
                <span className="quick-action-sub">Register party ledger</span>
              </div>
            </button>

            <button
              type="button"
              className="quick-action-tile"
              onClick={() => navigate('/purchases')}
            >
              <div className="quick-action-icon purple">
                <PurchaseIcon size={20} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">+ Add Purchase</span>
                <span className="quick-action-sub">Inward wholesale inventory</span>
              </div>
            </button>

            <button
              type="button"
              className="quick-action-tile"
              onClick={() => navigate('/barcodes')}
            >
              <div className="quick-action-icon amber">
                <BarcodeNavIcon size={20} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">+ Generate Barcode</span>
                <span className="quick-action-sub">Print thermal shoe labels</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Recent Sales (Full-Width Table Card) */}
      <div className="erp-section-card recent-sales-section">
        <div className="section-card-header">
          <div className="section-header-titles">
            <h2 className="section-title">Recent Sales</h2>
            <span className="section-caption">Latest customer billing invoices</span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => navigate('/sales')}
          >
            View All Sales
          </button>
        </div>
        <div className="table-responsive">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentBills.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <EmptyState
                      title="No recent sales"
                      description="Create your first sale in POS to see invoices here."
                      actionLabel="+ New Sale"
                      onAction={() => navigate('/billing')}
                    />
                  </td>
                </tr>
              ) : (
                recentBills.map((b) => (
                  <tr key={b.id || b.bill_no}>
                    <td>
                      <span className="badge badge-primary">{b.bill_no}</span>
                    </td>
                    <td>
                      {b.date ? new Date(b.date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      <div className="table-customer-name">{b.customer || 'Walk-in Customer'}</div>
                      {b.phone && <div className="table-sub-text">{b.phone}</div>}
                    </td>
                    <td>
                      <span className="items-count-tag">{b.items_count || b.items || 1} items</span>
                    </td>
                    <td>
                      <strong className="table-amount">{b.amount}</strong>
                    </td>
                    <td>
                      <span className="badge badge-secondary">{b.payment || 'Cash'}</span>
                    </td>
                    <td>
                      <span className="badge badge-success">Paid</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        title="View / Print Invoice"
                        onClick={() => viewInvoiceDetail(b.id)}
                      >
                        <EyeIcon size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Bottom Section: Low Stock & Top Products (2 Columns: 1fr 1fr) */}
      <div className="dashboard-bottom-grid">
        {/* Left: Low Stock Products */}
        <div className="erp-section-card low-stock-section">
          <div className="section-card-header">
            <div className="section-header-titles">
              <h2 className="section-title">Low Stock Products</h2>
              <span className="section-caption">Footwear sizes requiring reorder</span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => navigate('/stock')}
            >
              Stock View
            </button>
          </div>
          <div className="table-responsive">
            <table className="erp-table compact-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Size</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.low_stock_products.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>
                      <span className="text-muted">All inventory levels are healthy.</span>
                    </td>
                  </tr>
                ) : (
                  stats.low_stock_products.slice(0, 5).map((item, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        <span className="code-tag">{item.code || 'FW-GEN'}</span>
                      </td>
                      <td>
                        <span className="size-chip">Size {item.size}</span>
                      </td>
                      <td>
                        <strong className="stock-qty-text">{item.stock} left</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.status === 'Critical' ? 'badge-danger' : 'badge-warning'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Top Selling Products */}
        <div className="erp-section-card top-products-section">
          <div className="section-card-header">
            <div className="section-header-titles">
              <h2 className="section-title">Top Selling Products</h2>
              <span className="section-caption">Best performing footwear models</span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => navigate('/reports')}
            >
              View Reports
            </button>
          </div>
          <div className="table-responsive">
            <table className="erp-table compact-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_products && stats.top_products.length > 0 ? (
                  stats.top_products.slice(0, 5).map((prod, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="top-product-name">
                          <TrendingUpIcon size={14} className="trend-icon" />
                          <span>{prod.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-primary">{prod.sold} pairs sold</span>
                      </td>
                      <td>
                        <strong className="table-amount">{prod.revenue}</strong>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '24px' }}>
                      <span className="text-muted">No sales data recorded yet.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Modal for Viewing and Printing */}
      {selectedBill && (
        <InvoiceModal bill={selectedBill} onClose={() => setSelectedBill(null)} />
      )}
    </div>
  )
}
