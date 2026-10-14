import type { Invoice } from "../types";
import { calculateTotals } from "./calculations";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateInvoice(invoice: Invoice): ValidationResult {
  const errors: string[] = [];

  if (!invoice.business.name.trim()) {
    errors.push("Enter your business or freelancer name.");
  }

  if (!invoice.client.name.trim()) {
    errors.push("Enter the client or company name.");
  }

  if (!invoice.invoiceNumber.trim()) {
    errors.push("Enter an invoice number.");
  }

  if (!invoice.issueDate) {
    errors.push("Choose an issue date.");
  }

  if (!invoice.dueDate) {
    errors.push("Choose a due date.");
  }

  if (
    invoice.issueDate &&
    invoice.dueDate &&
    invoice.dueDate < invoice.issueDate
  ) {
    errors.push("The due date cannot be before the issue date.");
  }

  if (invoice.items.length === 0) {
    errors.push("Add at least one line item.");
  }

  if (invoice.items.length > 100) {
    errors.push("An invoice cannot contain more than 100 line items.");
  }

  invoice.items.forEach((item, index) => {
    const number = index + 1;

    if (!item.description.trim()) {
      errors.push(`Enter a description for item ${number}.`);
    }

    if (
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 1_000_000
    ) {
      errors.push(`Item ${number} needs a valid positive quantity.`);
    }

    if (
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0 ||
      item.unitPrice > 1_000_000_000
    ) {
      errors.push(`Item ${number} needs a valid nonnegative unit price.`);
    }

    if (
      !Number.isFinite(item.discount) ||
      item.discount < 0 ||
      item.discount > 100
    ) {
      errors.push(`Item ${number} discount must be between 0% and 100%.`);
    }
  });

  if (
    !Number.isFinite(invoice.taxRate) ||
    invoice.taxRate < 0 ||
    invoice.taxRate > 100
  ) {
    errors.push("The tax rate must be between 0% and 100%.");
  }

  if (
    !Number.isFinite(invoice.invoiceDiscount) ||
    invoice.invoiceDiscount < 0
  ) {
    errors.push("The invoice discount must be nonnegative.");
  }

  if (
    invoice.discountType === "percent" &&
    invoice.invoiceDiscount > 100
  ) {
    errors.push("The invoice discount cannot exceed 100%.");
  }

  if (
    !Number.isFinite(invoice.shipping) ||
    invoice.shipping < 0
  ) {
    errors.push("Additional charges must be nonnegative.");
  }

  if (
    !Number.isFinite(invoice.amountPaid) ||
    invoice.amountPaid < 0
  ) {
    errors.push("The amount paid must be nonnegative.");
  }

  const totals = calculateTotals(invoice);

  if (invoice.amountPaid > totals.total) {
    errors.push("The amount paid cannot exceed the invoice total.");
  }

  if (
    invoice.business.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.business.email)
  ) {
    errors.push("Enter a valid business email address.");
  }

  if (
    invoice.client.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.client.email)
  ) {
    errors.push("Enter a valid client email address.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
