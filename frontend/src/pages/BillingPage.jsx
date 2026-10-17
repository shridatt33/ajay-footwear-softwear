import { useEffect, useRef, useState, useMemo } from 'react'
import { API_BASE_URL, SHOP_INFO } from '../config'
import InvoiceModal from '../components/InvoiceModal'
import BarcodeDisplay from '../components/BarcodeDisplay'
import { generateInvoicePDFData } from '../utils/pdfGenerator'
import './BillingPage.css'
import {
  BillIcon,
  SearchIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  CloseIcon,
  BarcodeNavIcon,
  PrintIcon,
  ArrowLeftIcon,
} from '../components/Icons'

const DEFAULT_SIZES_FALLBACK = [6, 7, 8, 9, 10, 11].map((s) => ({ size: s, stock_quantity: 10 }))

export default function BillingPage() {
  // Master Data
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [nextInvoiceNo, setNextInvoiceNo] = useState('SW-1031')
  const [loading, setLoading] = useState(false)

  // Top Section Fields
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ name: '', phone: '', email: '', address: '' })

  // Cart / Table Items
  // Each row: { row_id, product_id, product_name, product_code, barcode, size, available_sizes, max_stock, quantity, selling_price, total }
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = sessionStorage.getItem('swamidatt_billing_cart')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Bottom Section States
  const [paymentMode, setPaymentMode] = useState('Cash') // 'Cash' | 'UPI' | 'Add in Account'
  const [descriptionNotes, setDescriptionNotes] = useState('')
  const [isRoundOff, setIsRoundOff] = useState(true)
  const [amountReceived, setAmountReceived] = useState('')
  const [heldBills, setHeldBills] = useState([])

  // Integrated Barcode Scanner Input & Status
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scannerStatus, setScannerStatus] = useState({ type: 'ready', text: 'Ready to Scan' })

  // Operations & Modals
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' })
  const [isSavingInvoice, setIsSavingInvoice] = useState(false)
  const [completedInvoice, setCompletedInvoice] = useState(null)
  const [previewModalBill, setPreviewModalBill] = useState(null)

  // Refs
  const scannerInputRef = useRef(null)
  const cartItemsRef = useRef(cartItems)
  const isProcessingScanRef = useRef(false)
  const lastScanRef = useRef({ code: '', time: 0 })

  useEffect(() => {
    cartItemsRef.current = cartItems
    try {
      sessionStorage.setItem('swamidatt_billing_cart', JSON.stringify(cartItems))
    } catch {
      // ignore
    }
  }, [cartItems])

  // Automatically focus barcode input when the billing page opens
  useEffect(() => {
    scannerInputRef.current?.focus()
  }, [])

  // Audio Feedback (Beep on scan / error)
  const playBeep = (type = 'success') => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.08)
      } else {
        osc.frequency.setValueAtTime(260, ctx.currentTime)
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.22)
      }
    } catch {
      // Audio unavailable
    }
  }

  // Load initial master data & next bill number
  useEffect(() => {
    const loadInitData = async () => {
      try {
        setLoading(true)
        const [prodRes, custRes, numRes] = await Promise.all([
          fetch(`${API_BASE_URL}/products`),
          fetch(`${API_BASE_URL}/customers`),
          fetch(`${API_BASE_URL}/billing/next-number`).catch(() => null),
        ])

        if (prodRes.ok) {
          const d = await prodRes.json()
          setProducts(d.products || [])
        }
        if (custRes.ok) {
          const d = await custRes.json()
          setCustomers(d.customers || [])
        }
        if (numRes && numRes.ok) {
          const d = await numRes.json()
          if (d.next_bill_no) setNextInvoiceNo(d.next_bill_no)
        }
      } catch (err) {
        console.error('Billing initialization error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadInitData()
  }, [])

  // Customer Selection Handler
  const handleCustomerChange = (e) => {
    const custId = e.target.value
    setSelectedCustomerId(custId)
    if (!custId) {
      setCustomerPhone('')
      setBillingAddress('')
    } else {
      const cust = customers.find((c) => String(c.id) === String(custId))
      if (cust) {
        setCustomerPhone(cust.phone && cust.phone !== '—' ? cust.phone : '')
        setBillingAddress(cust.address || '')
      }
    }
  }

  // Quick Customer Creation
  const handleQuickAddCustomer = async (e) => {
    e.preventDefault()
    if (!newCustForm.name.trim()) return

    try {
      const res = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to add customer')

      const created = data.customer
      setCustomers((prev) => [...prev, created])
      setSelectedCustomerId(String(created.id))
      setCustomerPhone(created.phone || '')
      setBillingAddress(created.address || '')
      setShowAddCustomerModal(false)
      setNewCustForm({ name: '', phone: '', email: '', address: '' })
      setAlertMsg({ type: 'success', text: `Customer "${created.name}" created and selected!` })
    } catch (err) {
      alert(err.message)
    }
  }

  // Payment Mode selection (Cash, UPI, Add in Account)
  const handleSelectPaymentMode = (mode) => {
    setPaymentMode(mode)
    if (mode === 'Add in Account') {
      setAmountReceived('0')
    } else {
      if (amountReceived === '0') setAmountReceived('')
    }
  }

  // Add Product to Cart / Billing Table (with Duplicate Prevention & Quantity Merging)
  const addProductToTable = (product, targetSize = null, qtyToAdd = 1) => {
    if (!product) return false

    const availableSizes = (product.sizes || []).filter(
      (s) => Number(s.stock_quantity ?? s.stock ?? 0) > 0
    )

    if (availableSizes.length === 0 && (product.total_stock ?? product.stock ?? 0) <= 0) {
      playBeep('error')
      setAlertMsg({
        type: 'error',
        text: `Product "${product.product_name}" is completely Out of Stock.`,
      })
      return false
    }

    // Determine size to use
    let sizeNum = targetSize !== null ? Number(targetSize) : null
    if (sizeNum === null) {
      const primarySizeObj = availableSizes[0] || (product.sizes && product.sizes[0])
      sizeNum = primarySizeObj ? Number(primarySizeObj.size) : 7
    }

    const sizeObj = (product.sizes || []).find((s) => Number(s.size) === sizeNum)
    const maxStock = sizeObj ? Number(sizeObj.stock_quantity ?? sizeObj.stock ?? 0) : 100

    const currentCart = cartItemsRef.current || cartItems
    const existingIndex = currentCart.findIndex(
      (it) => it.product_id === product.id && Number(it.size) === sizeNum
    )

    if (existingIndex >= 0) {
      // Item already in table -> increment quantity
      const existing = currentCart[existingIndex]
      const newQty = existing.quantity + qtyToAdd

      if (newQty > maxStock && maxStock > 0) {
        playBeep('error')
        setAlertMsg({
          type: 'error',
          text: `Only ${maxStock} units of Size ${sizeNum} available for "${product.product_name}".`,
        })
        return false
      }

      const updated = [...currentCart]
      const newTotal = Math.round(newQty * existing.selling_price * 100) / 100
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        total: newTotal,
      }
      setCartItems(updated)
      playBeep('success')
      setAlertMsg({
        type: 'success',
        text: `Updated "${product.product_name}" (Size ${sizeNum}) quantity to ${newQty}.`,
      })
      return true
    } else {
      // New row entry
      const sellingPrice = Number(product.selling_price || 0)
      const lineTotal = Math.round(qtyToAdd * sellingPrice * 100) / 100

      const newRow = {
        row_id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        product_id: product.id,
        product_name: product.product_name,
        product_code: product.product_code || `FW-${product.id}`,
        barcode: product.barcode || '',
        size: sizeNum,
        available_sizes: product.sizes || [],
        max_stock: maxStock,
        quantity: qtyToAdd,
        selling_price: sellingPrice,
        total: lineTotal,
      }

      const updated = [...currentCart, newRow]
      setCartItems(updated)
      playBeep('success')
      setAlertMsg({
        type: 'success',
        text: `Added "${product.product_name}" (Size ${sizeNum}) to invoice.`,
      })
      return true
    }
  }

  // Add Blank Row for Manual Product Selection
  const handleAddManualRow = () => {
    const blankRow = {
      row_id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      product_id: null,
      product_name: '',
      product_code: '',
      barcode: '',
      size: 7,
      available_sizes: DEFAULT_SIZES_FALLBACK,
      max_stock: 999,
      quantity: 1,
      selling_price: 0,
      total: 0,
    }
    setCartItems((prev) => [...prev, blankRow])
  }

  // Row Product Selection
  const handleRowProductSelect = (rowIndex, productId) => {
    if (!productId) {
      const updated = [...cartItems]
      updated[rowIndex] = {
        ...updated[rowIndex],
        product_id: null,
        product_name: '',
        product_code: '',
        barcode: '',
        selling_price: 0,
        total: 0,
      }
      setCartItems(updated)
      return
    }

    const prod = products.find((p) => String(p.id) === String(productId))
    if (!prod) return

    const inStockSizes = (prod.sizes || []).filter((s) => Number(s.stock_quantity ?? s.stock ?? 0) > 0)
    const sizeToUse = inStockSizes.length > 0 ? Number(inStockSizes[0].size) : Number(prod.sizes?.[0]?.size || 7)
    const sizeObj = (prod.sizes || []).find((s) => Number(s.size) === sizeToUse)
    const maxStock = sizeObj ? Number(sizeObj.stock_quantity ?? sizeObj.stock ?? 0) : 100
    const price = Number(prod.selling_price || 0)
    const qty = cartItems[rowIndex]?.quantity || 1

    const updated = [...cartItems]
    updated[rowIndex] = {
      ...updated[rowIndex],
      product_id: prod.id,
      product_name: prod.product_name,
      product_code: prod.product_code || `FW-${prod.id}`,
      barcode: prod.barcode || '',
      size: sizeToUse,
      available_sizes: prod.sizes || [],
      max_stock: maxStock,
      selling_price: price,
      total: Math.round(qty * price * 100) / 100,
    }
    setCartItems(updated)
  }

  // Row Field Updates (Quantity, Size, Selling Price)
  const handleUpdateRowField = (rowIndex, field, value) => {
    const updated = [...cartItems]
    const item = { ...updated[rowIndex] }

    if (field === 'quantity') {
      const q = Math.max(1, parseInt(value, 10) || 1)
      item.quantity = q
      item.total = Math.round(q * item.selling_price * 100) / 100
    } else if (field === 'size') {
      const sz = Number(value)
      item.size = sz
      const szObj = (item.available_sizes || []).find((s) => Number(s.size) === sz)
      item.max_stock = szObj ? Number(szObj.stock_quantity ?? szObj.stock ?? 0) : 100
    } else if (field === 'selling_price') {
      const p = Math.max(0, parseFloat(value) || 0)
      item.selling_price = p
      item.total = Math.round(item.quantity * p * 100) / 100
    }

    updated[rowIndex] = item
    setCartItems(updated)
  }

  // Remove Row
  const handleRemoveRow = (rowIndex) => {
    setCartItems((prev) => prev.filter((_, idx) => idx !== rowIndex))
  }

  // Clear All
  const handleClearCart = () => {
    if (cartItems.length === 0) return
    if (window.confirm('Clear all products from this invoice?')) {
      setCartItems([])
      sessionStorage.removeItem('swamidatt_billing_cart')
      setAmountReceived('')
      setAlertMsg({ type: '', text: '' })
    }
  }

  // Barcode Scanner Processing (USB / Wireless Keyboard-Emulation Scanner + Enter)
  const processBarcodeScan = async (rawInput) => {
    const rawCode = String(rawInput || '').replace(/[\r\n]/g, '').trim()
    if (!rawCode) return

    const now = Date.now()
    if (lastScanRef.current.code === rawCode && now - lastScanRef.current.time < 300) return
    if (isProcessingScanRef.current) return

    isProcessingScanRef.current = true
    lastScanRef.current = { code: rawCode, time: now }

    setBarcodeInput('')
    setScannerStatus({ type: 'scanning', text: 'Scanning...' })

    try {
      const cleanUpper = rawCode.toUpperCase()
      // 1. Search in preloaded products
      let found = products.find(
        (p) =>
          (p.barcode && String(p.barcode).trim() === rawCode) ||
          (p.product_code && String(p.product_code).trim().toUpperCase() === cleanUpper) ||
          String(p.id) === rawCode
      )

      // 2. Lookup barcode from API
      if (!found) {
        try {
          const res = await fetch(`${API_BASE_URL}/products/barcode/${encodeURIComponent(rawCode)}`)
          if (res.ok) {
            const data = await res.json()
            if (data.product) found = data.product
          }
        } catch {
          // ignore
        }
      }

      // 3. Fallback search
      if (!found) {
        try {
          const searchRes = await fetch(`${API_BASE_URL}/products?search=${encodeURIComponent(rawCode)}`)
          if (searchRes.ok) {
            const data = await searchRes.json()
            const prods = data.products || []
            found = prods.find(
              (p) =>
                (p.barcode && String(p.barcode).trim() === rawCode) ||
                (p.product_code && String(p.product_code).trim().toUpperCase() === cleanUpper)
            ) || (prods.length === 1 ? prods[0] : null)
          }
        } catch {
          // ignore
        }
      }

      if (!found) {
        playBeep('error')
        setAlertMsg({ type: 'error', text: `Product not found for barcode / SKU: "${rawCode}".` })
        setScannerStatus({ type: 'error', text: `Not Found: "${rawCode}"` })
        setTimeout(() => setScannerStatus({ type: 'ready', text: 'Ready to Scan' }), 2500)
        return
      }

      const added = addProductToTable(found, null, 1)
      if (added) {
        setScannerStatus({ type: 'success', text: `Added: ${found.product_name}` })
        setTimeout(() => setScannerStatus({ type: 'ready', text: 'Ready to Scan' }), 2000)
      }
    } finally {
      isProcessingScanRef.current = false
      // Refocus scanner input for continuous consecutive scanning
      setTimeout(() => {
        scannerInputRef.current?.focus()
      }, 50)
    }
  }

  // Keyboard shortcut listener (F9 for Save & Print, and global continuous barcode scanning redirect)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F9: Save & Print Bill
      if (e.key === 'F9') {
        e.preventDefault()
        if (cartItems.length > 0 && !isSavingInvoice) {
          handleSaveAndPrintBill()
        }
        return
      }

      // If user is currently focused on an input, textarea, or select, let them type normally
      const activeEl = document.activeElement
      const isFormElement =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable)

      if (!isFormElement) {
        // If a modal dialog is open, do not redirect keys
        if (showAddCustomerModal || previewModalBill || completedInvoice) return

        // Printable key received from keyboard or barcode scanner
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (scannerInputRef.current && activeEl !== scannerInputRef.current) {
            scannerInputRef.current.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cartItems, isSavingInvoice, showAddCustomerModal, previewModalBill, completedInvoice])

  // Calculations Summary (Direct Price * Quantity without Discount or GST)
  const validItems = useMemo(() => cartItems.filter((it) => it.product_id), [cartItems])
  const subtotal = useMemo(
    () => validItems.reduce((acc, it) => acc + (it.quantity * it.selling_price), 0),
    [validItems]
  )

  const grandTotal = isRoundOff ? Math.round(subtotal) : Math.round(subtotal * 100) / 100
  const roundOffAmount = isRoundOff ? Math.round((grandTotal - subtotal) * 100) / 100 : 0

  const receivedNum = parseFloat(amountReceived) || 0
  const isAccountMode = paymentMode === 'Add in Account'
  const isChangeReturn = !isAccountMode && receivedNum >= grandTotal
  const changeOrDueAmount = isAccountMode
    ? Math.max(0, grandTotal - receivedNum)
    : Math.abs(receivedNum - grandTotal)

  // Customer Display Name
  const selectedCustomerObj = customers.find((c) => String(c.id) === String(selectedCustomerId))
  const customerDisplayName = selectedCustomerObj ? selectedCustomerObj.name : 'Walk-in Customer'

  // Hold Bill functionality
  const handleHoldBill = () => {
    if (cartItems.length === 0) {
      setAlertMsg({ type: 'error', text: 'Cannot hold an empty invoice.' })
      return
    }
    const draft = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      customer: selectedCustomerObj,
      items: cartItems,
      paymentMode,
      descriptionNotes,
    }
    setHeldBills((prev) => [...prev, draft])
    setCartItems([])
    sessionStorage.removeItem('swamidatt_billing_cart')
    setAlertMsg({ type: 'info', text: 'Invoice held as draft. You can restore it anytime from Held Bills.' })
  }

  const handleRestoreHeldBill = (draftId) => {
    const draft = heldBills.find((d) => d.id === draftId)
    if (!draft) return
    setCartItems(draft.items)
    if (draft.customer) {
      setSelectedCustomerId(String(draft.customer.id))
      setCustomerPhone(draft.customer.phone || '')
      setBillingAddress(draft.customer.address || '')
    }
    setPaymentMode(draft.paymentMode || 'Cash')
    setDescriptionNotes(draft.descriptionNotes || '')
    setHeldBills((prev) => prev.filter((d) => d.id !== draftId))
    setAlertMsg({ type: 'success', text: 'Draft invoice restored to active billing table.' })
  }

  // Primary Action: SAVE & PRINT BILL
  const handleSaveAndPrintBill = async () => {
    if (isSavingInvoice) return

    // 1. Validations
    if (validItems.length === 0) {
      playBeep('error')
      setAlertMsg({ type: 'error', text: 'Please add at least one footwear item to the invoice before saving.' })
      return
    }

    // Validation: Add in Account requires a registered customer
    if (paymentMode === 'Add in Account' && !selectedCustomerId) {
      playBeep('error')
      setAlertMsg({
        type: 'error',
        text: 'Please select a registered customer to add this bill to their account.',
      })
      return
    }

    for (const it of validItems) {
      if (!it.size) {
        setAlertMsg({ type: 'error', text: `Please select size for "${it.product_name}".` })
        return
      }
      if (it.quantity <= 0) {
        setAlertMsg({ type: 'error', text: `Invalid quantity for "${it.product_name}".` })
        return
      }
    }

    try {
      setIsSavingInvoice(true)
      setAlertMsg({ type: 'info', text: 'Saving invoice to database & generating print...' })

      const isAccount = paymentMode === 'Add in Account'
      const checkoutPayload = {
        customer_id: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
        customer_name: customerDisplayName,
        customer_phone: customerPhone,
        billing_address: billingAddress,
        state_of_supply: '27-Maharashtra',
        terms_conditions: '',
        description: descriptionNotes,
        payment_mode: paymentMode,
        subtotal: subtotal,
        discount: 0,
        tax: 0,
        round_off: roundOffAmount,
        amount_received: isAccount ? (receivedNum > 0 ? receivedNum : 0) : (receivedNum > 0 ? receivedNum : grandTotal),
        change_returned: !isAccount && isChangeReturn ? changeOrDueAmount : 0,
        items: validItems.map((item) => ({
          product_id: item.product_id,
          size: item.size,
          quantity: item.quantity,
          selling_price: item.selling_price,
          barcode: item.barcode,
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: 0,
          tax_amount: 0,
          total_price: item.total,
        })),
      }

      // Save to database
      const res = await fetch(`${API_BASE_URL}/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Checkout failed')

      playBeep('success')
      const savedBill = data.bill

      // Auto save PDF
      try {
        const pdfData = generateInvoicePDFData(savedBill)
        if (pdfData) {
          if (window.electronAPI && typeof window.electronAPI.saveInvoicePdf === 'function') {
            await window.electronAPI.saveInvoicePdf({
              billNo: savedBill.bill_no,
              pdfBase64: pdfData.pdfBase64,
            })
          }
          await fetch(`${API_BASE_URL}/bills/${savedBill.id}/save-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bill_no: savedBill.bill_no,
              pdf_base64: pdfData.pdfBase64,
            }),
          })
        }
      } catch (pdfErr) {
        console.warn('PDF save error notice:', pdfErr)
      }

      // Set completed invoice for preview / reprint
      setCompletedInvoice(savedBill)

      // Open native print dialog with invoice content
      try {
        if (window.electronAPI && typeof window.electronAPI.printInvoice === 'function') {
          await window.electronAPI.printInvoice({ bill: savedBill, printType: 'a4' })
        } else {
          // In web browser, allow modal DOM to mount before triggering window.print
          setTimeout(() => {
            window.print()
          }, 300)
        }
      } catch (printErr) {
        console.warn('Print trigger note:', printErr)
      }


      // Reset billing form for next invoice
      setCartItems([])
      sessionStorage.removeItem('swamidatt_billing_cart')
      setAmountReceived('')
      setDescriptionNotes('')
      setAlertMsg({
        type: 'success',
        text: `Invoice ${savedBill.bill_no} successfully saved and printed! Stock updated.`,
      })

      // Fetch next bill number
      fetch(`${API_BASE_URL}/billing/next-number`)
        .then((r) => r.json())
        .then((d) => d.next_bill_no && setNextInvoiceNo(d.next_bill_no))
        .catch(() => {})

      // Refresh product list for updated stock
      fetch(`${API_BASE_URL}/products`)
        .then((r) => r.json())
        .then((d) => setProducts(d.products || []))
        .catch(() => {})

      // Refresh customers list for updated balance
      fetch(`${API_BASE_URL}/customers`)
        .then((r) => r.json())
        .then((d) => setCustomers(d.customers || []))
        .catch(() => {})
    } catch (err) {
      playBeep('error')
      setAlertMsg({ type: 'error', text: err.message || 'Failed to complete billing transaction.' })
    } finally {
      setIsSavingInvoice(false)
    }
  }

  // Preview Provisional Invoice
  const handleOpenPreview = () => {
    const provisional = {
      bill_no: nextInvoiceNo,
      created_at: new Date().toISOString(),
      customer_name: customerDisplayName,
      customer_phone: customerPhone,
      billing_address: billingAddress,
      payment_mode: paymentMode,
      subtotal: subtotal,
      discount: 0,
      tax: 0,
      round_off: roundOffAmount,
      total_amount: grandTotal,
      terms_conditions: '',
      description: descriptionNotes,
      status: paymentMode === 'Add in Account' ? 'UNPAID' : 'PROVISIONAL',
      items: validItems.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        product_code: it.product_code,
        barcode: it.barcode,
        size: it.size,
        quantity: it.quantity,
        selling_price: it.selling_price,
        total_price: it.total,
      })),
    }
    setPreviewModalBill(provisional)
  }  // =========================================================================
  // VIEW: UNIFIED DESKTOP POS BILLING & INVOICE GENERATION PAGE
  // =========================================================================
  return (
    <div className="desktop-billing-wrapper">
      {/* -------------------------------------------------------------------
          1. TOP SECTION CARD: Customer and Invoice Details
          - Title & Store Badge
          - 5 Horizontal Fields: Customer Name, Phone, Address, Inv No, Date
          ------------------------------------------------------------------- */}
      <div className="billing-header-card no-print">
        <div className="billing-header-top-row">
          <div className="billing-title-group">
            <h1 className="billing-main-heading">
              <BillIcon size={22} />
              <span>Sale / Tax Invoice</span>
            </h1>
            <span className="billing-shop-badge">{SHOP_INFO.name}</span>
          </div>

          {/* Right Tools: Held Bills */}
          <div className="billing-header-tools">
            {heldBills.length > 0 && (
              <div className="held-bills-bar" style={{ margin: 0 }}>
                {heldBills.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="held-chip"
                    onClick={() => handleRestoreHeldBill(d.id)}
                    title="Restore held bill"
                  >
                    Draft ({d.items.length} items)
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Fields Grid (5 Clean Columns: Name, Phone, Address, Inv No, Date) */}
        <div className="billing-fields-grid">
          {/* Customer Dropdown + New Customer */}
          <div className="bill-field-col">
            <label className="bill-field-label">
              <span>Customer Name</span>
              <button
                type="button"
                className="btn-add-customer-quick"
                onClick={() => setShowAddCustomerModal(true)}
              >
                <PlusIcon size={11} />
                <span>+ New</span>
              </button>
            </label>
            <select
              className="bill-field-select"
              value={selectedCustomerId}
              onChange={handleCustomerChange}
            >
              <option value="">Walk-in Customer (General)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone && c.phone !== '—' ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Phone */}
          <div className="bill-field-col">
            <label className="bill-field-label">Customer Mobile</label>
            <input
              type="tel"
              className="bill-field-input"
              placeholder="10-digit mobile"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          {/* Billing Address */}
          <div className="bill-field-col">
            <label className="bill-field-label">Billing Address</label>
            <input
              type="text"
              className="bill-field-input"
              placeholder="City, locality, state"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
            />
          </div>

          {/* Invoice Number (Auto Generated) */}
          <div className="bill-field-col">
            <label className="bill-field-label">Invoice No.</label>
            <input
              type="text"
              readOnly
              className="bill-field-input invoice-no-highlight"
              value={nextInvoiceNo}
              title="Automatically generated invoice number"
            />
          </div>

          {/* Invoice Date */}
          <div className="bill-field-col">
            <label className="bill-field-label">Invoice Date</label>
            <input
              type="date"
              className="bill-field-input"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMsg.text && (
        <div className={`erp-alert-banner ${alertMsg.type} no-print`} style={{ marginBottom: '14px' }}>
          <span>{alertMsg.text}</span>
          <button type="button" className="alert-close" onClick={() => setAlertMsg({ type: '', text: '' })}>
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------------
          2. INTEGRATED BARCODE SCANNER SECTION
          - Directly below Customer & Invoice Details
          - Prominent barcode/SKU input field for USB and wireless 2D scanners
          - Continuous scanning autofocus and live scan status badge
          - Success and error feedback with duplicate scan debounce
          - Fallback manual '+ Add Row' button & items counter
          ------------------------------------------------------------------- */}
      <div className="billing-scanner-card no-print">
        <form
          className="unified-scanner-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (barcodeInput.trim()) processBarcodeScan(barcodeInput)
          }}
        >
          <div className="unified-scanner-input-wrap">
            <BarcodeNavIcon size={20} className="unified-scanner-icon" />
            <input
              ref={scannerInputRef}
              type="text"
              className="unified-scanner-input"
              placeholder="Scan Footwear Barcode / SKU (USB or Wireless Scanner), or type & press Enter..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            {barcodeInput && (
              <button
                type="button"
                className="scanner-clear-btn"
                onClick={() => {
                  setBarcodeInput('')
                  scannerInputRef.current?.focus()
                }}
                title="Clear input"
              >
                <CloseIcon size={12} />
              </button>
            )}
          </div>

          <div className={`unified-scanner-status-badge status-${scannerStatus.type}`}>
            <span className="scanner-status-dot" />
            <span className="scanner-status-text">{scannerStatus.text}</span>
          </div>

          <button type="submit" className="btn-scanner-submit" title="Scan or add item">
            <SearchIcon size={15} />
            <span>Scan / Add</span>
          </button>
        </form>

        <div className="scanner-card-actions">
          <button
            type="button"
            className="btn-add-table-row"
            onClick={handleAddManualRow}
            title="Add blank row for manual footwear selection"
          >
            <PlusIcon size={13} />
            <span>+ Add Row</span>
          </button>
          <span className="table-items-count-pill">
            {validItems.length} Products ({validItems.reduce((acc, it) => acc + it.quantity, 0)} Pairs)
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          3. UNIFIED PRODUCT BILLING TABLE CARD
          - Clean 8 columns without Discount or GST
          - Matching scanned items appear immediately
          ------------------------------------------------------------------- */}
      <div className="billing-table-card no-print">
        <div className="desktop-billing-table-wrap">
          <table className="desktop-billing-table">
            <thead>
              <tr>
                <th style={{ width: '44px', textAlign: 'center' }}>Sr.</th>
                <th style={{ minWidth: '260px' }}>Product / Footwear Name</th>
                <th style={{ width: '140px' }}>Barcode / SKU</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Size / Unit</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Price/Unit (₹)</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Final Amount</th>
                <th style={{ width: '48px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty-row">
                    <div className="table-empty-msg">
                      <BarcodeNavIcon size={36} color="#94a3b8" />
                      <strong>No products added yet.</strong>
                      <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Scan footwear barcode / SKU using the input field above, or click <b>+ Add Row</b> to select from catalog.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                cartItems.map((row, idx) => (
                  <tr key={row.row_id || idx}>
                    {/* 1. Sr. No. */}
                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      {idx + 1}
                    </td>

                    {/* 2. Product Name (Select / Search) */}
                    <td>
                      <select
                        className="tbl-cell-select"
                        value={row.product_id || ''}
                        onChange={(e) => handleRowProductSelect(idx, e.target.value)}
                      >
                        <option value="">-- Choose Footwear Model --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.product_name} ({p.product_code || `FW-${p.id}`}) - ₹{p.selling_price}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 3. Barcode / SKU */}
                    <td>
                      <span className="tbl-sku-badge" title={row.barcode ? `Barcode: ${row.barcode}` : 'SKU'}>
                        {row.product_code || row.barcode || '—'}
                      </span>
                    </td>

                    {/* 4. Quantity */}
                    <td style={{ textAlign: 'center' }}>
                      <div className="tbl-qty-wrap">
                        <input
                          type="number"
                          min="1"
                          max={row.max_stock > 0 ? row.max_stock : 999}
                          className="tbl-qty-input"
                          value={row.quantity}
                          onChange={(e) => handleUpdateRowField(idx, 'quantity', e.target.value)}
                        />
                      </div>
                    </td>

                    {/* 5. Unit / Size */}
                    <td style={{ textAlign: 'center' }}>
                      <select
                        className="tbl-cell-select"
                        style={{ textAlign: 'center' }}
                        value={row.size || 7}
                        onChange={(e) => handleUpdateRowField(idx, 'size', e.target.value)}
                      >
                        {(row.available_sizes && row.available_sizes.length > 0
                          ? row.available_sizes
                          : DEFAULT_SIZES_FALLBACK
                        ).map((s) => (
                          <option key={s.size} value={s.size}>
                            Size {s.size} {s.stock_quantity !== undefined ? `(${s.stock_quantity})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 6. Price per Unit */}
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="tbl-cell-input"
                        style={{ textAlign: 'right', fontWeight: 600 }}
                        value={row.selling_price}
                        onChange={(e) => handleUpdateRowField(idx, 'selling_price', e.target.value)}
                      />
                    </td>

                    {/* 7. Final Amount (Price * Qty) */}
                    <td style={{ textAlign: 'right' }}>
                      <span className="tbl-row-amount">
                        ₹{Number(row.total || 0).toFixed(2)}
                      </span>
                    </td>

                    {/* 8. Action (Remove) */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="tbl-remove-btn"
                        onClick={() => handleRemoveRow(idx)}
                        title="Remove product"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          3. BOTTOM BILLING SECTION
          - Left: Payment Type (Cash, UPI, Add in Account), Notes / Description
          - Right: Subtotal, Round Off, Grand Total, Amount Received, Balance Due / Change
          ------------------------------------------------------------------- */}
      <div className="billing-bottom-grid no-print">
        {/* Left Side: Payment Type & Notes */}
        <div className="billing-bottom-left-card">
          {/* Payment Type */}
          <div>
            <div className="bottom-section-title">Payment Type</div>
            <div className="payment-type-pills">
              {['Cash', 'UPI', 'Add in Account'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`pay-pill-btn ${paymentMode === mode ? 'active' : ''} ${mode === 'Add in Account' ? 'pill-account' : ''}`}
                  onClick={() => handleSelectPaymentMode(mode)}
                >
                  {paymentMode === mode && <CheckIcon size={13} />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>
            {paymentMode === 'Add in Account' && (
              <div className="account-mode-hint">
                <span>Dues will be added to the selected customer's account balance.</span>
              </div>
            )}
          </div>

          {/* Optional Invoice Description / Notes */}
          <div className="notes-section-wrap">
            <div className="bottom-section-title">Invoice Notes / Description</div>
            <textarea
              className="bottom-textarea notes-textarea-full"
              rows={4}
              value={descriptionNotes}
              onChange={(e) => setDescriptionNotes(e.target.value)}
              placeholder="Customer reference, remarks, payment note, or warranty details..."
            />
          </div>
        </div>

        {/* Right Side: Invoice Totals Summary */}
        <div className="billing-bottom-right-card">
          <div className="summary-rows-wrap">
            {/* Subtotal */}
            <div className="summary-calc-row">
              <span>Subtotal:</span>
              <strong>₹{subtotal.toFixed(2)}</strong>
            </div>

            {/* Round Off Option */}
            <div className="summary-calc-row round-off-row">
              <label className="round-off-checkbox-label">
                <input
                  type="checkbox"
                  checked={isRoundOff}
                  onChange={(e) => setIsRoundOff(e.target.checked)}
                />
                <span>Round Off Total</span>
              </label>
              <span style={{ fontWeight: 600, color: '#475569' }}>
                {roundOffAmount !== 0 ? `${roundOffAmount > 0 ? '+' : ''}₹${roundOffAmount.toFixed(2)}` : '₹0.00'}
              </span>
            </div>

            {/* Grand Total Box */}
            <div className="grand-total-highlight-box">
              <span className="gt-box-label">Grand Total:</span>
              <span className="gt-box-value">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>

            {/* Amount Received & Balance Due */}
            <div className="received-balance-grid">
              <div className="rb-col">
                <label className="rb-label">
                  {paymentMode === 'Add in Account' ? 'Amount Received Now (₹)' : 'Amount Received (₹)'}
                </label>
                <input
                  type="number"
                  min="0"
                  className="rb-input"
                  placeholder={paymentMode === 'Add in Account' ? '0' : String(grandTotal)}
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                />
              </div>

              <div className="rb-col">
                <label className="rb-label">
                  {paymentMode === 'Add in Account'
                    ? 'Add to Account Dues'
                    : isChangeReturn
                    ? 'Change Return'
                    : 'Balance Due'}
                </label>
                <div
                  className={`rb-status-badge ${
                    paymentMode === 'Add in Account'
                      ? 'account-due'
                      : isChangeReturn
                      ? 'change'
                      : 'due'
                  }`}
                >
                  ₹{changeOrDueAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          4. COMPACT STICKY BOTTOM ACTION BAR
          - Docked cleanly at the bottom without floating white gap
          - Primary Button: Save & Print Bill (F9)
          - Secondary Button: Preview Invoice, Hold Bill, Clear
          ------------------------------------------------------------------- */}
      <div className="billing-fixed-bottom-bar no-print">
        <div className="bar-summary-stats">
          <div className="bar-stat-chip">
            <span>Items:</span>
            <strong>{validItems.length}</strong>
          </div>
          <div className="bar-stat-chip">
            <span>Pairs:</span>
            <strong>{validItems.reduce((acc, it) => acc + it.quantity, 0)}</strong>
          </div>
          <div className="bar-grand-preview">
            Total: ₹{grandTotal.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bar-actions-group">
          {validItems.length > 0 && (
            <button
              type="button"
              className="btn-bar-secondary"
              onClick={handleClearCart}
              title="Clear active invoice"
            >
              <TrashIcon size={14} />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            className="btn-bar-secondary"
            onClick={handleHoldBill}
            disabled={validItems.length === 0}
            title="Hold invoice as draft"
          >
            <span>Hold Bill</span>
          </button>

          <button
            type="button"
            className="btn-bar-secondary"
            onClick={handleOpenPreview}
            disabled={validItems.length === 0}
            title="Preview printable tax invoice"
          >
            <BillIcon size={14} />
            <span>Preview Invoice</span>
          </button>

          <button
            type="button"
            className="btn-save-print-primary"
            onClick={handleSaveAndPrintBill}
            disabled={isSavingInvoice || validItems.length === 0}
            title="Save invoice to database and open print dialog (F9)"
          >
            <PrintIcon size={18} />
            <span>{isSavingInvoice ? 'Saving & Printing...' : 'Save & Print Bill (F9)'}</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          MODALS
          1. Quick Customer Registration
          2. Provisional Preview Modal
          3. Completed Invoice Modal (with Reprint / Save PDF)
          ------------------------------------------------------------------- */}
      {showAddCustomerModal && (
        <div className="erp-modal-backdrop" onClick={() => setShowAddCustomerModal(false)}>
          <div className="erp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Customer</h3>
              <button type="button" className="btn-close" onClick={() => setShowAddCustomerModal(false)}>
                <CloseIcon size={14} />
              </button>
            </div>
            <form onSubmit={handleQuickAddCustomer}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label>Customer Name *</label>
                  <input
                    type="text"
                    required
                    className="erp-input"
                    placeholder="e.g. Ramesh Patil"
                    value={newCustForm.name}
                    onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input
                    type="tel"
                    className="erp-input"
                    placeholder="10-digit mobile number"
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="erp-input"
                    placeholder="customer@example.com"
                    value={newCustForm.email}
                    onChange={(e) => setNewCustForm({ ...newCustForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Billing Address / City</label>
                  <input
                    type="text"
                    className="erp-input"
                    placeholder="Shop #, Street, City"
                    value={newCustForm.address}
                    onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddCustomerModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provisional Preview Modal */}
      {previewModalBill && (
        <InvoiceModal
          bill={previewModalBill}
          onClose={() => setPreviewModalBill(null)}
          onSaveBill={handleSaveAndPrintBill}
        />
      )}

      {/* Completed Invoice Modal (Post Checkout) */}
      {completedInvoice && (
        <InvoiceModal
          bill={completedInvoice}
          onClose={() => setCompletedInvoice(null)}
          onSaveBill={handleSaveAndPrintBill}
        />
      )}
    </div>
  )
}
