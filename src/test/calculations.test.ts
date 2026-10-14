import { describe, expect, it } from "vitest";
import { calculateItemTotal, calculateTotals, getInvoiceStatus } from "../utils/calculations";
import type { Invoice } from "../types";

const invoice: Invoice = {
  id: "test-1",
  version: 1,
  invoiceNumber: "INV-001",
  issueDate: "2026-10-01",
  dueDate: "2026-10-10",
  currency: "INR",
  paymentTerms: "Due in 9 days",
  purchaseOrder: "",
  business: {
    name: "Test Studio",
    address: "",
    email: "",
    phone: "",
    website: "",
    logo: ""
  },
  client: {
    name: "Test Client",
    email: "",
    address: "",
    taxId: ""
  },
  items: [
    {
      id: "item-1",
      description: "Design work",
      quantity: 2,
      unitPrice: 1000,
      discount: 10
    }
  ],
  discountType: "percent",
  invoiceDiscount: 0,
  taxLabel: "Tax",
  taxRate: 10,
  shipping: 0,
  amountPaid: 0,
  notes: "",
  paymentInstructions: "",
  footer: "",
  template: "modern",
  status: "sent",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z"
};

describe("invoice calculations", () => {
  it("calculates a line item with a discount", () => {
    expect(
      calculateItemTotal({
        id: "1",
        description: "Service",
        quantity: 2,
        unitPrice: 100,
        discount: 10
      })
    ).toBe(180);
  });

  it("calculates subtotal, discount, tax, and total", () => {
    const result = calculateTotals(invoice);

    expect(result.subtotal).toBe(2000);
    expect(result.itemDiscount).toBe(200);
    expect(result.taxableAmount).toBe(1800);
    expect(result.tax).toBe(180);
    expect(result.total).toBe(1980);
    expect(result.balance).toBe(1980);
  });

  it("applies invoice-wide discounts after item discounts", () => {
    const result = calculateTotals({
      ...invoice,
      invoiceDiscount: 10
    });

    expect(result.invoiceDiscount).toBe(180);
    expect(result.taxableAmount).toBe(1620);
    expect(result.tax).toBe(162);
    expect(result.total).toBe(1782);
  });

  it("calculates a partially paid invoice", () => {
    const result = calculateTotals({
      ...invoice,
      amountPaid: 500
    });

    expect(result.amountPaid).toBe(500);
    expect(result.balance).toBe(1480);
  });

  it("does not allow an invoice discount to exceed the discounted subtotal", () => {
    const result = calculateTotals({
      ...invoice,
      discountType: "fixed",
      invoiceDiscount: 999999
    });

    expect(result.invoiceDiscount).toBe(1800);
    expect(result.taxableAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it("derives overdue status from the due date", () => {
    expect(getInvoiceStatus(invoice, "2026-10-14")).toBe("overdue");
  });

  it("recognizes a fully paid invoice", () => {
    expect(
      getInvoiceStatus({
        ...invoice,
        amountPaid: 1980
      }, "2026-10-14")
    ).toBe("paid");
  });

  it("handles decimal prices without common floating-point errors", () => {
    const result = calculateTotals({
      ...invoice,
      items: [
        {
          id: "decimal",
          description: "Small item",
          quantity: 3,
          unitPrice: 0.1,
          discount: 0
        }
      ],
      taxRate: 0,
      shipping: 0
    });

    expect(result.subtotal).toBe(0.3);
    expect(result.total).toBe(0.3);
  });
});
