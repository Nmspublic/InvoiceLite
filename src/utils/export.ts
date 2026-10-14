
import { jsPDF } from "jspdf";
import type { Invoice, StorageData } from "../types";
import { calculateTotals, calculateItemTotal } from "./calculations";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string): string {
  return (
    value.replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-").slice(0, 80) ||
    "invoice"
  );
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

/**
 * Use currency codes in the PDF so the amounts remain readable
 * with jsPDF's built-in fonts, including for Indian Rupees.
 */
function pdfCurrency(amount: number, currency: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeAmount);

  return `${currency} ${formatted}`;
}

function pdfLogoFormat(dataUrl: string): "PNG" | "JPEG" | null {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (
    dataUrl.startsWith("data:image/jpeg") ||
    dataUrl.startsWith("data:image/jpg")
  ) {
    return "JPEG";
  }
  return null;
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

  if (
    file.type &&
    file.type !== "application/json" &&
    !file.name.toLowerCase().endsWith(".json")
  ) {
    throw new Error("Please select a JSON file.");
  }

  const contents = await file.text();

  try {
    return JSON.parse(contents) as unknown;
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

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const rightEdge = pageWidth - margin;

  const totals = calculateTotals(invoice);

  const accent =
    invoice.template === "elegant"
      ? [135, 98, 64]
      : invoice.template === "classic"
        ? [55, 65, 81]
        : [79, 70, 229];

  const dark = [31, 41, 55];
  const muted = [107, 114, 128];
  const light = [245, 247, 250];
  const border = [226, 232, 240];
  const white = [255, 255, 255];

  const showDueDate = invoice.showDueDate !== false;

  let y = 18;

  function setTextStyle(
    size: number,
    color: number[],
    weight: "normal" | "bold" = "normal"
  ): void {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  }

  function text(
    value: string,
    x: number,
    yPosition: number,
    size = 9,
    color: number[] = dark,
    weight: "normal" | "bold" = "normal",
    align: "left" | "center" | "right" = "left"
  ): void {
    setTextStyle(size, color, weight);
    doc.text(value, x, yPosition, { align });
  }

  function drawLine(yPosition: number): void {
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.25);
    doc.line(margin, yPosition, rightEdge, yPosition);
  }

  function wrapped(
    value: string,
    x: number,
    yPosition: number,
    maxWidth: number,
    size = 9,
    color: number[] = dark
  ): number {
    setTextStyle(size, color);

    const lines = doc.splitTextToSize(value || " ", maxWidth) as string[];
    doc.text(lines, x, yPosition);

    return lines.length * (size * 0.42 + 1.2);
  }

  function ensureSpace(height: number): void {
    if (y + height > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  }

  function drawTableHeader(): void {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(margin, y, contentWidth, 10, "F");

    text("DESCRIPTION", margin + 3, y + 6.5, 7, white, "bold");
    text("QTY / UNIT", 139, y + 6.5, 7, white, "bold", "right");
    text("UNIT PRICE", 166, y + 6.5, 7, white, "bold", "right");
    text("AMOUNT", rightEdge - 3, y + 6.5, 7, white, "bold", "right");

    y += 13;
  }

  // Top accent bar
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageWidth, 4, "F");

  // Business logo. JPEG and PNG are supported by jsPDF's standard fonts.
  let logoDrawn = false;
  const logo = invoice.business.logo;

  if (logo) {
    const format = pdfLogoFormat(logo);

    if (format) {
      try {
        doc.addImage(logo, format, margin, y - 2, 20, 20, undefined, "FAST");
        logoDrawn = true;
      } catch {
        // If an image cannot be embedded, keep the invoice usable.
        logoDrawn = false;
      }
    }
  }

  const businessX = logoDrawn ? margin + 25 : margin;
  const businessWidth = logoDrawn ? 100 : 110;

  const businessName = invoice.business.name || "Your Business";

  const businessNameLines = doc.splitTextToSize(
    businessName,
    businessWidth
  ) as string[];

  text(businessNameLines[0] || businessName, businessX, y + 2, 15, accent, "bold");

  let businessY = y + 8;

  for (const lineText of businessNameLines.slice(1)) {
    text(lineText, businessX, businessY, 12, accent, "bold");
    businessY += 5;
  }

  const businessLines = [
    invoice.business.address,
    invoice.business.email,
    invoice.business.phone,
    invoice.business.website
  ].filter(Boolean);

  for (const value of businessLines) {
    businessY += wrapped(value, businessX, businessY, businessWidth, 8, muted) + 1;
  }

  text("INVOICE", rightEdge, y + 2, 21, dark, "bold", "right");

  text(
    invoice.invoiceNumber || "INV-0001",
    rightEdge,
    y + 9,
    9,
    dark,
    "bold",
    "right"
  );

  y = Math.max(businessY, y + 24) + 7;

  // Invoice metadata panel
  const metadataHeight = 27;

  doc.setFillColor(light[0], light[1], light[2]);
  doc.roundedRect(margin, y, contentWidth, metadataHeight, 2, 2, "F");

  const metadata = [
    { label: "INVOICE NUMBER", value: invoice.invoiceNumber || "—" },
    { label: "ISSUED", value: pdfDate(invoice.issueDate) },
    ...(showDueDate
      ? [{ label: "DUE DATE", value: pdfDate(invoice.dueDate) }]
      : [])
  ];

  const columnWidth = contentWidth / metadata.length;

  metadata.forEach((item, index) => {
    const x = margin + 5 + index * columnWidth;

    text(item.label, x, y + 8, 7, muted, "bold");
    text(item.value, x, y + 16, 9, dark, "bold");
  });

  y += metadataHeight + 11;

  // Client information
  text("BILL TO", margin, y, 8, muted, "bold");
  y += 7;

  text(invoice.client.name || "Client", margin, y, 11, dark, "bold");
  y += 6;

  for (const value of [
    invoice.client.address,
    invoice.client.email,
    invoice.client.taxId ? `Tax ID: ${invoice.client.taxId}` : ""
  ].filter(Boolean)) {
    y += wrapped(value, margin, y, 115, 8, muted) + 1;
  }

  if (invoice.purchaseOrder) {
    y += 2;
    text(`Purchase order: ${invoice.purchaseOrder}`, margin, y, 8, muted);
    y += 5;
  }

  y += 7;

  // Item table
  drawTableHeader();

  for (const item of invoice.items) {
    const description = item.description || "Item";
    const descriptionLines = doc.splitTextToSize(description, 88) as string[];
    const unitText = `${item.quantity}${item.unit?.trim() ? ` ${item.unit.trim()}` : ""}`;
    const rowHeight = Math.max(
      10,
      descriptionLines.length * 4.5 + (item.discount > 0 ? 9 : 5)
    );

    ensureSpace(rowHeight + 2);

    // Repeat the column heading when a row continues onto a new page.
    if (y === 20) {
      drawTableHeader();
    }

    text(descriptionLines[0] || description, margin + 3, y + 2, 8, dark);

    if (descriptionLines.length > 1) {
      setTextStyle(8, dark);
      doc.text(descriptionLines.slice(1), margin + 3, y + 6.5);
    }

    text(unitText, 139, y + 2, 7, dark, "normal", "right");

    text(
      pdfCurrency(item.unitPrice, invoice.currency),
      166,
      y + 2,
      7,
      dark,
      "normal",
      "right"
    );

    text(
      pdfCurrency(calculateItemTotal(item), invoice.currency),
      rightEdge - 3,
      y + 2,
      7,
      dark,
      "bold",
      "right"
    );

    if (item.discount > 0) {
      text(`${item.discount}% discount`, margin + 3, y + 6.5, 7, muted);
    }

    y += rowHeight;
    drawLine(y);
    y += 3;
  }

  // Totals area with a consistent right-aligned amount column.
  y += 4;

  const totalsWidth = 76;
  const totalsLeft = rightEdge - totalsWidth;
  const labelX = totalsLeft;
  const valueX = rightEdge - 3;

  const totalRows: [string, number][] = [
    ["Subtotal", totals.subtotal]
  ];

  if (totals.itemDiscount > 0) {
    totalRows.push(["Item discounts", -totals.itemDiscount]);
  }

  if (totals.invoiceDiscount > 0) {
    totalRows.push(["Invoice discount", -totals.invoiceDiscount]);
  }

  if (totals.tax > 0) {
    totalRows.push([invoice.taxLabel || "Tax", totals.tax]);
  }

  if (totals.shipping > 0) {
    totalRows.push(["Additional charges", totals.shipping]);
  }

  for (const [label, amount] of totalRows) {
    ensureSpace(8);

    text(label, labelX, y, 8, muted);

    text(
      `${amount < 0 ? "-" : ""}${pdfCurrency(Math.abs(amount), invoice.currency)}`,
      valueX,
      y,
      8,
      dark,
      "normal",
      "right"
    );

    y += 7;
  }

  ensureSpace(24);

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(totalsLeft - 4, y - 3, totalsWidth + 4, 13, 2, 2, "F");

  text("TOTAL", labelX, y + 5, 9, white, "bold");

  text(
    pdfCurrency(totals.total, invoice.currency),
    valueX,
    y + 5,
    9,
    white,
    "bold",
    "right"
  );

  y += 17;

  if (totals.amountPaid > 0) {
    ensureSpace(8);

    text("Amount paid", labelX, y, 8, muted);
    text(
      pdfCurrency(totals.amountPaid, invoice.currency),
      valueX,
      y,
      8,
      dark,
      "normal",
      "right"
    );

    y += 7;
  }

  ensureSpace(10);

  text("BALANCE DUE", labelX, y, 8, accent, "bold");

  text(
    pdfCurrency(totals.balance, invoice.currency),
    valueX,
    y,
    9,
    accent,
    "bold",
    "right"
  );

  y += 12;

  // Notes and payment instructions
  const noteSections = [
    ["PAYMENT INSTRUCTIONS", invoice.paymentInstructions],
    ["NOTES", invoice.notes]
  ] as const;

  for (const [heading, value] of noteSections) {
    if (!value.trim()) continue;

    ensureSpace(18);

    text(heading, margin, y, 7, muted, "bold");
    y += 5;

    y += wrapped(value, margin, y, contentWidth, 8, dark) + 5;
  }

  if (invoice.paymentTerms) {
    ensureSpace(10);

    text(`Payment terms: ${invoice.paymentTerms}`, margin, y, 8, muted);
    y += 6;
  }

  if (invoice.footer) {
    ensureSpace(12);

    drawLine(y);
    y += 7;

    wrapped(invoice.footer, margin, y, contentWidth, 8, muted);
  }

  // Footer and page numbers
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    text(
      `InvoiceLite  |  ${page} / ${pageCount}`,
      pageWidth / 2,
      pageHeight - 7,
      7,
      muted,
      "normal",
      "center"
    );
  }

  doc.save(`${safeFilename(invoice.invoiceNumber)}.pdf`);
}
