
import { useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Upload,
  Building2,
  UserRound,
  FileText,
  ReceiptText,
  CreditCard
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import type { Invoice, InvoiceItem } from "../types";
import { CURRENCIES } from "../types";
import { calculateTotals, calculateItemTotal } from "../utils/calculations";
import { formatCurrency, createId } from "../utils/formatting";

interface InvoiceEditorProps {
  invoice: Invoice;
  onChange: (invoice: Invoice) => void;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50";

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  min,
  max,
  step,
  multiline = false
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  multiline?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {multiline ? (
        <textarea
          value={String(value)}
          placeholder={placeholder}
          required={required}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input
          type={type}
          value={String(value)}
          placeholder={placeholder}
          required={required}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
    </label>
  );
}

function Section({
  title,
  description,
  icon,
  children
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function InvoiceEditor({ invoice, onChange }: InvoiceEditorProps) {
  const [logoError, setLogoError] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);
  const totals = calculateTotals(invoice);

  function update<K extends keyof Invoice>(key: K, value: Invoice[K]) {
    onChange({ ...invoice, [key]: value });
  }

  function updateItem(id: string, changes: Partial<InvoiceItem>) {
    update(
      "items",
      invoice.items.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      )
    );
  }

  function addItem() {
    if (invoice.items.length >= 100) {
      window.alert("An invoice can contain a maximum of 100 items.");
      return;
    }

    update("items", [
      ...invoice.items,
      {
        id: createId(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        unit: "pcs"
      }
    ]);
  }

  async function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoError("");

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setLogoError("Use a PNG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      setLogoError("Your logo must be smaller than 1 MB.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.onload = () => {
          if (typeof reader.result !== "string") {
            reject(new Error("Invalid image."));
            return;
          }
          resolve(reader.result);
        };
        reader.readAsDataURL(file);
      });

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Image could not be loaded."));
        image.src = dataUrl;
      });

      if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        image.naturalWidth > 5000 ||
        image.naturalHeight > 5000
      ) {
        throw new Error("Image dimensions are not supported.");
      }

      update("business", { ...invoice.business, logo: dataUrl });
    } catch {
      setLogoError("Could not use this image. Try another file.");
    }

    event.target.value = "";
  }

  return (
    <div className="space-y-5">
      <Section
        title="Your business"
        description="The sender details shown on your invoice."
        icon={<Building2 size={19} />}
      >
        <div className="space-y-4">
          <Field
            label="Business or freelancer name"
            value={invoice.business.name}
            onChange={(v) => update("business", { ...invoice.business, name: v })}
            placeholder="Your Studio"
            required
          />
          <Field
            label="Business address"
            value={invoice.business.address}
            onChange={(v) => update("business", { ...invoice.business, address: v })}
            placeholder="Street, city, postal code"
            multiline
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              type="email"
              value={invoice.business.email}
              onChange={(v) => update("business", { ...invoice.business, email: v })}
              placeholder="hello@example.com"
            />
            <Field
              label="Phone"
              value={invoice.business.phone}
              onChange={(v) => update("business", { ...invoice.business, phone: v })}
              placeholder="+91 00000 00000"
            />
          </div>

          <Field
            label="Website"
            value={invoice.business.website}
            onChange={(v) => update("business", { ...invoice.business, website: v })}
            placeholder="https://example.com"
          />

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Business logo
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {invoice.business.logo && (
                <img
                  src={invoice.business.logo}
                  alt="Business logo preview"
                  className="h-12 w-12 rounded-lg border border-slate-200 object-contain p-1"
                />
              )}

              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Upload size={16} />
                Upload logo
              </button>

              {invoice.business.logo && (
                <button
                  type="button"
                  onClick={() => update("business", { ...invoice.business, logo: "" })}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}

              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogo}
              />
            </div>

            {logoError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {logoError}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              PNG, JPEG or WebP. Maximum 1 MB.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Client details"
        description="Who is this invoice for?"
        icon={<UserRound size={19} />}
      >
        <div className="space-y-4">
          <Field
            label="Client or company name"
            value={invoice.client.name}
            onChange={(v) => update("client", { ...invoice.client, name: v })}
            placeholder="Client company"
            required
          />
          <Field
            label="Client email"
            type="email"
            value={invoice.client.email}
            onChange={(v) => update("client", { ...invoice.client, email: v })}
            placeholder="client@example.com"
          />
          <Field
            label="Client address"
            value={invoice.client.address}
            onChange={(v) => update("client", { ...invoice.client, address: v })}
            placeholder="Street, city, postal code"
            multiline
          />
          <Field
            label="Tax identification number (optional)"
            value={invoice.client.taxId}
            onChange={(v) => update("client", { ...invoice.client, taxId: v })}
            placeholder="Client tax ID"
          />
        </div>
      </Section>

      <Section
        title="Invoice details"
        description="Dates, currency, and payment terms."
        icon={<FileText size={19} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Invoice number"
            value={invoice.invoiceNumber}
            onChange={(v) => update("invoiceNumber", v)}
            required
          />

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            <span>Currency</span>
            <select
              value={invoice.currency}
              onChange={(e) => update("currency", e.target.value as Invoice["currency"])}
              className={inputClass}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Issue date"
            type="date"
            value={invoice.issueDate}
            onChange={(v) => update("issueDate", v)}
            required
          />

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={invoice.showDueDate !== false}
                onChange={(e) => update("showDueDate", e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              Show payment due date on invoice
            </label>

            {invoice.showDueDate !== false && (
              <Field
                label="Payment due date"
                type="date"
                value={invoice.dueDate}
                onChange={(v) => update("dueDate", v)}
              />
            )}
          </div>

          <Field
            label="Payment terms"
            value={invoice.paymentTerms}
            onChange={(v) => update("paymentTerms", v)}
            placeholder="Due within 14 days"
          />

          <Field
            label="Purchase order number"
            value={invoice.purchaseOrder}
            onChange={(v) => update("purchaseOrder", v)}
            placeholder="Optional PO number"
          />
        </div>
      </Section>

      <Section
        title="Items and services"
        description="Add products, work, or services. Units can be pcs, sq ft, m², hours, kg, litres, metres, days, or your own unit."
        icon={<ReceiptText size={19} />}
      >
        <div className="space-y-4">
          {invoice.items.map((item, index) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Item {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => update("items", invoice.items.filter((i) => i.id !== item.id))}
                  aria-label={`Remove item ${index + 1}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <Field
                  label="Description"
                  value={item.description}
                  onChange={(v) => updateItem(item.id, { description: v })}
                  placeholder="e.g. Floor tiling, website design, painting"
                  required
                />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field
                    label="Quantity"
                    type="number"
                    min={0}
                    max={1000000}
                    step={0.01}
                    value={item.quantity}
                    onChange={(v) => updateItem(item.id, { quantity: v === "" ? 0 : Number(v) })}
                  />

                  <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                    <span>Unit</span>
                    <input
                      list={`unit-options-${item.id}`}
                      value={item.unit ?? ""}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                      placeholder="e.g. sq ft"
                      className={inputClass}
                    />
                    <datalist id={`unit-options-${item.id}`}>
                      <option value="pcs" />
                      <option value="sq ft" />
                      <option value="sq m" />
                      <option value="m²" />
                      <option value="m³" />
                      <option value="hours" />
                      <option value="days" />
                      <option value="kg" />
                      <option value="g" />
                      <option value="litres" />
                      <option value="metres" />
                      <option value="feet" />
                      <option value="boxes" />
                      <option value="sets" />
                    </datalist>
                  </label>

                  <Field
                    label="Unit price"
                    type="number"
                    min={0}
                    max={1000000000}
                    step={0.01}
                    value={item.unitPrice}
                    onChange={(v) => updateItem(item.id, { unitPrice: v === "" ? 0 : Number(v) })}
                  />

                  <Field
                    label="Discount (%)"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={item.discount}
                    onChange={(v) => updateItem(item.id, { discount: v === "" ? 0 : Number(v) })}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-500">Line total</span>
                  <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">
                    {formatCurrency(calculateItemTotal(item), invoice.currency)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            disabled={invoice.items.length >= 100}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
          >
            <Plus size={17} />
            Add line item
          </button>
        </div>
      </Section>

      <Section
        title="Taxes and totals"
        description="Configure calculations for your billing requirements."
        icon={<CreditCard size={19} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tax label"
            value={invoice.taxLabel}
            onChange={(v) => update("taxLabel", v)}
            placeholder="Tax, VAT, GST..."
          />
          <Field
            label="Tax rate (%)"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={invoice.taxRate}
            onChange={(v) => update("taxRate", v === "" ? 0 : Number(v))}
          />

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            <span>Invoice discount type</span>
            <select
              value={invoice.discountType}
              onChange={(e) => update("discountType", e.target.value as Invoice["discountType"])}
              className={inputClass}
            >
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>

          <Field
            label={invoice.discountType === "percent" ? "Invoice discount (%)" : "Invoice discount amount"}
            type="number"
            min={0}
            max={invoice.discountType === "percent" ? 100 : 1000000000}
            step={0.01}
            value={invoice.invoiceDiscount}
            onChange={(v) => update("invoiceDiscount", v === "" ? 0 : Number(v))}
          />

          <Field
            label="Shipping or additional charges"
            type="number"
            min={0}
            step={0.01}
            value={invoice.shipping}
            onChange={(v) => update("shipping", v === "" ? 0 : Number(v))}
          />

          <Field
            label="Amount already paid"
            type="number"
            min={0}
            step={0.01}
            value={invoice.amountPaid}
            onChange={(v) => update("amountPaid", v === "" ? 0 : Number(v))}
          />
        </div>

        <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
          {[
            ["Subtotal", totals.subtotal],
            ["Item discounts", -totals.itemDiscount],
            ["Invoice discount", -totals.invoiceDiscount],
            [invoice.taxLabel || "Tax", totals.tax],
            ["Additional charges", totals.shipping]
          ].map(([label, amount]) => (
            <div
              key={String(label)}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm"
            >
              <span className="text-slate-500">{String(label)}</span>
              <span className="whitespace-nowrap text-right font-medium tabular-nums text-slate-800">
                {Number(amount) < 0 ? "−" : ""}
                {formatCurrency(Math.abs(Number(amount)), invoice.currency)}
              </span>
            </div>
          ))}

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-slate-200 pt-3 text-base font-bold">
            <span>Total</span>
            <span className="whitespace-nowrap text-right tabular-nums">
              {formatCurrency(totals.total, invoice.currency)}
            </span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
            <span className="text-slate-500">Balance due</span>
            <span className="whitespace-nowrap text-right font-semibold tabular-nums text-indigo-700">
              {formatCurrency(totals.balance, invoice.currency)}
            </span>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Tax is calculated after discounts and before additional charges.
            Review your applicable tax rules before issuing an invoice.
          </p>
        </div>
      </Section>

      <Section
        title="Notes and payment"
        description="Give your client any extra information they need."
        icon={<FileText size={19} />}
      >
        <div className="space-y-4">
          <Field
            label="Payment instructions"
            value={invoice.paymentInstructions}
            onChange={(v) => update("paymentInstructions", v)}
            placeholder="Bank transfer details or preferred payment method"
            multiline
          />
          <Field
            label="Notes"
            value={invoice.notes}
            onChange={(v) => update("notes", v)}
            placeholder="Thank you for your business."
            multiline
          />
          <Field
            label="Invoice footer"
            value={invoice.footer}
            onChange={(v) => update("footer", v)}
            placeholder="Additional terms or business information"
            multiline
          />
        </div>
      </Section>
    </div>
  );
}
