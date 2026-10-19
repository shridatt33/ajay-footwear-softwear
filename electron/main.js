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

function generateInvoiceHtml(bill, printType = "a4") {
  if (!bill) return "";

  const items = Array.isArray(bill.items) ? bill.items : [];
  const subtotal = items.reduce((sum, it) => {
    const rate = Number(it.selling_price ?? it.price ?? 0);
    const qty = Number(it.quantity ?? 1);
    return sum + Number(it.total_price ?? rate * qty ?? 0);
  }, 0);

  const discount = Number(bill.discount || 0);
  const tax = Number(bill.tax || 0);
  const roundOff = Number(bill.round_off || 0);
  const grandTotal = Number(bill.total_amount ?? Math.max(0, subtotal - discount + tax + roundOff));
  const received = Number(bill.amount_received ?? bill.amount_paid ?? 0);
  const change = Number(bill.change_returned ?? 0);
  const outstanding = Number(bill.outstanding_amount ?? 0);
  const billNo = bill.bill_no || "DRAFT";
  const paymentMode = bill.payment_mode || "Cash";
  const status = bill.status || (paymentMode === "Add in Account" ? "Unpaid" : "Paid");
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
      font-family: 'Courier New', Courier, monospace, 'Segoe UI', sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      line-height: 1.3;
      padding: 2mm 0;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .title { font-size: 15px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
    .sub { font-size: 10px; margin-bottom: 2px; }
    .dashed { border-top: 1px dashed #000; margin: 5px 0; }
    .double { border-top: 2px solid #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th { text-align: left; border-bottom: 1px dashed #000; padding: 3px 0; font-size: 10px; font-weight: bold; }
    td { padding: 3px 0; font-size: 11px; vertical-align: top; }
    .total-row { font-size: 13px; font-weight: bold; margin: 4px 0; }
    .barcode-wrap { text-align: center; margin: 6px 0 2px; }
    .barcode-wrap svg { max-width: 95%; height: auto; }
    .footer { font-size: 9.5px; text-align: center; margin-top: 4px; }
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
  <div class="center bold">RETAIL TAX INVOICE</div>
  <div class="dashed"></div>

  <div class="row"><span>Bill No:</span><span class="bold">${escapeXml(billNo)}</span></div>
  <div class="row"><span>Date:</span><span>${escapeXml(formattedDate)}</span></div>
  <div class="row"><span>Customer:</span><span class="bold">${escapeXml(custName)}</span></div>
  ${custPhone ? `<div class="row"><span>Phone:</span><span>${escapeXml(custPhone)}</span></div>` : ""}
  <div class="row"><span>Pay Mode:</span><span class="bold">${escapeXml(paymentMode)}</span></div>
  <div class="row"><span>Status:</span><span class="bold">${escapeXml(status.toUpperCase())}</span></div>

  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th style="width: 48%;">Item</th>
        <th style="width: 14%; text-align: center;">Sz</th>
        <th style="width: 14%; text-align: center;">Qty</th>
        <th style="width: 24%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it) => {
      const rate = Number(it.selling_price ?? it.price ?? 0);
      const qty = Number(it.quantity ?? 1);
      const total = Number(it.total_price ?? rate * qty ?? 0);
      return `
          <tr>
            <td>
              <div class="bold">${escapeXml(it.product_name)}</div>
              ${it.product_code ? `<div style="font-size: 9px; color: #444;">${escapeXml(it.product_code)}</div>` : ""}
            </td>
            <td style="text-align: center;">${it.size ? escapeXml(it.size) : "-"}</td>
            <td style="text-align: center;">${qty}</td>
            <td style="text-align: right;" class="bold">₹${total.toFixed(2)}</td>
          </tr>
        `;
    }).join("")}
    </tbody>
  </table>

  <div class="dashed"></div>

  <div class="row"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
  ${discount > 0 ? `<div class="row"><span>Discount:</span><span>- ₹${discount.toFixed(2)}</span></div>` : ""}
  ${tax > 0 ? `<div class="row"><span>Tax/GST:</span><span>+ ₹${tax.toFixed(2)}</span></div>` : ""}
  ${roundOff !== 0 ? `<div class="row"><span>Round Off:</span><span>₹${roundOff.toFixed(2)}</span></div>` : ""}

  <div class="dashed"></div>
  <div class="row total-row">
    <span>GRAND TOTAL:</span>
    <span>₹${grandTotal.toFixed(2)}</span>
  </div>

  ${paymentMode === "Add in Account" || status.toLowerCase() === "unpaid" ? `
    <div class="row"><span>Amount Paid:</span><span>₹${received.toFixed(2)}</span></div>
    <div class="row bold" style="color: #b91c1c;"><span>Outstanding:</span><span>₹${(outstanding || Math.max(0, grandTotal - received)).toFixed(2)}</span></div>
  ` : `
    ${received > 0 ? `<div class="row"><span>Received:</span><span>₹${received.toFixed(2)}</span></div>` : ""}
    ${change > 0 ? `<div class="row"><span>Change:</span><span>₹${change.toFixed(2)}</span></div>` : ""}
  `}

  <div class="dashed"></div>

  <div class="barcode-wrap">
    <svg id="receipt-barcode"></svg>
  </div>

  <div class="footer">
    <div>Exchange allowed within 7 days in unworn condition.</div>
    <div class="bold" style="margin-top: 3px;">Thank You for Shopping at SWAMIDATT FOOTWEAR!</div>
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
    .meta-label { color: #64748b; font-weight: 600; min-width: 90px; }
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
    .item-code { font-size: 7.5pt; color: #64748b; font-family: monospace; }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 16px;
    }
    .terms-card {
      flex: 1;
      background: #fafafa;
      border: 1px solid #f1f5f9;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 8pt;
      color: #64748b;
    }
    .terms-card h4 {
      font-size: 8pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .terms-card ul { padding-left: 16px; margin: 0; line-height: 1.45; }
    .calc-card {
      width: 250px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
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
      margin-top: 18px;
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
        <span class="status-badge ${status.toLowerCase() === "unpaid" ? "unpaid" : "paid"}">${escapeXml(status)}</span>
      </div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th>Product Description</th>
        <th style="width: 80px; text-align: center;">Size</th>
        <th style="width: 60px; text-align: center;">Qty</th>
        <th style="width: 100px; text-align: right;">Unit Price (₹)</th>
        <th style="width: 110px; text-align: right;">Total Price (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it, idx) => {
    const rate = Number(it.selling_price ?? it.price ?? 0);
    const qty = Number(it.quantity ?? 1);
    const total = Number(it.total_price ?? rate * qty ?? 0);
    return `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td>
              <div class="item-name">${escapeXml(it.product_name)}</div>
              ${it.product_code || it.barcode ? `<div class="item-code">Code: ${escapeXml(it.product_code || it.barcode)}</div>` : ""}
            </td>
            <td style="text-align: center;">${it.size ? `Size ${escapeXml(it.size)}` : "—"}</td>
            <td style="text-align: center; font-weight: bold;">${qty}</td>
            <td style="text-align: right;">${rate.toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">${total.toFixed(2)}</td>
          </tr>
        `;
  }).join("")}
    </tbody>
  </table>

  <div class="summary-grid">
    <div class="terms-card">
      <h4>Terms &amp; Conditions</h4>
      <ul>
        <li>Goods once sold will not be refunded.</li>
        <li>Exchange allowed within 7 days with this original invoice receipt.</li>
        <li>Footwear must be in unworn, original box condition.</li>
        <li>No guarantee on discount / clearance sale footwear.</li>
      </ul>
    </div>

    <div class="calc-card">
      <div class="calc-row"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
      ${discount > 0 ? `<div class="calc-row" style="color: #15803d;"><span>Discount:</span><span>- ₹${discount.toFixed(2)}</span></div>` : ""}
      ${tax > 0 ? `<div class="calc-row"><span>Tax/GST:</span><span>+ ₹${tax.toFixed(2)}</span></div>` : ""}
      ${roundOff !== 0 ? `<div class="calc-row"><span>Round Off:</span><span>₹${roundOff.toFixed(2)}</span></div>` : ""}
      <div class="calc-row grand-total">
        <span>Grand Total:</span>
        <span>₹${grandTotal.toFixed(2)}</span>
      </div>
      ${paymentMode === "Add in Account" || status.toLowerCase() === "unpaid" ? `
        <div class="calc-row" style="margin-top: 4px;"><span>Amount Paid:</span><span>₹${received.toFixed(2)}</span></div>
        <div class="calc-row" style="color: #b91c1c; font-weight: bold;"><span>Outstanding:</span><span>₹${(outstanding || Math.max(0, grandTotal - received)).toFixed(2)}</span></div>
      ` : `
        ${received > 0 ? `<div class="calc-row" style="margin-top: 4px;"><span>Received:</span><span>₹${received.toFixed(2)}</span></div>` : ""}
        ${change > 0 ? `<div class="calc-row"><span>Change:</span><span>₹${change.toFixed(2)}</span></div>` : ""}
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