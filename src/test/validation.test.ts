import { describe, expect, it } from "vitest";
import { validateInvoice } from "../utils/validation";
import type { Invoice } from "../types";

const validInvoice: Invoice = {
  id: "test-1",
  version: 1,
  invoiceNumber: "INV-001",
  issueDate: "2026-10-01",
  dueDate: "2026-10-15",
  currency: "INR",
  paymentTerms: "Due in 14 days",
  purchaseOrder: "",
  business: {
    name: "Studio",
    address: "",
    email: "studio@example.com",
    phone: "",
    website: "",
    logo: ""
  },
  client: {
    name: "Client",
    email: "client@example.com",
    address: "",
    taxId: ""
  },
  items: [
    {
      id: "item-1",
      description: "Consulting",
      quantity: 1,
      unitPrice: 500,
      discount: 0
    }
  ],
  discountType: "percent",
  invoiceDiscount: 0,
  taxLabel: "Tax",
  taxRate: 0,
  shipping: 0,
  amountPaid: 0,
  notes: "",
  paymentInstructions: "",
  footer: "",
  template: "modern",
  status: "draft",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z"
};

describe("invoice validation", () => {
  it("accepts a valid invoice", () => {
    expect(validateInvoice(validInvoice)).toEqual({
      valid: true,
      errors: []
    });
  });

  it("requires a client name", () => {
    const result = validateInvoice({
      ...validInvoice,
      client: {
        ...validInvoice.client,
        name: " "
      }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Enter the client or company name.");
  });

  it("rejects negative prices", () => {
    const result = validateInvoice({
      ...validInvoice,
      items: [
        {
          ...validInvoice.items[0],
          unitPrice: -1
        }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Item 1 needs a valid nonnegative unit price."
    );
  });

  it("rejects a due date before the issue date", () => {
    const result = validateInvoice({
      ...validInvoice,
      dueDate: "2026-09-30"
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "The due date cannot be before the issue date."
    );
  });

  it("rejects invalid email addresses", () => {
    const result = validateInvoice({
      ...validInvoice,
      client: {
        ...validInvoice.client,
        email: "not-an-email"
      }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Enter a valid client email address.");
  });

  it("rejects discounts above 100 percent", () => {
    const result = validateInvoice({
      ...validInvoice,
      items: [
        {
          ...validInvoice.items[0],
          discount: 101
        }
      ]
    });

    expect(result.valid).toBe(false);
  });
});
