const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { pathToFileURL } = require("url");

const INVOICES_DIR = path.join(__dirname, "..", "invoices");
if (!fs.existsSync(INVOICES_DIR)) {
  try {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
  } catch (_) { }
}

// Load JsBarcode script for offline vector barcode generation inside print windows
let jsBarcodeSource = "";
try {
  const localBarcodePath = path.join(__dirname, "jsbarcode.min.js");
  if (fs.existsSync(localBarcodePath)) {
    jsBarcodeSource = fs.readFileSync(localBarcodePath, "utf8");
  } else {
    const fallbackPath = path.join(__dirname, "..", "frontend", "node_modules", "jsbarcode", "dist", "JsBarcode.all.min.js");
    if (fs.existsSync(fallbackPath)) {
      jsBarcodeSource = fs.readFileSync(fallbackPath, "utf8");
    }
  }
} catch (e) {
  console.warn("Could not preload jsbarcode script:", e.message);
}

const SHOP_METADATA = {
  name: "SWAMIDATT FOOTWEAR",
  tagline: "Retail Footwear & Accessories",
  address: "Wadgaon Aanad Alefhata Tal junner Dist pune",
  phone: "+91 7020466300",
  gst: "27AABCS1429B1Z5",
  currency: "₹",
};

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCurrencyPlain(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function groupInvoiceItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const groups = [];
  const groupMap = new Map();

  for (const it of items) {
    const pid = it.product_id != null ? String(it.product_id) : null;
    const name = (it.product_name || "Footwear Item").trim();
    const rate = Number(it.selling_price ?? it.price ?? 0);
    const rateKey = rate.toFixed(2);
    const groupKey = pid ? `pid_${pid}_${rateKey}` : `name_${name.toLowerCase()}_${rateKey}`;

    let grp = groupMap.get(groupKey);
    if (!grp) {
      grp = {
        key: groupKey,
        product_id: it.product_id,
        product_name: name,
        selling_price: rate,
        sizes: [],
        total_quantity: 0,
        total_price: 0,
      };
      groupMap.set(groupKey, grp);
      groups.push(grp);
    }

    const qty = Number(it.quantity ?? 1);
    const lineTotal = Number(it.total_price ?? (rate * qty) ?? 0);
    const sizeVal = (it.size !== null && it.size !== undefined && it.size !== "") ? String(it.size).trim() : "";

    const existingSize = grp.sizes.find((s) => s.size === sizeVal);
    if (existingSize) {
      existingSize.quantity += qty;
      existingSize.total_price += lineTotal;
    } else {
      grp.sizes.push({
        size: sizeVal,
        quantity: qty,
        total_price: lineTotal,
      });
    }

    grp.total_quantity += qty;
    grp.total_price += lineTotal;
  }

  for (const grp of groups) {
    grp.sizes.sort((a, b) => {
      const numA = parseFloat(a.size);
      const numB = parseFloat(b.size);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.size.localeCompare(b.size);
    });

    const sizeTokens = grp.sizes.map((s) => {
      if (s.size) {
        return `Size ${s.size}: ${s.quantity}`;
      }
      return `${s.quantity} pair${s.quantity > 1 ? "s" : ""}`;
    });
    grp.size_breakdown_text = sizeTokens.join(", ");
    grp.total_price = Math.round(grp.total_price * 100) / 100;
  }

  return groups;
}

function extractInvoiceTotals(bill) {
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
    };
  }

  const items = Array.isArray(bill.items) ? bill.items : [];
  const itemsSubtotal = items.reduce((sum, it) => {
    const rate = Number(it.selling_price ?? it.price ?? 0);
    const qty = Number(it.quantity ?? 1);
    return sum + Number(it.total_price ?? (rate * qty) ?? 0);
  }, 0);

  const subtotal = Math.round((Number(bill.subtotal) > 0 ? Number(bill.subtotal) : itemsSubtotal) * 100) / 100;

  const discPercentIn = Number(bill.discount_percent ?? 0);
  let discAmountIn = Number(bill.discount_amount ?? bill.discount ?? 0);
  let discountPercent = discPercentIn;
  let discountAmount = discAmountIn;

  if (discountPercent > 0 && discountAmount <= 0) {
    discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  } else if (discountAmount > 0 && discountPercent <= 0 && subtotal > 0) {
    discountPercent = Math.round(((discountAmount / subtotal) * 100) * 10) / 10;
  }

  const deliveryCharges = Math.max(0, Number(bill.delivery_charges ?? 0));
  const tax = Math.max(0, Number(bill.tax ?? 0));
  const roundOff = Number(bill.round_off ?? 0);

  const totalBeforeRoundOff = Math.round((subtotal - discountAmount + deliveryCharges + tax) * 100) / 100;
  const grandTotal = Number(bill.total_amount ?? (roundOff !== 0 ? Math.round(totalBeforeRoundOff) : totalBeforeRoundOff));

  const amountReceived = Number(bill.amount_received ?? bill.amount_paid ?? 0);
  const changeReturned = Number(bill.change_returned ?? 0);
  const isAccount = bill.payment_mode === "Add in Account" || String(bill.status).toLowerCase() === "unpaid";
  const outstandingAmount = Number(
    bill.outstanding_amount ?? (isAccount ? Math.max(0, grandTotal - amountReceived) : 0)
  );

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
  };
}

function generateInvoiceHtml(bill, printType = "a4") {
  if (!bill) return "";

  const groupedItems = groupInvoiceItems(bill.items || []);
  const totals = extractInvoiceTotals(bill);

  const billNo = bill.bill_no || "DRAFT";
  const paymentMode = bill.payment_mode || "Cash";
  const status = totals.isAccount ? "UNPAID" : (bill.status || "PAID").toUpperCase();
  const custName = bill.customer_name || "Walk-in Customer";
  const custPhone = bill.customer_phone || "";
  const billingAddr = bill.billing_address || "";

  let formattedDate = "";
  try {
    const d = bill.created_at ? new Date(bill.created_at) : new Date();
    formattedDate = d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch (_) {
    formattedDate = String(bill.created_at || "");
  }

  if (printType === "thermal") {
    // 80mm continuous thermal POS receipt template
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${escapeXml(billNo)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 2mm 3mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 72mm;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', monospace, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      line-height: 1.35;
      padding: 2mm 0;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .title { font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.04em; }
    .sub { font-size: 10px; margin-bottom: 2px; }
    .dashed { border-top: 1px dashed #000; margin: 5px 0; }
    .double { border-top: 2px solid #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 5px 0; }
    th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    td { padding: 4px 0; font-size: 10.5px; vertical-align: top; }
    .item-title { font-weight: bold; font-size: 11px; }
    .item-sizes { font-size: 9.5px; color: #222; margin-top: 2px; }
    .total-row { font-size: 13px; font-weight: 800; margin: 5px 0; }
    .barcode-wrap { text-align: center; margin: 6px 0 2px; }
    .barcode-wrap svg { max-width: 95%; height: auto; }
    .footer { font-size: 10px; text-align: center; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="center">
    <div class="title">${escapeXml(SHOP_METADATA.name)}</div>
    <div class="sub">${escapeXml(SHOP_METADATA.tagline)}</div>
    <div class="sub">${escapeXml(SHOP_METADATA.address)}</div>
    <div class="sub">Phone: ${escapeXml(SHOP_METADATA.phone)}</div>
    <div class="sub">GSTIN: ${escapeXml(SHOP_METADATA.gst)}</div>
  </div>

  <div class="double"></div>
  <div class="center bold" style="letter-spacing: 0.05em; font-size: 11px;">RETAIL TAX INVOICE</div>
  <div class="dashed"></div>

  <div class="row"><span>Bill No:</span><span class="bold">${escapeXml(billNo)}</span></div>
  <div class="row"><span>Date:</span><span>${escapeXml(formattedDate)}</span></div>
  <div class="row"><span>Customer:</span><span class="bold">${escapeXml(custName)}</span></div>
  ${custPhone ? `<div class="row"><span>Phone:</span><span>${escapeXml(custPhone)}</span></div>` : ""}
  <div class="row"><span>Pay Mode:</span><span class="bold">${escapeXml(paymentMode)}</span></div>
  <div class="row"><span>Status:</span><span class="bold">${escapeXml(status)}</span></div>

  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th style="width: 52%;">Item Description</th>
        <th style="width: 14%; text-align: center;">Pairs</th>
        <th style="width: 16%; text-align: right;">Rate</th>
        <th style="width: 18%; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${groupedItems.length === 0 ? `
        <tr><td colspan="4" style="text-align: center; padding: 6px 0;">No items in invoice</td></tr>
      ` : groupedItems.map((grp) => `
        <tr>
          <td>
            <div class="item-title">${escapeXml(grp.product_name)}</div>
            <div class="item-sizes">${escapeXml(grp.size_breakdown_text)}</div>
          </td>
          <td style="text-align: center;" class="bold">${grp.total_quantity}</td>
          <td style="text-align: right;">${grp.selling_price.toFixed(2)}</td>
          <td style="text-align: right;" class="bold">${grp.total_price.toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="dashed"></div>

  <div class="row"><span>Subtotal:</span><span>${formatCurrency(totals.subtotal)}</span></div>
  ${totals.discountAmount > 0 ? `<div class="row"><span>Discount${totals.discountPercent > 0 ? ` (${totals.discountPercent}%)` : ""}:</span><span>- ${formatCurrency(totals.discountAmount)}</span></div>` : ""}
  ${totals.deliveryCharges > 0 ? `<div class="row"><span>Delivery / Transport Charges:</span><span>+ ${formatCurrency(totals.deliveryCharges)}</span></div>` : ""}
  ${totals.tax > 0 ? `<div class="row"><span>Tax/GST:</span><span>+ ${formatCurrency(totals.tax)}</span></div>` : ""}
  ${totals.roundOff !== 0 ? `<div class="row"><span>Round Off:</span><span>${totals.roundOff > 0 ? "+" : ""}${formatCurrency(totals.roundOff)}</span></div>` : ""}

  <div class="dashed"></div>
  <div class="row total-row">
    <span>GRAND TOTAL:</span>
    <span>${formatCurrency(totals.grandTotal)}</span>
  </div>

  ${totals.isAccount ? `
    <div class="row"><span>Amount Paid:</span><span>${formatCurrency(totals.amountReceived)}</span></div>
    <div class="row bold" style="color: #b91c1c;"><span>Balance Due:</span><span>${formatCurrency(totals.outstandingAmount)}</span></div>
  ` : `
    ${totals.amountReceived > 0 ? `<div class="row"><span>Received:</span><span>${formatCurrency(totals.amountReceived)}</span></div>` : ""}
    ${totals.changeReturned > 0 ? `<div class="row"><span>Change Return:</span><span>${formatCurrency(totals.changeReturned)}</span></div>` : ""}
  `}

  <div class="dashed"></div>

  <div class="barcode-wrap">
    <svg id="receipt-barcode"></svg>
  </div>

  <div class="footer">
    <div class="bold" style="margin-top: 3px;">Thank You for Shopping at SWAMIDATT FOOTWEAR!</div>
    <div style="font-size: 9px; margin-top: 1px;">Visit Again.</div>
  </div>

  <script>
    ${jsBarcodeSource}
    try {
      JsBarcode("#receipt-barcode", "${escapeXml(billNo)}", {
        format: "CODE128",
        width: 1.5,
        height: 35,
        displayValue: true,
        fontSize: 10,
        margin: 2
      });
    } catch (_) {}
  </script>
</body>
</html>`;
  }

  // A4 Retail Tax Invoice template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${escapeXml(billNo)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      color: #0f172a;
      background: #fff;
      line-height: 1.4;
      padding: 0;
      margin: 0;
    }
    .header { text-align: center; margin-bottom: 12px; }
    .shop-title { font-size: 20pt; font-weight: 800; color: #0f172a; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 2px; }
    .shop-tagline { font-size: 10pt; font-weight: 600; color: #64748b; margin-bottom: 4px; }
    .shop-info-row { font-size: 8.5pt; color: #475569; margin-bottom: 3px; }
    .divider-double { border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; height: 3px; margin: 10px 0; }
    .inv-heading { font-size: 12pt; font-weight: 800; color: #2563eb; text-align: center; letter-spacing: 0.05em; margin: 6px 0 12px; text-transform: uppercase; }
    .meta-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 8.5pt;
    }
    .meta-col { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; gap: 10px; }
    .meta-label { color: #64748b; font-weight: 600; min-width: 95px; }
    .meta-val { color: #0f172a; font-weight: 500; }
    .meta-val.bold { font-weight: 700; }
    .meta-val.highlight { font-weight: 800; color: #2563eb; font-family: monospace; font-size: 9.5pt; }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
    }
    .status-badge.paid { background: #dcfce7; color: #15803d; }
    .status-badge.unpaid { background: #fee2e2; color: #b91c1c; }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 8.8pt;
    }
    table.items-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.03em;
      padding: 8px 10px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 2px solid #cbd5e1;
    }
    table.items-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
      color: #1e293b;
    }
    .item-name { font-weight: 700; color: #0f172a; font-size: 9pt; }
    .size-pill {
      display: inline-block;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 3px 7px;
      font-size: 8.2pt;
      color: #334155;
      font-weight: 500;
    }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 16px;
    }
    .note-card {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 8.5pt;
      color: #475569;
    }
    .note-card h4 {
      font-size: 8pt;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .calc-card {
      width: 270px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
      font-size: 8.8pt;
    }
    .calc-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      color: #475569;
    }
    .calc-row.grand-total {
      font-size: 11.5pt;
      font-weight: 800;
      color: #15803d;
      border-top: 1px dashed #cbd5e1;
      padding-top: 6px;
      margin-top: 6px;
    }
    .bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
    }
    .barcode-col {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .thanks-text {
      font-size: 8.5pt;
      font-weight: 700;
      color: #2563eb;
      margin-top: 4px;
    }
    .sign-col {
      text-align: center;
      width: 170px;
      font-size: 8pt;
      color: #64748b;
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="shop-title">${escapeXml(SHOP_METADATA.name)}</div>
    <div class="shop-tagline">${escapeXml(SHOP_METADATA.tagline)}</div>
    <div class="shop-info-row">${escapeXml(SHOP_METADATA.address)}</div>
    <div class="shop-info-row">
      <span><b>Mobile:</b> ${escapeXml(SHOP_METADATA.phone)}</span> &bull; 
      <span><b>GSTIN:</b> ${escapeXml(SHOP_METADATA.gst)}</span>
    </div>
  </div>

  <div class="divider-double"></div>
  <div class="inv-heading">Retail Tax Invoice</div>

  <div class="meta-box">
    <div class="meta-col">
      <div class="meta-row"><span class="meta-label">Invoice No:</span><span class="meta-val highlight">${escapeXml(billNo)}</span></div>
      <div class="meta-row"><span class="meta-label">Date &amp; Time:</span><span class="meta-val">${escapeXml(formattedDate)}</span></div>
      <div class="meta-row"><span class="meta-label">Payment Mode:</span><span class="meta-val bold">${escapeXml(paymentMode)}</span></div>
    </div>
    <div class="meta-col" style="align-items: flex-end;">
      <div class="meta-row"><span class="meta-label">Customer:</span><span class="meta-val bold">${escapeXml(custName)}</span></div>
      ${custPhone ? `<div class="meta-row"><span class="meta-label">Phone:</span><span class="meta-val">${escapeXml(custPhone)}</span></div>` : ""}
      ${billingAddr ? `<div class="meta-row"><span class="meta-label">Address:</span><span class="meta-val">${escapeXml(billingAddr)}</span></div>` : ""}
      <div class="meta-row">
        <span class="meta-label">Status:</span>
        <span class="status-badge ${totals.isAccount ? "unpaid" : "paid"}">${escapeXml(status)}</span>
      </div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 38px; text-align: center;">#</th>
        <th style="min-width: 180px;">Item Description</th>
        <th style="width: 230px;">Size-wise Quantity</th>
        <th style="width: 75px; text-align: center;">Total Pairs</th>
        <th style="width: 95px; text-align: right;">Unit Price (₹)</th>
        <th style="width: 105px; text-align: right;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${groupedItems.length === 0 ? `
        <tr><td colspan="6" style="text-align: center; padding: 14px; color: #64748b;">No items in this invoice.</td></tr>
      ` : groupedItems.map((grp, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>
            <div class="item-name">${escapeXml(grp.product_name)}</div>
          </td>
          <td>
            <span class="size-pill">${escapeXml(grp.size_breakdown_text)}</span>
          </td>
          <td style="text-align: center; font-weight: bold;">${grp.total_quantity}</td>
          <td style="text-align: right;">${grp.selling_price.toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold;">${grp.total_price.toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="summary-grid">
    <div class="note-card" style="visibility: ${bill.description ? "visible" : "hidden"};">
      <h4>Invoice Note</h4>
      <div>${escapeXml(bill.description || "")}</div>
    </div>

    <div class="calc-card">
      <div class="calc-row"><span>Subtotal:</span><span>${formatCurrency(totals.subtotal)}</span></div>
      ${totals.discountAmount > 0 ? `<div class="calc-row" style="color: #15803d;"><span>Discount${totals.discountPercent > 0 ? ` (${totals.discountPercent}%)` : ""}:</span><span>- ${formatCurrency(totals.discountAmount)}</span></div>` : ""}
      ${totals.deliveryCharges > 0 ? `<div class="calc-row"><span>Delivery / Transport Charges:</span><span>+ ${formatCurrency(totals.deliveryCharges)}</span></div>` : ""}
      ${totals.tax > 0 ? `<div class="calc-row"><span>Tax/GST:</span><span>+ ${formatCurrency(totals.tax)}</span></div>` : ""}
      ${totals.roundOff !== 0 ? `<div class="calc-row"><span>Round Off:</span><span>${totals.roundOff > 0 ? "+" : ""}${formatCurrency(totals.roundOff)}</span></div>` : ""}
      <div class="calc-row grand-total">
        <span>Grand Total:</span>
        <span>${formatCurrency(totals.grandTotal)}</span>
      </div>
      ${totals.isAccount ? `
        <div class="calc-row" style="margin-top: 4px;"><span>Amount Paid:</span><span>${formatCurrency(totals.amountReceived)}</span></div>
        <div class="calc-row" style="color: #b91c1c; font-weight: bold;"><span>Balance Due:</span><span>${formatCurrency(totals.outstandingAmount)}</span></div>
      ` : `
        ${totals.amountReceived > 0 ? `<div class="calc-row" style="margin-top: 4px;"><span>Amount Received:</span><span>${formatCurrency(totals.amountReceived)}</span></div>` : ""}
        ${totals.changeReturned > 0 ? `<div class="calc-row"><span>Change Return:</span><span>${formatCurrency(totals.changeReturned)}</span></div>` : ""}
      `}
    </div>
  </div>

  <div class="bottom-bar">
    <div class="barcode-col">
      <svg id="a4-barcode"></svg>
      <div class="thanks-text">Thank You for Shopping at SWAMIDATT FOOTWEAR! Visit Again.</div>
    </div>
    <div class="sign-col">
      Authorized Signatory
    </div>
  </div>

  <script>
    ${jsBarcodeSource}
    try {
      JsBarcode("#a4-barcode", "${escapeXml(billNo)}", {
        format: "CODE128",
        width: 1.8,
        height: 38,
        displayValue: true,
        fontSize: 11,
        margin: 4
      });
    } catch (_) {}
  </script>
</body>
</html>`;
}

ipcMain.handle("save-invoice-pdf", async (event, { billNo, pdfBase64 }) => {
  try {
    if (!billNo) throw new Error("Invoice number is required");
    const filename = `${billNo}.pdf`;
    const targetPath = path.join(INVOICES_DIR, filename);
    const buffer = Buffer.from(pdfBase64, "base64");
    fs.writeFileSync(targetPath, buffer);
    return { success: true, filePath: targetPath, filename };
  } catch (err) {
    console.error("Failed to save invoice PDF in Electron:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("print-invoice", async (event, options = {}) => {
  let printWindow = null;
  try {
    const bill = options.bill;
    const printType = options.printType || "a4";
    const customHtml = options.html;
    const finalHtml = customHtml || (bill ? generateInvoiceHtml(bill, printType) : null);

    // If neither html nor bill provided, fall back to printing the current window safely
    if (!finalHtml) {
      const targetWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      if (!targetWin) return { success: false, error: "Main window not available" };
      return new Promise((resolve) => {
        targetWin.webContents.print(
          {
            silent: Boolean(options.silent),
            printBackground: true,
            color: true,
            deviceName: options.deviceName,
            copies: options.copies || 1,
          },
          (success, failureReason) => {
            if (!success && failureReason !== "cancelled") {
              resolve({ success: false, error: failureReason });
            } else {
              resolve({ success: true, cancelled: failureReason === "cancelled" });
            }
          }
        );
      });
    }

    // Create an isolated hidden print window to guarantee ONLY the invoice prints
    printWindow = new BrowserWindow({
      show: false,
      width: printType === "thermal" ? 420 : 860,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`;
    await printWindow.loadURL(dataUrl);

    // Wait until fonts and DOM layout are fully ready before opening dialog
    try {
      await printWindow.webContents.executeJavaScript(`
        (async () => {
          if (document.fonts) {
            await document.fonts.ready;
          }
          return true;
        })()
      `);
    } catch (_) { }

    const printOptions = {
      silent: Boolean(options.silent),
      printBackground: true,
      color: true,
      copies: options.copies || 1,
    };

    if (options.deviceName) {
      printOptions.deviceName = options.deviceName;
    }

    if (printType === "thermal") {
      printOptions.margins = { marginType: "none" };
      printOptions.pageSize = { width: 80000, height: 297000 }; // 80mm roll width
    } else {
      printOptions.pageSize = "A4";
      printOptions.margins = { marginType: "printableArea" };
    }

    return new Promise((resolve) => {
      printWindow.webContents.print(printOptions, (success, failureReason) => {
        if (!success && failureReason !== "cancelled") {
          resolve({ success: false, error: failureReason });
        } else {
          resolve({ success: true, cancelled: failureReason === "cancelled" });
        }
      });
    });
  } catch (err) {
    console.error("Print error in Electron:", err);
    return { success: false, error: err.message };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) {
      setTimeout(() => {
        try {
          if (!printWindow.isDestroyed()) printWindow.close();
        } catch (_) { }
      }, 1500);
    }
  }
});

ipcMain.handle("print-current-window", async (event, options = {}) => {
  try {
    const targetWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!targetWin) return { success: false, error: "Window not available" };

    return new Promise((resolve) => {
      targetWin.webContents.print(
        {
          silent: Boolean(options.silent),
          printBackground: true,
          color: true,
          deviceName: options.deviceName,
          copies: options.copies || 1,
          ...options,
        },
        (success, failureReason) => {
          if (!success && failureReason !== "cancelled") {
            resolve({ success: false, error: failureReason });
          } else {
            resolve({ success: true, cancelled: failureReason === "cancelled" });
          }
        }
      );
    });
  } catch (err) {
    console.error("Print current window error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("print-to-pdf", async (event, options = {}) => {
  let printWindow = null;
  try {
    const bill = options.bill;
    const printType = options.printType || "a4";
    const customHtml = options.html;
    const finalHtml = customHtml || (bill ? generateInvoiceHtml(bill, printType) : null);

    if (!finalHtml) throw new Error("No invoice content provided to export as PDF");

    const defaultFilename = `${bill?.bill_no || "invoice"}.pdf`;
    const targetWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;

    const { canceled, filePath } = await dialog.showSaveDialog(targetWin, {
      title: "Save Invoice as PDF",
      defaultPath: path.join(app.getPath("documents"), defaultFilename),
      filters: [{ name: "PDF Document (*.pdf)", extensions: ["pdf"] }],
    });

    if (canceled || !filePath) {
      return { success: true, cancelled: true };
    }

    printWindow = new BrowserWindow({
      show: false,
      width: printType === "thermal" ? 420 : 860,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`;
    await printWindow.loadURL(dataUrl);

    try {
      await printWindow.webContents.executeJavaScript(`
        (async () => {
          if (document.fonts) await document.fonts.ready;
          return true;
        })()
      `);
    } catch (_) { }

    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: printType === "thermal" ? { width: 80000, height: 297000 } : "A4",
      margins: { marginType: "printableArea" },
    });

    fs.writeFileSync(filePath, pdfBuffer);
    return { success: true, filePath, filename: path.basename(filePath) };
  } catch (err) {
    console.error("Print to PDF error in Electron:", err);
    return { success: false, error: err.message };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) {
      try {
        printWindow.close();
      } catch (_) { }
    }
  }
});

ipcMain.handle("get-printers", async (event) => {
  try {
    const targetWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!targetWin) return [];
    if (typeof targetWin.webContents.getPrintersAsync === "function") {
      return await targetWin.webContents.getPrintersAsync();
    }
    return targetWin.webContents.getPrinters();
  } catch (err) {
    console.warn("Could not retrieve system printers:", err.message);
    return [];
  }
});

ipcMain.handle("get-invoices-dir", async () => {
  return INVOICES_DIR;
});


let backendProcess = null;
let mainWindow = null;

app.name = "swamidatt-footwear";
try {
  const userDataPath = path.join(app.getPath("appData"), "swamidatt-footwear");
  app.setPath("userData", userDataPath);
} catch (_) { }

// Ensure only a single instance of the application runs
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function isDevelopment() {
  return !app.isPackaged;
}

function getBackendPath() {
  if (isDevelopment()) {
    return path.join(__dirname, "..", "backend");
  }

  return path.join(process.resourcesPath, "backend");
}

function getPythonExecutable() {
  const backendPath = getBackendPath();
  const venvPythonWin = path.join(backendPath, "venv", "Scripts", "python.exe");
  const rootVenvPythonWin = path.join(__dirname, "..", ".venv", "Scripts", "python.exe");
  const venvPythonUnix = path.join(backendPath, "venv", "bin", "python");
  const rootVenvPythonUnix = path.join(__dirname, "..", ".venv", "bin", "python");

  if (process.platform === "win32") {
    if (fs.existsSync(venvPythonWin)) {
      return venvPythonWin;
    }
    if (fs.existsSync(rootVenvPythonWin)) {
      return rootVenvPythonWin;
    }
    return "python";
  }

  if (fs.existsSync(venvPythonUnix)) {
    return venvPythonUnix;
  }
  if (fs.existsSync(rootVenvPythonUnix)) {
    return rootVenvPythonUnix;
  }

  return "python3";
}

function backendIsRunning() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:5000/api/health", (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackend() {
  if (await backendIsRunning()) {
    console.log("Flask backend is already running on http://127.0.0.1:5000");
    return;
  }

  const backendPath = getBackendPath();
  const backendEntry = path.join(backendPath, "app.py");

  if (!fs.existsSync(backendEntry)) {
    console.warn("Backend entry not found:", backendEntry);
    return;
  }

  const pythonExecutable = getPythonExecutable();
  console.log(`Starting Flask backend with: ${pythonExecutable}`);

  backendProcess = spawn(pythonExecutable, [backendEntry], {
    cwd: backendPath,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    stdio: "inherit",
  });

  backendProcess.on("error", (error) => {
    console.error("Failed to start Flask backend:", error);
  });
}

async function loadDevFrontend(win, url, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    if (win.isDestroyed()) return;
    try {
      await win.loadURL(url);
      console.log(`Successfully connected to frontend at ${url}`);
      return;
    } catch (err) {
      console.log(`Waiting for frontend dev server at ${url}... (attempt ${i + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!win.isDestroyed()) {
    await win.loadURL(url);
  }
}

function getAppIconPath() {
  const candidatePaths = [
    path.join(__dirname, "..", "build", "Swamidatt_Agency.ico"),
    path.join(__dirname, "Swamidatt_Agency.ico"),
    path.join(app.getAppPath(), "build", "Swamidatt_Agency.ico"),
    path.join(app.getAppPath(), "electron", "Swamidatt_Agency.ico"),
    path.join(__dirname, "..", "build", "Swamidatt_Agency.png"),
    path.join(__dirname, "Swamidatt_Agency.png"),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_) { }
  }
  return undefined;
}

async function createWindow() {
  const appIcon = getAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: "SWAMIDATT FOOTWEAR ERP & POS",
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDevelopment()) {
    await loadDevFrontend(mainWindow, "http://127.0.0.1:5173/#/login");
  } else {
    const distPath = path.join(app.getAppPath(), "frontend", "dist", "index.html");
    const distUrl = `${pathToFileURL(distPath).href}#/login`;
    await mainWindow.loadURL(distUrl);
  }
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.swamidatt.footwear");
  }
  await startBackend();
  await createWindow();
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGTERM");
  }
});

app.on("window-all-closed", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGTERM");
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});