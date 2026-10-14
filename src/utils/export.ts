import { jsPDF } from "jspdf";
import type { Invoice, StorageData } from "../types";
import { calculateTotals, calculateItemTotal } from "./calculations";
import { formatCurrency, formatDate } from "./formatting";

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
  return value
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "invoice";
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

  const text = await file.text();

  try {
    return JSON.parse(text) as unknown;
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

  let y = 18;

  function text(
    value: string,
    x: number,
    yPosition: number,
    size = 9,
    color: number[] = dark,
    style: "normal" | "bold" = "normal",
    options: Record<string, unknown> = {}
  ): void {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x, yPosition, options);
  }

  function line(yPosition: number): void {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
  }

  function ensureSpace(height: number): void {
    if (y + height > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  }

  function wrapped(
    value: string,
    x: number,
    yPosition: number,
    maxWidth: number,
    size = 9,
    color: number[] = dark
  ): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(value || " ", maxWidth) as string[];
    doc.text(lines, x, yPosition);

    return lines.length * (size * 0.42 + 1.2);
  }

  // Header
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageWidth, 4, "F");

  text(
    invoice.business.name || "Your Business",
    margin,
    y,
    15,
    accent,
    "bold"
  );

  text("INVOICE", pageWidth - margin, y + 1, 21, dark, "bold", {
    align: "right"
  });

  y += 8;

  const businessLines = [
    invoice.business.address,
    invoice.business.email,
    invoice.business.phone,
    invoice.business.website
  ].filter(Boolean);

  for (const value of businessLines) {
    y += wrapped(value, margin, y, 90, 8, muted) + 1;
  }

  y += 7;

  // Invoice metadata
  doc.setFillColor(light[0], light[1], light[2]);
  doc.roundedRect(margin, y, contentWidth, 27, 2, 2, "F");

  const metaColumns = [
    { label: "INVOICE NUMBER", value: invoice.invoiceNumber },
    { label: "ISSUED", value: formatDate(invoice.issueDate) },
    { label: "DUE DATE", value: formatDate(invoice.dueDate) }
  ];

  metaColumns.forEach((meta, index) => {
    const x = margin + 5 + index * (contentWidth / 3);

    text(meta.label, x, y + 8, 7, muted, "bold");
    text(meta.value || "—", x, y + 16, 9, dark, "bold");
  });

  y += 37;

  // Client details
  text("BILL TO", margin, y, 8, muted, "bold");
  y += 7;

  text(invoice.client.name || "Client", margin, y, 11, dark, "bold");
  y += 6;

  for (const value of [
    invoice.client.address,
    invoice.client.email,
    invoice.client.taxId ? `Tax ID: ${invoice.client.taxId}` : ""
  ].filter(Boolean)) {
    y += wrapped(value, margin, y, 110, 8, muted) + 1;
  }

  y += 9;

  // Item table
  const col = {
    description: margin + 3,
    quantity: 139,
    price: 158,
    total: pageWidth - margin - 3
  };

  function tableHeader(): void {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(margin, y, contentWidth, 10, "F");

    text("DESCRIPTION", col.description, y + 6.5, 7, [255, 255, 255], "bold");
    text("QTY", col.quantity, y + 6.5, 7, [255, 255, 255], "bold", {
      align: "right"
    });
    text("UNIT PRICE", col.price, y + 6.5, 7, [255, 255, 255], "bold", {
      align: "right"
    });
    text("AMOUNT", col.total, y + 6.5, 7, [255, 255, 255], "bold", {
      align: "right"
    });

    y += 13;
  }

  tableHeader();

  for (const item of invoice.items) {
    const descriptionLines = doc.splitTextToSize(
      item.description || "Item",
      105
    ) as string[];

    const rowHeight = Math.max(10, descriptionLines.length * 4.5 + 5);
    ensureSpace(rowHeight + 2);

    if (y === 20) {
      tableHeader();
    }

    text(
      item.description || "Item",
      col.description,
      y + 2,
      8,
      dark
    );

    if (descriptionLines.length > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text(descriptionLines.slice(1), col.description, y + 6.5);
    }

    text(String(item.quantity), col.quantity, y + 2, 8, dark, "normal", {
      align: "right"
    });

    text(
      formatCurrency(item.unitPrice, invoice.currency),
      col.price,
      y + 2,
      7,
      dark,
      "normal",
      { align: "right" }
    );

    text(
      formatCurrency(calculateItemTotal(item), invoice.currency),
      col.total,
      y + 2,
      7,
      dark,
      "bold",
      { align: "right" }
    );

    if (item.discount > 0) {
      text(
        `${item.discount}% discount`,
        col.description,
        y + 6.5,
        7,
        muted
      );
    }

    y += rowHeight;
    line(y);
    y += 3;
  }

  // Totals
  y += 4;
  const labelX = 125;
  const valueX = pageWidth - margin - 3;

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
      `${amount < 0 ? "−" : ""}${formatCurrency(Math.abs(amount), invoice.currency)}`,
      valueX,
      y,
      8,
      dark,
      "normal",
      { align: "right" }
    );

    y += 7;
  }

  ensureSpace(22);

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(labelX - 4, y - 3, valueX - labelX + 7, 13, 2, 2, "F");

  text("TOTAL", labelX, y + 5, 9, [255, 255, 255], "bold");

  text(
    formatCurrency(totals.total, invoice.currency),
    valueX,
    y + 5,
    10,
    [255, 255, 255],
    "bold",
    { align: "right" }
  );

  y += 17;

  if (totals.amountPaid > 0) {
    ensureSpace(8);
    text("Amount paid", labelX, y, 8, muted);
    text(
      formatCurrency(totals.amountPaid, invoice.currency),
      valueX,
      y,
      8,
      dark,
      "normal",
      { align: "right" }
    );
    y += 7;
  }

  ensureSpace(10);
  text("BALANCE DUE", labelX, y, 8, accent, "bold");
  text(
    formatCurrency(totals.balance, invoice.currency),
    valueX,
    y,
    10,
    accent,
    "bold",
    { align: "right" }
  );

  y += 12;

  for (const [heading, value] of [
    ["PAYMENT INSTRUCTIONS", invoice.paymentInstructions],
    ["NOTES", invoice.notes]
  ] as const) {
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
    line(y);
    y += 7;
    wrapped(invoice.footer, margin, y, contentWidth, 8, muted);
  }

  // Add page numbers without modifying the invoice content.
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    text(
      `InvoiceLite  ·  ${page} / ${pageCount}`,
      pageWidth / 2,
      pageHeight - 7,
      7,
      muted,
      "normal",
      { align: "center" }
    );
  }

  doc.save(`${safeFilename(invoice.invoiceNumber)}.pdf`);
}
