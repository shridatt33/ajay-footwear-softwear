/**
 * Invoice utility helpers for SWAMIDATT FOOTWEAR ERP
 * Centralizes grouping of identical footwear models, size breakdown strings,
 * currency formatting, and consistent totals calculations.
 */

export function formatCurrency(amount) {
  const num = Number(amount || 0)
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatCurrencyPlain(amount) {
  const num = Number(amount || 0)
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Groups identical footwear models by product identity and unit selling price.
 * Line items with the same product identity and price appear as one main row,
 * with sizes and quantities cleanly aggregated.
 */
export function groupInvoiceItems(items) {
  if (!Array.isArray(items) || items.length === 0) return []

  const groups = []
  const groupMap = new Map()

  for (const it of items) {
    const pid = it.product_id != null ? String(it.product_id) : null
    const name = (it.product_name || 'Footwear Item').trim()
    const rate = Number(it.selling_price ?? it.price ?? 0)
    const rateKey = rate.toFixed(2)
    const groupKey = pid ? `pid_${pid}_${rateKey}` : `name_${name.toLowerCase()}_${rateKey}`

    let grp = groupMap.get(groupKey)
    if (!grp) {
      grp = {
        key: groupKey,
        product_id: it.product_id,
        product_name: name,
        selling_price: rate,
        sizes: [],
        total_quantity: 0,
        total_price: 0,
      }
      groupMap.set(groupKey, grp)
      groups.push(grp)
    }

    const qty = Number(it.quantity ?? 1)
    const lineTotal = Number(it.total_price ?? (rate * qty) ?? 0)
    const sizeVal = (it.size !== null && it.size !== undefined && it.size !== '') ? String(it.size).trim() : ''

    const existingSize = grp.sizes.find((s) => s.size === sizeVal)
    if (existingSize) {
      existingSize.quantity += qty
      existingSize.total_price += lineTotal
    } else {
      grp.sizes.push({
        size: sizeVal,
        quantity: qty,
        total_price: lineTotal,
      })
    }

    grp.total_quantity += qty
    grp.total_price += lineTotal
  }

  // Format size-wise quantity string: e.g. "Size 1: 3, Size 2: 4, Size 3: 4"
  for (const grp of groups) {
    grp.sizes.sort((a, b) => {
      const numA = parseFloat(a.size)
      const numB = parseFloat(b.size)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.size.localeCompare(b.size)
    })

    const sizeTokens = grp.sizes.map((s) => {
      if (s.size) {
        return `Size ${s.size}: ${s.quantity}`
      }
      return `${s.quantity} pair${s.quantity > 1 ? 's' : ''}`
    })
    grp.size_breakdown_text = sizeTokens.join(', ')
    grp.total_price = Math.round(grp.total_price * 100) / 100
  }

  return groups
}

/**
 * Extracts and recalculates normalized invoice totals to ensure mathematical consistency.
 */
export function extractInvoiceTotals(bill) {
  if (!bill) {
    return {
      subtotal: 0,
      discountAmount: 0,
      discountPercent: 0,
      deliveryCharges: 0,
      tax: 0,
      roundOff: 0,
      grandTotal: 0,
      amountReceived: 0,
      changeReturned: 0,
      outstandingAmount: 0,
      isAccount: false,
    }
  }

  const items = Array.isArray(bill.items) ? bill.items : []
  const itemsSubtotal = items.reduce((sum, it) => {
    const rate = Number(it.selling_price ?? it.price ?? 0)
    const qty = Number(it.quantity ?? 1)
    return sum + Number(it.total_price ?? (rate * qty) ?? 0)
  }, 0)

  const subtotal = Math.round((Number(bill.subtotal) > 0 ? Number(bill.subtotal) : itemsSubtotal) * 100) / 100

  // Discount
  const discPercentIn = Number(bill.discount_percent ?? 0)
  let discAmountIn = Number(bill.discount_amount ?? bill.discount ?? 0)
  let discountPercent = discPercentIn
  let discountAmount = discAmountIn

  if (discountPercent > 0 && discountAmount <= 0) {
    discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100
  } else if (discountAmount > 0 && discountPercent <= 0 && subtotal > 0) {
    discountPercent = Math.round(((discountAmount / subtotal) * 100) * 10) / 10
  }

  const deliveryCharges = Math.max(0, Number(bill.delivery_charges ?? 0))
  const tax = Math.max(0, Number(bill.tax ?? 0))
  const roundOff = Number(bill.round_off ?? 0)

  const totalBeforeRoundOff = Math.round((subtotal - discountAmount + deliveryCharges + tax) * 100) / 100
  const grandTotal = Number(bill.total_amount ?? (roundOff !== 0 ? Math.round(totalBeforeRoundOff) : totalBeforeRoundOff))

  const amountReceived = Number(bill.amount_received ?? bill.amount_paid ?? 0)
  const changeReturned = Number(bill.change_returned ?? 0)
  const isAccount = bill.payment_mode === 'Add in Account' || String(bill.status).toLowerCase() === 'unpaid'
  const outstandingAmount = Number(
    bill.outstanding_amount ?? (isAccount ? Math.max(0, grandTotal - amountReceived) : 0)
  )

  return {
    subtotal,
    discountAmount,
    discountPercent,
    deliveryCharges,
    tax,
    roundOff,
    grandTotal,
    amountReceived,
    changeReturned,
    outstandingAmount,
    isAccount,
  }
}
