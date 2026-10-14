
import { jsPDF } from "jspdf";
import type { Invoice, StorageData } from "../types";
import { calculateTotals, calculateItemTotal } from "./calculations";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || "invoice";
}

function pdfDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function money(value: number, currency: string): string {
  const amount = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  // ASCII-only currency prefix avoids unsupported glyphs and stray characters
  // when using jsPDF's built-in Helvetica font.
  return currency === "INR" ? `Rs. ${formatted}` : `${currency} ${formatted}`;
}

function addLogo(doc: jsPDF, dataUrl: string, x: number, y: number): boolean {
  try {
    if (dataUrl.startsWith("data:image/png")) {
      doc.addImage(dataUrl, "PNG", x, y, 19, 19, undefined, "FAST");
      return true;
    }

    if (
      dataUrl.startsWith("data:image/jpeg") ||
      dataUrl.startsWith("data:image/jpg")
    ) {
      doc.addImage(dataUrl, "JPEG", x, y, 19, 19, undefined, "FAST");
      return true;
    }
  } catch {
    // Unsupported or damaged image: continue generating the invoice.
  }

  return false;
}

export function exportInvoiceJSON(invoice: Invoice): void {
  downloadBlob(
    new Blob([JSON.stringify(invoice, null, 2)], {
      type: "application/json;charset=utf-8"
    }),
    `${safeFilename(invoice.invoiceNumber)}.json`
  );
}

export function exportAllDataJSON(data: StorageData): void {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8"
    }),
    `invoicelite-backup-${new Date().toISOString().slice(0, 10)}.json`
  );
}

export async function importJSONFile(file: File): Promise<unknown> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The JSON file must be smaller than 10 MB.");
  }

  const content = await file.text();

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("This file contains invalid JSON.");
  }
}

export function exportInvoicePDF(invoice: Invoice): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true
  });

  const W = 210;
  const H = 297;
  const M = 16;
  const R = W - M;
  const CW = W - M * 2;

  const totals = calculateTotals(invoice);
  const showDueDate = invoice.showDueDate !== false;

  const accent =
    invoice.template === "elegant"
      ? [137, 102, 66]
      : invoice.template === "classic"
        ? [55, 65, 81]
        : [79, 70, 229];

  const dark = [31, 41, 55];
  const muted = [107, 114, 128];
  const border = [226, 232, 240];
  const pale = [245, 247, 250];
  const white = [255, 255, 255];

  let y = 19;

  function write(
    value: string,
    x: number,
    yy: number,
    size = 9,
    color: number[] = dark,
    bold = false,
    align: "left" | "right" | "center" = "left"
  ): void {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x, yy, { align, charSpace: 0 });
  }

  function line(yy: number): void {
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.25);
    doc.line(M, yy, R, yy);
  }

  function wrap(
    value: string,
    x: number,
    yy: number,
    maxWidth: number,
    size = 8,
    color: number[] = muted
  ): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(value, maxWidth) as string[];
    doc.text(lines, x, yy, { charSpace: 0 });
    return Math.max(1, lines.length) * 4;
  }

  function checkSpace(height: number): void {
    if (y + height > H - 19) {
      doc.addPage();
      y = 20;
    }
  }

  function tableHeading(): void {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(M, y, CW, 10, "F");

    write("DESCRIPTION", M + 3, y + 6.4, 7, white, true);
    write("QTY / UNIT", 137, y + 6.4, 7, white, true, "right");
    write("UNIT PRICE", 165, y + 6.4, 7, white, true, "right");
    write("AMOUNT", R - 3, y + 6.4, 7, white, true, "right");
    y += 13;
  }

  // Accent stripe
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, W, 4, "F");

  // Business identity and logo
  const logoShown = invoice.business.logo
    ? addLogo(doc, invoice.business.logo, M, y - 2)
    : false;

  const bx = logoShown ? M + 24 : M;
  const businessName = invoice.business.name || "Your Business";

  write(businessName, bx, y + 2, 14, accent, true);

  let by = y + 8;
  const businessWidth = 105;

  for (const value of [
    invoice.business.address,
    invoice.business.email,
    invoice.business.phone,
    invoice.business.website
  ].filter(Boolean)) {
    by += wrap(value, bx, by, businessWidth, 8, muted) + 1;
  }

  write("INVOICE", R, y + 2, 21, dark, true, "right");
  write(invoice.invoiceNumber || "INV-0001", R, y + 9, 9, dark, true, "right");

  y = Math.max(by, y + (logoShown ? 22 : 15)) + 8;

  // Invoice information panel
  const metadataHeight = 27;
  doc.setFillColor(pale[0], pale[1], pale[2]);
  doc.roundedRect(M, y, CW, metadataHeight, 2, 2, "F");

  const metadata = [
    ["INVOICE NUMBER", invoice.invoiceNumber || "—"],
    ["ISSUED", pdfDate(invoice.issueDate)],
    ...(showDueDate ? [["DUE DATE", pdfDate(invoice.dueDate)]] : [])
  ];

  const colW = CW / metadata.length;

  metadata.forEach(([label, value], index) => {
    const x = M + 5 + index * colW;
    write(label, x, y + 8, 7, muted, true);
    write(value, x, y + 16, 9, dark, true);
  });

  y += metadataHeight + 11;

  // Client details
  write("BILL TO", M, y, 8, muted, true);
  y += 7;
  write(invoice.client.name || "Client name", M, y, 11, dark, true);
  y += 6;

  for (const value of [
    invoice.client.address,
    invoice.client.email,
    invoice.client.taxId ? `Tax ID: ${invoice.client.taxId}` : ""
  ].filter(Boolean)) {
    y += wrap(value, M, y, 120, 8, muted) + 1;
  }

  if (invoice.purchaseOrder) {
    y += 2;
    write(`Purchase order: ${invoice.purchaseOrder}`, M, y, 8, muted);
    y += 5;
  }

  y += 7;
  tableHeading();

  // Item rows
  for (const item of invoice.items) {
    const description = item.description || "Item";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const descLines = doc.splitTextToSize(description, 78) as string[];
    const rowHeight = Math.max(10, descLines.length * 4.2 + (item.discount > 0 ? 8 : 4));

    checkSpace(rowHeight + 2);

    if (y === 20) tableHeading();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text(descLines, M + 3, y + 2, { charSpace: 0 });

    const qty = `${item.quantity}${item.unit?.trim() ? ` ${item.unit.trim()}` : ""}`;
    write(qty, 137, y + 2, 7, dark, false, "right");
    write(money(item.unitPrice, invoice.currency), 165, y + 2, 7, dark, false, "right");
    write(money(calculateItemTotal(item), invoice.currency), R - 3, y + 2, 7, dark, true, "right");

    if (item.discount > 0) {
      write(`${item.discount}% discount`, M + 3, y + 6.5, 7, muted);
    }

    y += rowHeight;
    line(y);
    y += 3;
  }

  // Totals block: fixed geometry and right-aligned values.
  y += 5;

  const boxWidth = 76;
  const boxLeft = R - boxWidth;
  const labelX = boxLeft + 1;
  const amountX = R - 4;

  const rows: Array<[string, number]> = [
    ["Subtotal", totals.subtotal]
  ];

  if (totals.itemDiscount > 0) rows.push(["Item discounts", -totals.itemDiscount]);
  if (totals.invoiceDiscount > 0) rows.push(["Invoice discount", -totals.invoiceDiscount]);
  if (totals.tax > 0) rows.push([invoice.taxLabel || "Tax", totals.tax]);
  if (totals.shipping > 0) rows.push(["Additional charges", totals.shipping]);

  for (const [label, amount] of rows) {
    checkSpace(8);
    write(label, labelX, y, 8, muted);
    write(
      `${amount < 0 ? "- " : ""}${money(Math.abs(amount), invoice.currency)}`,
      amountX,
      y,
      8,
      dark,
      false,
      "right"
    );
    y += 7;
  }

  checkSpace(25);

  // Draw the total bar once, with padding around both the label and amount.
  const barY = y - 4;
  const barHeight = 13;

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(boxLeft, barY, boxWidth, barHeight, 2, 2, "F");

  write("TOTAL", boxLeft + 4, barY + 8, 9, white, true);
  write(money(totals.total, invoice.currency), R - 4, barY + 8, 9, white, true, "right");

  y = barY + barHeight + 7;

  if (totals.amountPaid > 0) {
    checkSpace(8);
    write("Amount paid", labelX, y, 8, muted);
    write(money(totals.amountPaid, invoice.currency), amountX, y, 8, dark, false, "right");
    y += 7;
  }

  checkSpace(10);
  write("BALANCE DUE", labelX, y, 8, accent, true);
  write(money(totals.balance, invoice.currency), amountX, y, 9, accent, true, "right");
  y += 12;

  for (const [heading, value] of [
    ["PAYMENT INSTRUCTIONS", invoice.paymentInstructions],
    ["NOTES", invoice.notes]
  ]) {
    if (!value?.trim()) continue;

    checkSpace(18);
    write(heading, M, y, 7, muted, true);
    y += 5;
    y += wrap(value, M, y, CW, 8, dark) + 5;
  }

  if (invoice.paymentTerms) {
    checkSpace(10);
    write(`Payment terms: ${invoice.paymentTerms}`, M, y, 8, muted);
    y += 7;
  }

  if (invoice.footer) {
    checkSpace(12);
    line(y);
    y += 7;
    wrap(invoice.footer, M, y, CW, 8, muted);
  }

  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    write(`InvoiceLite  |  ${page} / ${pageCount}`, W / 2, H - 7, 7, muted, false, "center");
  }

  doc.save(`${safeFilename(invoice.invoiceNumber)}.pdf`);
}
