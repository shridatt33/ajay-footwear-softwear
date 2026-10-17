import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import EmptyState from '../components/EmptyState'
import {
  ReportIcon,
  PrintIcon,
  SalesIcon,
  PurchaseIcon,
  StockIcon,
} from '../components/Icons'

export default function ReportsPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadReport = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/reports/summary`)
      if (res.ok) {
        const d = await res.json()
        setSummary(d)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  return (
    <div className="erp-page-container">
      {/* Page Header */}
      <div className="erp-page-header">
        <div>
          <h1 className="page-main-title">Reports &amp; Financial Analytics</h1>
          <p className="page-sub-title">Shop revenue, wholesale purchases, estimated gross profit, and stock valuation.</p>
        </div>
        <div className="page-header-actions no-print">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={async () => {
              if (window.electronAPI && typeof window.electronAPI.printCurrentWindow === 'function') {
                await window.electronAPI.printCurrentWindow({ silent: false, printBackground: true, color: true })
              } else {
                window.print()
              }
            }}
          >
            <PrintIcon size={14} />
            <span>Print Report</span>
          </button>

        </div>
      </div>

      {loading || !summary ? (
        <div className="erp-card" style={{ padding: '32px', textAlign: 'center' }}>
          Loading financial reports...
        </div>
      ) : (
        <div className="printable-area">
          {/* Key Summary KPI Cards */}
          <div className="kpi-cards-grid" style={{ marginBottom: '20px' }}>
            <div className="kpi-card sales-kpi">
              <div className="kpi-icon-wrap sales-icon">
                <SalesIcon size={20} />
              </div>
              <div className="kpi-data">
                <span className="kpi-label">Total Retail Sales</span>
                <div className="kpi-value">{summary.total_sales_formatted}</div>
                <span className="kpi-sub-badge">{summary.total_bills} bills completed</span>
              </div>
            </div>

            <div className="kpi-card purchase-kpi">
              <div className="kpi-icon-wrap purchase-icon">
                <PurchaseIcon size={20} />
              </div>
              <div className="kpi-data">
                <span className="kpi-label">Total Wholesale Purchases</span>
                <div className="kpi-value">{summary.total_purchases_formatted}</div>
                <span className="kpi-sub-badge">{summary.total_pos} inward orders</span>
              </div>
            </div>

            <div className="kpi-card customer-kpi">
              <div className="kpi-icon-wrap customer-icon">
                <SalesIcon size={20} />
              </div>
              <div className="kpi-data">
                <span className="kpi-label">Gross Margin (Profit)</span>
                <div className="kpi-value text-success">{summary.estimated_profit}</div>
                <span className="kpi-sub-badge">Sales - COGS</span>
              </div>
            </div>

            <div className="kpi-card stock-kpi">
              <div className="kpi-icon-wrap stock-icon">
                <StockIcon size={20} />
              </div>
              <div className="kpi-data">
                <span className="kpi-label">Inventory Valuation</span>
                <div className="kpi-value">{summary.stock_retail_value}</div>
                <span className="kpi-sub-badge">{summary.total_stock_units} pairs in store</span>
              </div>
            </div>
          </div>

          {/* Top Selling Products Card */}
          <div className="erp-card table-card" style={{ marginBottom: '20px' }}>
            <div className="card-header-bar">
              <h3 className="card-heading">Top Performing Footwear Models</h3>
            </div>
            <div className="erp-table-responsive">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>#</th>
                    <th>Product Name</th>
                    <th style={{ textAlign: 'center' }}>Units Sold</th>
                    <th style={{ textAlign: 'right' }}>Total Revenue Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {!summary.top_products || summary.top_products.length === 0 ? (
                    <tr>
                      <td colSpan="4">
                        <EmptyState title="No Sales Recorded Yet" description="Complete sales to generate model performance analytics." />
                      </td>
                    </tr>
                  ) : (
                    summary.top_products.map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td className="font-bold">{item.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="items-count-tag">{item.sold} Pairs</span>
                        </td>
                        <td style={{ textAlign: 'right' }} className="font-bold text-primary">
                          {item.revenue}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
