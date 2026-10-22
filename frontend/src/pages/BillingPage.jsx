import React, { useEffect, useRef, useState, useMemo, Fragment } from 'react'
import { API_BASE_URL, SHOP_INFO } from '../config'
import { useAuth } from '../context/AuthContext'
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

// Helper to ensure backward compatibility and grouped cart structure
const migrateCartToGrouped = (items) => {
  if (!Array.isArray(items) || items.length === 0) return []
  if (items[0] && Array.isArray(items[0].sizes)) return items

  // Group flat items by product_id
  const groupsMap = new Map()
  for (const item of items) {
    const key = item.product_id ? String(item.product_id) : `manual-${item.row_id || Math.random()}`
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        group_id: `grp-${key}-${Date.now()}`,
        product_id: item.product_id || null,
        product_name: item.product_name || '',
        product_code: item.product_code || '',
        barcode: item.barcode || '',
        common_price: Number(item.selling_price || 0),
        is_expanded: true,
        available_sizes: item.available_sizes || [],
        sizes: [],
      })
    }
    const group = groupsMap.get(key)
    group.sizes.push({
      size: item.size || 7,
      quantity: Number(item.quantity || 1),
      selling_price: Number(item.selling_price || 0),
      max_stock: Number(item.max_stock || 999),
      total: Math.round(Number(item.quantity || 1) * Number(item.selling_price || 0) * 100) / 100,
    })
  }
  return Array.from(groupsMap.values())
}

export default function BillingPage() {
  const { user, token, refreshSession } = useAuth()
  const isBillingSuspended = user?.billing_status === 'suspended'

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

  // Cart / Table Items (Grouped by Footwear Model with Multi-Size Variants)
  // Each group: { group_id, product_id, product_name, product_code, barcode, common_price, is_expanded, available_sizes, sizes: [{ size, quantity, selling_price, max_stock, total }] }
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = sessionStorage.getItem('swamidatt_billing_cart')
      return saved ? migrateCartToGrouped(JSON.parse(saved)) : []
    } catch {
      return []
    }
  })

  // Multi-Size Wholesale Selector Modal State
  const [multiSizeModal, setMultiSizeModal] = useState({
    isOpen: false,
    product: null,
    commonPrice: 0,
    sizesState: [],
    error: '',
    existingGroupIndex: -1,
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
  const modalFirstInputRef = useRef(null)
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

  // Auto-focus first quantity input when multi-size modal opens
  useEffect(() => {
    if (multiSizeModal.isOpen) {
      const timer = setTimeout(() => {
        if (modalFirstInputRef.current) {
          modalFirstInputRef.current.focus()
          modalFirstInputRef.current.select?.()
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [multiSizeModal.isOpen])

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

  // ---------------------------------------------------------------------------
  // MULTI-SIZE WHOLESALE SELECTOR MODAL HANDLERS
  // ---------------------------------------------------------------------------
  const openMultiSizeModal = (product, existingGroupIndex = -1) => {
    if (!product) return

    let groupIndex = existingGroupIndex
    const currentCart = cartItemsRef.current || cartItems

    if (groupIndex === -1 && product.id) {
      groupIndex = currentCart.findIndex((grp) => grp.product_id === product.id)
    }

    const existingGroup = groupIndex >= 0 ? currentCart[groupIndex] : null

    // Collect available sizes from product
    let productSizes = []
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      productSizes = product.sizes
    } else {
      productSizes = DEFAULT_SIZES_FALLBACK
    }

    const defaultPrice = existingGroup
      ? Number(existingGroup.common_price || product.selling_price || 0)
      : Number(product.selling_price || 0)

    // Map sizes with initial quantities & rates
    const sizesState = productSizes.map((s) => {
      const sizeNum = Number(s.size)
      const stockQty = Number(s.stock_quantity ?? s.stock ?? 0)

      // Check if this size is already in the existing group in cart
      const existingSizeObj = existingGroup?.sizes?.find((sz) => Number(sz.size) === sizeNum)
      const initialQty = existingSizeObj ? existingSizeObj.quantity : 0
      const initialPrice = existingSizeObj ? Number(existingSizeObj.selling_price) : defaultPrice

      return {
        size: sizeNum,
        stock_quantity: stockQty,
        quantity: initialQty,
        selling_price: initialPrice,
        total: Math.round(initialQty * initialPrice * 100) / 100,
      }
    })

    setMultiSizeModal({
      isOpen: true,
      product,
      commonPrice: defaultPrice,
      sizesState,
      error: '',
      existingGroupIndex: groupIndex,
    })
  }

  // Edit Common Wholesale Rate in Modal
  const handleModalCommonPriceChange = (val) => {
    const num = Math.max(0, parseFloat(val) || 0)
    setMultiSizeModal((prev) => ({
      ...prev,
      commonPrice: val,
      sizesState: prev.sizesState.map((s) => ({
        ...s,
        selling_price: num,
        total: Math.round(s.quantity * num * 100) / 100,
      })),
    }))
  }

  // Edit Size Quantity in Modal with Stock Validation
  const handleModalSizeQtyChange = (sizeNum, val) => {
    const cleanQty = Math.max(0, parseInt(val, 10) || 0)
    setMultiSizeModal((prev) => {
      let error = ''
      const updatedSizes = prev.sizesState.map((s) => {
        if (s.size !== sizeNum) return s
        if (cleanQty > s.stock_quantity && s.stock_quantity > 0) {
          error = `Size ${sizeNum}: Entered quantity (${cleanQty}) exceeds available stock (${s.stock_quantity}).`
          return {
            ...s,
            quantity: s.stock_quantity,
            total: Math.round(s.stock_quantity * s.selling_price * 100) / 100,
          }
        }
        return {
          ...s,
          quantity: cleanQty,
          total: Math.round(cleanQty * s.selling_price * 100) / 100,
        }
      })
      return { ...prev, sizesState: updatedSizes, error }
    })
  }

  // Step Quantity (+ / -) in Modal
  const handleModalStepQty = (sizeNum, delta) => {
    setMultiSizeModal((prev) => {
      let error = ''
      const updatedSizes = prev.sizesState.map((s) => {
        if (s.size !== sizeNum) return s
        const target = Math.max(0, s.quantity + delta)
        if (target > s.stock_quantity && s.stock_quantity > 0) {
          error = `Cannot exceed available stock of ${s.stock_quantity} for Size ${sizeNum}.`
          return s
        }
        return {
          ...s,
          quantity: target,
          total: Math.round(target * s.selling_price * 100) / 100,
        }
      })
      return { ...prev, sizesState: updatedSizes, error }
    })
  }

  // Override Individual Size Rate in Modal
  const handleModalSizePriceChange = (sizeNum, val) => {
    const num = Math.max(0, parseFloat(val) || 0)
    setMultiSizeModal((prev) => ({
      ...prev,
      sizesState: prev.sizesState.map((s) => {
        if (s.size !== sizeNum) return s
        return {
          ...s,
          selling_price: num,
          total: Math.round(s.quantity * num * 100) / 100,
        }
      }),
    }))
  }

  // Quick Presets in Modal
  const handleModalPreset = (presetType) => {
    setMultiSizeModal((prev) => {
      if (presetType === 'all_one') {
        const updated = prev.sizesState.map((s) => {
          if (s.stock_quantity <= 0) return s
          const qty = 1
          return {
            ...s,
            quantity: qty,
            total: Math.round(qty * s.selling_price * 100) / 100,
          }
        })
        return { ...prev, sizesState: updated, error: '' }
      }
      if (presetType === 'clear') {
        const updated = prev.sizesState.map((s) => ({
          ...s,
          quantity: 0,
          total: 0,
        }))
        return { ...prev, sizesState: updated, error: '' }
      }
      return prev
    })
  }

  // Commit Modal Sizes to Cart / Invoice
  const handleCommitModalSizes = () => {
    const selectedSizes = multiSizeModal.sizesState.filter((s) => s.quantity > 0)
    if (selectedSizes.length === 0) {
      setMultiSizeModal((prev) => ({
        ...prev,
        error: 'Please enter a quantity for at least one available size before adding to bill.',
      }))
      playBeep('error')
      return
    }

    const { product, commonPrice, existingGroupIndex } = multiSizeModal
    const groupSellingPrice = parseFloat(commonPrice) || Number(product.selling_price || 0)

    const groupSizes = selectedSizes.map((s) => ({
      size: s.size,
      quantity: s.quantity,
      selling_price: Number(s.selling_price || groupSellingPrice),
      max_stock: s.stock_quantity,
      total: Math.round(s.quantity * Number(s.selling_price || groupSellingPrice) * 100) / 100,
    }))

    const totalPairsAdded = groupSizes.reduce((acc, s) => acc + s.quantity, 0)

    setCartItems((prev) => {
      const copy = [...prev]
      if (existingGroupIndex >= 0 && copy[existingGroupIndex]) {
        // Update existing product group
        copy[existingGroupIndex] = {
          ...copy[existingGroupIndex],
          product_id: product.id,
          product_name: product.product_name,
          product_code: product.product_code || `FW-${product.id}`,
          barcode: product.barcode || '',
          common_price: groupSellingPrice,
          is_expanded: true,
          available_sizes: product.sizes || [],
          sizes: groupSizes,
        }
        return copy
      } else {
        // Check if product already exists in cart under another group
        const existingIdx = copy.findIndex((grp) => grp.product_id === product.id)
        if (existingIdx >= 0) {
          copy[existingIdx] = {
            ...copy[existingIdx],
            common_price: groupSellingPrice,
            is_expanded: true,
            available_sizes: product.sizes || [],
            sizes: groupSizes,
          }
          return copy
        } else {
          // Add new product group
          const newGroup = {
            group_id: `grp-${product.id}-${Date.now()}`,
            product_id: product.id,
            product_name: product.product_name,
            product_code: product.product_code || `FW-${product.id}`,
            barcode: product.barcode || '',
            common_price: groupSellingPrice,
            is_expanded: true,
            available_sizes: product.sizes || [],
            sizes: groupSizes,
          }
          return [...copy, newGroup]
        }
      }
    })

    playBeep('success')
    setAlertMsg({
      type: 'success',
      text: `Added ${totalPairsAdded} pairs of "${product.product_name}" across ${groupSizes.length} sizes to bill.`,
    })
    setScannerStatus({
      type: 'success',
      text: `Added: ${product.product_name} (${totalPairsAdded} pairs)`,
    })
    setTimeout(() => setScannerStatus({ type: 'ready', text: 'Ready to Scan' }), 2500)

    setMultiSizeModal({
      isOpen: false,
      product: null,
      commonPrice: 0,
      sizesState: [],
      error: '',
      existingGroupIndex: -1,
    })

    // Refocus scanner input for next scan
    setTimeout(() => {
      scannerInputRef.current?.focus()
    }, 150)
  }

  // ---------------------------------------------------------------------------
  // GROUPED CART TABLE OPERATIONS
  // ---------------------------------------------------------------------------

  // Add Blank Row for Manual Product Selection
  const handleAddManualRow = () => {
    const blankGroup = {
      group_id: `grp-manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      product_id: null,
      product_name: '',
      product_code: '',
      barcode: '',
      common_price: 0,
      is_expanded: true,
      available_sizes: DEFAULT_SIZES_FALLBACK,
      sizes: [],
    }
    setCartItems((prev) => [...prev, blankGroup])
  }

  // Manual Row Product Selection -> Opens Multi-Size Modal for chosen model
  const handleManualRowProductSelect = (groupIndex, productId) => {
    if (!productId) {
      setCartItems((prev) => {
        const copy = [...prev]
        copy[groupIndex] = {
          ...copy[groupIndex],
          product_id: null,
          product_name: '',
          product_code: '',
          barcode: '',
          common_price: 0,
          sizes: [],
        }
        return copy
      })
      return
    }

    const prod = products.find((p) => String(p.id) === String(productId))
    if (!prod) return

    // Open multi-size selector for selected product
    openMultiSizeModal(prod, groupIndex)
  }

  // Toggle Expand / Collapse of Footwear Group
  const handleToggleExpandGroup = (groupIndex) => {
    setCartItems((prev) => {
      const copy = [...prev]
      copy[groupIndex] = { ...copy[groupIndex], is_expanded: !copy[groupIndex].is_expanded }
      return copy
    })
  }

  // Update Group Common Wholesale Price (Updates All Sizes in Group)
  const handleUpdateGroupCommonPrice = (groupIndex, newPrice) => {
    const p = Math.max(0, parseFloat(newPrice) || 0)
    setCartItems((prev) => {
      const copy = [...prev]
      const grp = { ...copy[groupIndex] }
      grp.common_price = p
      grp.sizes = (grp.sizes || []).map((sz) => ({
        ...sz,
        selling_price: p,
        total: Math.round(sz.quantity * p * 100) / 100,
      }))
      copy[groupIndex] = grp
      return copy
    })
  }

  // Update Individual Size Quantity in Group (with stock validation)
  const handleUpdateSizeQtyInGroup = (groupIndex, sizeIndex, val) => {
    const q = Math.max(1, parseInt(val, 10) || 1)
    setCartItems((prev) => {
      const copy = [...prev]
      const grp = { ...copy[groupIndex] }
      const szs = [...grp.sizes]
      const sz = { ...szs[sizeIndex] }

      if (q > sz.max_stock && sz.max_stock > 0) {
        setAlertMsg({
          type: 'error',
          text: `Cannot exceed available stock (${sz.max_stock}) for Size ${sz.size}.`,
        })
        sz.quantity = sz.max_stock
      } else {
        sz.quantity = q
      }

      sz.total = Math.round(sz.quantity * sz.selling_price * 100) / 100
      szs[sizeIndex] = sz
      grp.sizes = szs
      copy[groupIndex] = grp
      return copy
    })
  }

  // Override Individual Size Selling Price in Group
  const handleUpdateSizePriceInGroup = (groupIndex, sizeIndex, val) => {
    const p = Math.max(0, parseFloat(val) || 0)
    setCartItems((prev) => {
      const copy = [...prev]
      const grp = { ...copy[groupIndex] }
      const szs = [...grp.sizes]
      const sz = { ...szs[sizeIndex] }
      sz.selling_price = p
      sz.total = Math.round(sz.quantity * p * 100) / 100
      szs[sizeIndex] = sz
      grp.sizes = szs
      copy[groupIndex] = grp
      return copy
    })
  }

  // Remove Individual Size from Group
  const handleRemoveSizeFromGroup = (groupIndex, sizeIndex) => {
    setCartItems((prev) => {
      const copy = [...prev]
      const grp = { ...copy[groupIndex] }
      const szs = grp.sizes.filter((_, idx) => idx !== sizeIndex)
      if (szs.length === 0) {
        // If all sizes removed, remove whole footwear group
        return copy.filter((_, idx) => idx !== groupIndex)
      }
      grp.sizes = szs
      copy[groupIndex] = grp
      return copy
    })
  }

  // Remove Entire Footwear Group
  const handleRemoveGroup = (groupIndex) => {
    setCartItems((prev) => prev.filter((_, idx) => idx !== groupIndex))
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

      // Automatically add product to cart using Selling Price (₹) as the billing unit price
      const unitSellingPrice = Number(found.selling_price || 0)

      let defaultSizeNum = 7
      let maxStock = 999
      if (Array.isArray(found.sizes) && found.sizes.length > 0) {
        const inStockSize = found.sizes.find((s) => Number(s.stock_quantity ?? s.stock ?? 0) > 0) || found.sizes[0]
        defaultSizeNum = Number(inStockSize.size || 7)
        maxStock = Number(inStockSize.stock_quantity ?? inStockSize.stock ?? 999)
      }

      setCartItems((prev) => {
        const copy = [...prev]
        const existingIdx = copy.findIndex((grp) => grp.product_id === found.id)

        if (existingIdx >= 0) {
          const grp = { ...copy[existingIdx] }
          const sizes = [...(grp.sizes || [])]
          const sizeIdx = sizes.findIndex((s) => Number(s.size) === defaultSizeNum)

          if (sizeIdx >= 0) {
            const currentSize = sizes[sizeIdx]
            const newQty = currentSize.quantity + 1
            sizes[sizeIdx] = {
              ...currentSize,
              quantity: newQty,
              selling_price: unitSellingPrice,
              total: Math.round(newQty * unitSellingPrice * 100) / 100,
            }
          } else {
            sizes.push({
              size: defaultSizeNum,
              quantity: 1,
              selling_price: unitSellingPrice,
              max_stock: maxStock,
              total: unitSellingPrice,
            })
          }

          grp.common_price = unitSellingPrice
          grp.sizes = sizes
          copy[existingIdx] = grp
        } else {
          copy.push({
            group_id: `grp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            product_id: found.id,
            product_name: found.product_name,
            product_code: found.product_code || `FW-${found.id}`,
            barcode: found.barcode,
            common_price: unitSellingPrice,
            is_expanded: true,
            available_sizes: found.sizes || DEFAULT_SIZES_FALLBACK,
            sizes: [
              {
                size: defaultSizeNum,
                quantity: 1,
                selling_price: unitSellingPrice,
                max_stock: maxStock,
                total: unitSellingPrice,
              },
            ],
          })
        }
        return copy
      })

      playBeep('success')
      setAlertMsg({
        type: 'success',
        text: `Added "${found.product_name}" to bill at Selling Price ₹${unitSellingPrice.toFixed(2)}.`,
      })
      setScannerStatus({ type: 'success', text: `Added: ${found.product_name} (₹${unitSellingPrice.toFixed(2)})` })
      setTimeout(() => setScannerStatus({ type: 'ready', text: 'Ready to Scan' }), 2000)
    } finally {
      isProcessingScanRef.current = false
      // Refocus scanner input
      setTimeout(() => {
        if (!multiSizeModal.isOpen) {
          scannerInputRef.current?.focus()
        }
      }, 50)
    }
  }

  // Keyboard shortcut listener (F9 for Save & Print, Esc for modal, and continuous scanner redirect)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape: Close Multi-Size Modal
      if (e.key === 'Escape' && multiSizeModal.isOpen) {
        e.preventDefault()
        setMultiSizeModal((prev) => ({ ...prev, isOpen: false }))
        setTimeout(() => scannerInputRef.current?.focus(), 100)
        return
      }

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
        // If any modal dialog is open, do not redirect keys
        if (showAddCustomerModal || previewModalBill || completedInvoice || multiSizeModal.isOpen) return

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
  }, [cartItems, isSavingInvoice, showAddCustomerModal, previewModalBill, completedInvoice, multiSizeModal.isOpen])

  // Calculations Summary (Direct Price * Quantity flattened from all grouped sizes)
  const validItems = useMemo(() => {
    const flat = []
    for (const group of cartItems) {
      if (!group.product_id) continue
      for (const sz of (group.sizes || [])) {
        if (sz.quantity > 0) {
          flat.push({
            product_id: group.product_id,
            product_name: group.product_name,
            product_code: group.product_code,
            barcode: group.barcode,
            size: sz.size,
            quantity: sz.quantity,
            selling_price: sz.selling_price,
            total: Math.round(sz.quantity * sz.selling_price * 100) / 100,
            max_stock: sz.max_stock,
            group_id: group.group_id,
          })
        }
      }
    }
    return flat
  }, [cartItems])
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

    if (isBillingSuspended) {
      playBeep('error')
      setAlertMsg({
        type: 'error',
        text: `Billing operations are currently SUSPENDED for "${user?.shop_name || 'this shop'}". New invoice checkout is disabled.`,
      })
      return
    }

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
      const activeToken = token || sessionStorage.getItem('swamidatt_erp_token')
      const res = await fetch(`${API_BASE_URL}/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify(checkoutPayload),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.billing_suspended && refreshSession) {
          refreshSession()
        }
        throw new Error(data.message || 'Checkout failed')
      }

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
      {isBillingSuspended && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderLeft: '6px solid #dc2626',
          borderRadius: '8px',
          padding: '14px 20px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#991b1b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <strong style={{ fontSize: '1rem', display: 'block', color: '#b91c1c' }}>
                Billing Operations Suspended by Administrator
              </strong>
              <span style={{ fontSize: '0.86rem', color: '#7f1d1d' }}>
                New invoice generation and checkout are currently disabled for <strong>{user?.shop_name || 'this shop'}</strong>. Please contact your system administrator to resume billing.
              </span>
            </div>
          </div>
          <span style={{
            background: '#dc2626',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.75rem',
            padding: '6px 14px',
            borderRadius: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}>
            Suspended
          </span>
        </div>
      )}
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
            {cartItems.filter((g) => g.product_id).length} Models ({validItems.reduce((acc, it) => acc + it.quantity, 0)} Pairs)
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          3. GROUPED PRODUCT BILLING TABLE CARD
          - Footwear models grouped with expandable size-wise breakdown
          - Common wholesale price editing & individual size override
          - Automatic real-time recalculation of pairs, amounts, and totals
          ------------------------------------------------------------------- */}
      <div className="billing-table-card no-print">
        <div className="desktop-billing-table-wrap">
          <table className="desktop-billing-table">
            <thead>
              <tr>
                <th style={{ width: '44px', textAlign: 'center' }}>Sr.</th>
                <th style={{ minWidth: '240px' }}>Product / Footwear Model</th>
                <th style={{ width: '130px' }}>Barcode / SKU</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Total Pairs</th>
                <th style={{ minWidth: '200px' }}>Sizes Breakdown</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Unit Rate (₹)</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Total Amount</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Actions</th>
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
                cartItems.map((grp, grpIdx) => {
                  const isManual = !grp.product_id
                  const groupPairs = (grp.sizes || []).reduce((acc, s) => acc + Number(s.quantity || 0), 0)
                  const groupTotal = (grp.sizes || []).reduce((acc, s) => acc + Number(s.total || 0), 0)

                  return (
                    <Fragment key={grp.group_id || grpIdx}>
                      {/* Main Footwear Group Header Row */}
                      <tr className="tbl-group-header-row">
                        {/* 1. Sr. No. */}
                        <td style={{ textAlign: 'center', color: '#334155', fontWeight: 700 }}>
                          {grpIdx + 1}
                        </td>

                        {/* 2. Product Name / Footwear Model */}
                        <td className="tbl-group-accent">
                          {isManual ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <select
                                className="tbl-cell-select"
                                value=""
                                onChange={(e) => handleManualRowProductSelect(grpIdx, e.target.value)}
                              >
                                <option value="">-- Choose Footwear Model --</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.product_name} ({p.product_code || `FW-${p.id}`}) - ₹{p.selling_price}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="tbl-group-title-wrap">
                              <button
                                type="button"
                                className="tbl-group-chevron"
                                onClick={() => handleToggleExpandGroup(grpIdx)}
                                title={grp.is_expanded ? 'Collapse size breakdown' : 'Expand size breakdown'}
                              >
                                {grp.is_expanded ? '▼' : '▶'}
                              </button>
                              <span className="tbl-group-name">{grp.product_name}</span>
                              <span className="tbl-group-badge">
                                {grp.sizes?.length || 0} {(grp.sizes?.length || 0) === 1 ? 'size' : 'sizes'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 3. Barcode / SKU */}
                        <td>
                          <span className="tbl-sku-badge" title={grp.barcode ? `Barcode: ${grp.barcode}` : 'SKU'}>
                            {grp.product_code || grp.barcode || '—'}
                          </span>
                        </td>

                        {/* 4. Total Pairs in Group */}
                        <td style={{ textAlign: 'center' }}>
                          <span className="tbl-group-badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 800 }}>
                            {groupPairs} {groupPairs === 1 ? 'pair' : 'pairs'}
                          </span>
                        </td>

                        {/* 5. Sizes Breakdown Badges */}
                        <td>
                          <div className="tbl-group-sizes-summary">
                            {grp.sizes && grp.sizes.length > 0 ? (
                              grp.sizes.map((sz) => (
                                <span key={sz.size} className="tbl-size-pill">
                                  Sz {sz.size}: <b>{sz.quantity}</b>
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                No sizes selected
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Wholesale Common Rate (Editable) */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="tbl-cell-input"
                              style={{ width: '85px', textAlign: 'right', fontWeight: 700, color: '#1e3a8a' }}
                              value={grp.common_price}
                              onChange={(e) => handleUpdateGroupCommonPrice(grpIdx, e.target.value)}
                              disabled={isManual}
                              title="Wholesale common rate for this footwear (updates all sizes)"
                            />
                          </div>
                        </td>

                        {/* 7. Group Final Amount */}
                        <td style={{ textAlign: 'right' }}>
                          <span className="tbl-row-amount" style={{ color: '#0f172a', fontWeight: 800 }}>
                            ₹{groupTotal.toFixed(2)}
                          </span>
                        </td>

                        {/* 8. Action Buttons */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {!isManual && (
                              <button
                                type="button"
                                className="tbl-btn-add-sizes"
                                onClick={() => {
                                  const prod = products.find((p) => p.id === grp.product_id) || grp
                                  openMultiSizeModal(prod, grpIdx)
                                }}
                                title="Add or edit size quantities and wholesale rates"
                              >
                                + Sizes
                              </button>
                            )}
                            <button
                              type="button"
                              className="tbl-remove-btn"
                              onClick={() => handleRemoveGroup(grpIdx)}
                              title="Remove entire footwear model"
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Sub-rows for each size (Rendered when expanded) */}
                      {grp.is_expanded && !isManual && (grp.sizes || []).map((sz, szIdx) => (
                        <tr key={`${grp.group_id}-sz-${sz.size}`} className="tbl-subrow">
                          {/* Indent arrow */}
                          <td className="tbl-subrow-indent">↳</td>

                          {/* Size variant label */}
                          <td style={{ paddingLeft: '32px' }}>
                            <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.84rem' }}>
                              Size {sz.size} Variant
                            </span>
                            {sz.max_stock !== undefined && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '8px' }}>
                                (Avail: {sz.max_stock})
                              </span>
                            )}
                          </td>

                          {/* Barcode / SKU suffix */}
                          <td>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {grp.product_code || grp.barcode || '—'}-{sz.size}
                            </span>
                          </td>

                          {/* Quantity input */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="tbl-qty-wrap" style={{ margin: '0 auto' }}>
                              <input
                                type="number"
                                min="1"
                                max={sz.max_stock > 0 ? sz.max_stock : 999}
                                className="tbl-qty-input"
                                value={sz.quantity}
                                onChange={(e) => handleUpdateSizeQtyInGroup(grpIdx, szIdx, e.target.value)}
                              />
                            </div>
                          </td>

                          {/* Size badge */}
                          <td style={{ textAlign: 'center' }}>
                            <span className="stock-indicator-badge in-stock">
                              Size {sz.size}
                            </span>
                          </td>

                          {/* Selling price for this size */}
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="tbl-cell-input"
                                style={{ width: '80px', textAlign: 'right', fontWeight: 600 }}
                                value={sz.selling_price}
                                onChange={(e) => handleUpdateSizePriceInGroup(grpIdx, szIdx, e.target.value)}
                                title={`Override rate for Size ${sz.size}`}
                              />
                            </div>
                          </td>

                          {/* Subrow line total */}
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.86rem' }}>
                              ₹{Number(sz.total || 0).toFixed(2)}
                            </span>
                          </td>

                          {/* Subrow remove button */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="tbl-subrow-remove"
                              onClick={() => handleRemoveSizeFromGroup(grpIdx, szIdx)}
                              title={`Remove Size ${sz.size}`}
                            >
                              <CloseIcon size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })
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
            disabled={isSavingInvoice || validItems.length === 0 || isBillingSuspended}
            style={isBillingSuspended ? { background: '#ef4444', borderColor: '#dc2626', cursor: 'not-allowed', opacity: 0.8 } : {}}
            title={isBillingSuspended ? "Billing suspended by administrator" : "Save invoice to database and open print dialog (F9)"}
          >
            <PrintIcon size={18} />
            <span>{isBillingSuspended ? 'Billing Suspended' : isSavingInvoice ? 'Saving & Printing...' : 'Save & Print Bill (F9)'}</span>
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

      {/* -------------------------------------------------------------------
          4. MULTI-SIZE WHOLESALE QUANTITY & RATE SELECTOR MODAL
          - Opens on single barcode scan or "+ Sizes" button
          - Shows all available sizes with live real-time stock
          - Allows multi-size quantity entry in one single operation
          - Common wholesale price editing & size rate override
          - Validates stock per size and prevents exceeding stock
          - Commits all sizes to bill in one click
          ------------------------------------------------------------------- */}
      {multiSizeModal.isOpen && multiSizeModal.product && (
        <div
          className="multi-size-modal-overlay"
          onClick={() => {
            setMultiSizeModal((prev) => ({ ...prev, isOpen: false }))
            setTimeout(() => scannerInputRef.current?.focus(), 100)
          }}
        >
          <div className="multi-size-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="multi-size-modal-header">
              <div>
                <h3 className="multi-size-modal-title">
                  <BarcodeNavIcon size={20} color="#2563eb" />
                  <span>Multi-Size Wholesale Selector</span>
                </h3>
                <div className="multi-size-modal-subtitle">
                  <strong style={{ color: '#0f172a' }}>{multiSizeModal.product.product_name}</strong>
                  <span>•</span>
                  <span>SKU: {multiSizeModal.product.product_code || `FW-${multiSizeModal.product.id}`}</span>
                  {multiSizeModal.product.barcode && (
                    <>
                      <span>•</span>
                      <span>Barcode: {multiSizeModal.product.barcode}</span>
                    </>
                  )}
                  <span>•</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>
                    Total In Stock: {multiSizeModal.sizesState.reduce((a, s) => a + s.stock_quantity, 0)} pairs
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setMultiSizeModal((prev) => ({ ...prev, isOpen: false }))
                  setTimeout(() => scannerInputRef.current?.focus(), 100)
                }}
              >
                <CloseIcon size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="multi-size-modal-body">
              {/* Wholesale Common Rate Control */}
              <div className="multi-size-wholesale-bar">
                <div className="multi-size-wholesale-label">
                  <span>Wholesale / Common Unit Rate (₹)</span>
                  <small style={{ color: '#475569', fontWeight: 500 }}>
                    Enter common rate for all sizes, or override individual size rates below
                  </small>
                </div>
                <div className="multi-size-wholesale-input-wrap">
                  <span style={{ fontWeight: 700, color: '#1e40af' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="multi-size-wholesale-input"
                    value={multiSizeModal.commonPrice}
                    onChange={(e) => handleModalCommonPriceChange(e.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    className="btn-apply-all-rates"
                    onClick={() => handleModalCommonPriceChange(multiSizeModal.commonPrice)}
                    title="Apply this common rate across all sizes"
                  >
                    Apply to All
                  </button>
                </div>
              </div>

              {/* Quick Presets Bar */}
              <div className="multi-size-presets-bar">
                <span>Quick Actions:</span>
                <button
                  type="button"
                  className="btn-preset-action"
                  onClick={() => handleModalPreset('all_one')}
                >
                  +1 Pair to All In-Stock Sizes
                </button>
                <button
                  type="button"
                  className="btn-preset-action"
                  onClick={() => handleModalPreset('clear')}
                >
                  Clear All Quantities
                </button>
              </div>

              {/* Validation error if any */}
              {multiSizeModal.error && (
                <div style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, background: '#fee2e2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                  {multiSizeModal.error}
                </div>
              )}

              {/* Multi-Size Table */}
              <table className="multi-size-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Shoe Size</th>
                    <th style={{ width: '130px' }}>Available Stock</th>
                    <th style={{ width: '180px', textAlign: 'center' }}>Billing Quantity</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Unit Rate (₹)</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {multiSizeModal.sizesState.map((s, idx) => {
                    const isOutOfStock = s.stock_quantity <= 0
                    return (
                      <tr key={s.size} style={isOutOfStock ? { opacity: 0.6, background: '#f8fafc' } : {}}>
                        {/* Size */}
                        <td className="size-badge-col">
                          Size {s.size}
                        </td>

                        {/* Available Stock */}
                        <td>
                          {isOutOfStock ? (
                            <span className="stock-indicator-badge out-of-stock">
                              Out of Stock (0)
                            </span>
                          ) : (
                            <span className="stock-indicator-badge in-stock">
                              {s.stock_quantity} available
                            </span>
                          )}
                        </td>

                        {/* Quantity Control */}
                        <td style={{ textAlign: 'center' }}>
                          <div className="multi-size-qty-control">
                            <button
                              type="button"
                              className="btn-qty-step"
                              disabled={isOutOfStock || s.quantity <= 0}
                              onClick={() => handleModalStepQty(s.size, -1)}
                            >
                              -
                            </button>
                            <input
                              ref={idx === 0 ? modalFirstInputRef : null}
                              type="number"
                              min="0"
                              max={s.stock_quantity > 0 ? s.stock_quantity : 0}
                              disabled={isOutOfStock}
                              className={`multi-size-qty-input ${s.quantity > 0 ? 'has-qty' : ''}`}
                              value={s.quantity === 0 ? '' : s.quantity}
                              onChange={(e) => handleModalSizeQtyChange(s.size, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleCommitModalSizes()
                                }
                              }}
                              placeholder="0"
                            />
                            <button
                              type="button"
                              className="btn-qty-step"
                              disabled={isOutOfStock || s.quantity >= s.stock_quantity}
                              onClick={() => handleModalStepQty(s.size, 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Unit Rate */}
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="multi-size-rate-input"
                            value={s.selling_price}
                            onChange={(e) => handleModalSizePriceChange(s.size, e.target.value)}
                            disabled={isOutOfStock}
                          />
                        </td>

                        {/* Line Total */}
                        <td className="multi-size-line-total">
                          ₹{s.total.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="multi-size-modal-footer">
              <div className="multi-size-footer-summary">
                <span>
                  Selected Pairs: <strong className="footer-summary-pairs">{multiSizeModal.sizesState.reduce((a, s) => a + s.quantity, 0)}</strong>
                </span>
                <span>•</span>
                <span>
                  Product Total: <strong className="footer-summary-total">₹{multiSizeModal.sizesState.reduce((a, s) => a + s.total, 0).toFixed(2)}</strong>
                </span>
              </div>

              <div className="multi-size-footer-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setMultiSizeModal((prev) => ({ ...prev, isOpen: false }))
                    setTimeout(() => scannerInputRef.current?.focus(), 100)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-add-sizes-primary"
                  onClick={handleCommitModalSizes}
                >
                  <CheckIcon size={14} />
                  <span>Add Selected Sizes ({multiSizeModal.sizesState.reduce((a, s) => a + s.quantity, 0)} Pairs)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
