import type {
  Invoice,
  InvoiceItem,
  InvoiceTotals
} from "../types";

function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromMinorUnits(amount: number): number {
  return amount / 100;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function calculateItemTotal(item: InvoiceItem): number {
  const quantity = clamp(item.quantity, 0, 1_000_000);
  const unitPrice = clamp(item.unitPrice, 0, 1_000_000_000);
  const discountRate = clamp(item.discount, 0, 100);

  const gross = toMinorUnits(quantity * unitPrice);
  const discount = Math.round(gross * discountRate / 100);

  return fromMinorUnits(Math.max(0, gross - discount));
}

export function calculateTotals(invoice: Invoice): InvoiceTotals {
  const subtotalMinor = invoice.items.reduce(
    (sum, item) => {
      const gross = toMinorUnits(
        clamp(item.quantity, 0, 1_000_000) *
        clamp(item.unitPrice, 0, 1_000_000_000)
      );

      return sum + gross;
    },
    0
  );

  const itemDiscountMinor = invoice.items.reduce(
    (sum, item) => {
      const gross = toMinorUnits(
        clamp(item.quantity, 0, 1_000_000) *
        clamp(item.unitPrice, 0, 1_000_000_000)
      );

      return sum + Math.round(
        gross * clamp(item.discount, 0, 100) / 100
      );
    },
    0
  );

  const afterItemDiscount = Math.max(
    0,
    subtotalMinor - itemDiscountMinor
  );

  const rawInvoiceDiscount =
    invoice.discountType === "percent"
      ? Math.round(
          afterItemDiscount *
          clamp(invoice.invoiceDiscount, 0, 100) / 100
        )
      : toMinorUnits(clamp(invoice.invoiceDiscount, 0, 1_000_000_000));

  const invoiceDiscountMinor = Math.min(
    afterItemDiscount,
    rawInvoiceDiscount
  );

  const taxableMinor = Math.max(
    0,
    afterItemDiscount - invoiceDiscountMinor
  );

  const taxMinor = Math.round(
    taxableMinor * clamp(invoice.taxRate, 0, 100) / 100
  );

  const shippingMinor = toMinorUnits(
    clamp(invoice.shipping, 0, 1_000_000_000)
  );

  const totalMinor = Math.max(
    0,
    taxableMinor + taxMinor + shippingMinor
  );

  const paidMinor = Math.min(
    totalMinor,
    toMinorUnits(clamp(invoice.amountPaid, 0, 1_000_000_000))
  );

  return {
    subtotal: fromMinorUnits(subtotalMinor),
    itemDiscount: fromMinorUnits(itemDiscountMinor),
    invoiceDiscount: fromMinorUnits(invoiceDiscountMinor),
    taxableAmount: fromMinorUnits(taxableMinor),
    tax: fromMinorUnits(taxMinor),
    shipping: fromMinorUnits(shippingMinor),
    total: fromMinorUnits(totalMinor),
    amountPaid: fromMinorUnits(paidMinor),
    balance: fromMinorUnits(totalMinor - paidMinor)
  };
}

export function getInvoiceStatus(
  invoice: Invoice,
  today = new Date().toISOString().slice(0, 10)
): "draft" | "sent" | "paid" | "overdue" {
  const totals = calculateTotals(invoice);

  if (totals.balance <= 0 && totals.total > 0) {
    return "paid";
  }

  if (invoice.status === "draft") {
    return "draft";
  }

  if (invoice.dueDate && invoice.dueDate < today && totals.balance > 0) {
    return "overdue";
  }

  return invoice.status;
}
