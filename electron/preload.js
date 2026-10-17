const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  saveInvoicePdf: (data) => ipcRenderer.invoke("save-invoice-pdf", data),
  printInvoice: (options) => ipcRenderer.invoke("print-invoice", options),
  printCurrentWindow: (options) => ipcRenderer.invoke("print-current-window", options),
  printToPdf: (options) => ipcRenderer.invoke("print-to-pdf", options),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  getInvoicesDir: () => ipcRenderer.invoke("get-invoices-dir"),
});
