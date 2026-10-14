
import type { CSSProperties } from "react";
import { calculateTotals, calculateItemTotal } from "../utils/calculations";
import { formatCurrency, formatDate } from "../utils/formatting";
import type { Invoice } from "../types";

interface InvoicePreviewProps {
  invoice: Invoice;
  compact?: boolean;
}

const templateStyles = {
  classic: {
    accent: "#374151",
    background: "#ffffff",
    heading: "font-serif",
    border: "border-slate-300",
    label: "uppercase tracking-wider"
  },
  modern: {
    accent: "#4f46e5",
    background: "#ffffff",
    heading: "font-sans",
    border: "border-indigo-100",
    label: "uppercase tracking-widest"
  },
  elegant: {
    accent: "#896642",
    background: "#fffdf9",
    heading: "font-serif",
    border: "border-amber-200",
    label: "uppercase tracking-widest"
  }
} as const;

export default function InvoicePreview({
  invoice,
  compact = false
}: InvoicePreviewProps) {
  const totals = calculateTotals(invoice);
  const style = templateStyles[invoice.template];
  const showDueDate = invoice.showDueDate !== false;

  const accentStyle = {
    "--invoice-accent": style.accent
  } as CSSProperties;

  const amountClass =
    "whitespace-nowrap text-right tabular-nums";

  return (
    <article
      className={`invoice-paper mx-auto w-full max-w-[800px] overflow-hidden border border-slate-200 shadow-sm ${style.heading}`}
      style={{
        ...accentStyle,
        backgroundColor: style.background
      }}
    >
      <div
        className="h-2 w-full"
        style={{ backgroundColor: style.accent }}
      />

      <div className={compact ? "p-5 sm:p-7" : "p-5 sm:p-10"}>
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-3">
            {invoice.business.logo && (
              <img
                src={invoice.business.logo}
                alt={`${invoice.business.name || "Business"} logo`}
                className="h-14 w-14 shrink-0 rounded-lg object-contain"
              />
            )}

            <div className="min-w-0">
              <h2
                className="break-words text-xl font-bold sm:text-2xl"
                style={{ color: style.accent }}
              >
                {invoice.business.name || "Your Business"}
              </h2>

              <div className="mt-2 space-y-1 break-words text-xs leading-5 text-slate-500">
                {invoice.business.address && (
                  <p className="whitespace-pre-line">
                    {invoice.business.address}
                  </p>
                )}
                {invoice.business.email && <p>{invoice.business.email}</p>}
                {invoice.business.phone && <p>{invoice.business.phone}</p>}
                {invoice.business.website && <p>{invoice.business.website}</p>}
              </div>
            </div>
          </div>

          <div className="ml-auto text-right">
            <h1
              className="text-3xl font-extrabold tracking-tight sm:text-4xl"
              style={{ color: style.accent }}
            >
              INVOICE
            </h1>
            <p className="mt-2 break-all text-sm font-semibold text-slate-700">
              {invoice.invoiceNumber || "INV-0001"}
            </p>
          </div>
        </header>

        <div
          className={`my-7 grid grid-cols-2 gap-4 border-y py-5 ${showDueDate ? "sm:grid-cols-3" : "sm:grid-cols-2"} ${style.border}`}
        >
          <div>
            <p className={`text-[10px] font-semibold text-slate-500 ${style.label}`}>
              Issue date
            </p>
            <p className="mt-1.5 text-sm font-medium text-slate-800">
              {formatDate(invoice.issueDate)}
            </p>
          </div>

          {showDueDate && (
            <div>
              <p className={`text-[10px] font-semibold text-slate-500 ${style.label}`}>
                Due date
              </p>
              <p className="mt-1.5 text-sm font-medium text-slate-800">
                {formatDate(invoice.dueDate)}
              </p>
            </div>
          )}

          <div className={showDueDate ? "col-span-2 sm:col-span-1" : ""}>
            <p className={`text-[10px] font-semibold text-slate-500 ${style.label}`}>
              Payment terms
            </p>
            <p className="mt-1.5 text-sm font-medium text-slate-800">
              {invoice.paymentTerms || "—"}
            </p>
          </div>
        </div>

        <section className="mb-8">
          <p className={`text-[10px] font-bold text-slate-500 ${style.label}`}>
            Bill to
          </p>
          <h3 className="mt-2 break-words text-base font-bold text-slate-900">
            {invoice.client.name || "Client name"}
          </h3>

          <div className="mt-1 space-y-1 whitespace-pre-line break-words text-sm leading-5 text-slate-500">
            {invoice.client.address && <p>{invoice.client.address}</p>}
            {invoice.client.email && <p>{invoice.client.email}</p>}
            {invoice.client.taxId && <p>Tax ID: {invoice.client.taxId}</p>}
          </div>

          {invoice.purchaseOrder && (
            <p className="mt-3 text-xs text-slate-500">
              Purchase order: {invoice.purchaseOrder}
            </p>
          )}
        </section>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-white" style={{ backgroundColor: style.accent }}>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-2 py-3 text-right font-semibold">Qty / Unit</th>
                <th className="px-2 py-3 text-right font-semibold">Price</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>

            <tbody>
              {invoice.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    Your invoice items will appear here.
                  </td>
                </tr>
              ) : (
                invoice.items.map((item) => (
                  <tr key={item.id} className={`border-b align-top ${style.border}`}>
                    <td className="max-w-[240px] break-words px-3 py-4">
                      <p className="font-medium text-slate-800">
                        {item.description || "Untitled item"}
                      </p>
                      {item.discount > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {item.discount}% discount
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-2 py-4 text-right text-slate-600">
                      {item.quantity}
                      {item.unit?.trim() ? ` ${item.unit.trim()}` : ""}
                    </td>

                    <td className={`px-2 py-4 text-slate-600 ${amountClass}`}>
                      {formatCurrency(item.unitPrice, invoice.currency)}
                    </td>

                    <td className={`px-3 py-4 font-semibold text-slate-800 ${amountClass}`}>
                      {formatCurrency(calculateItemTotal(item), invoice.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <section className="ml-auto mt-6 w-full max-w-[360px] space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className={`font-medium text-slate-800 ${amountClass}`}>
              {formatCurrency(totals.subtotal, invoice.currency)}
            </span>
          </div>

          {totals.itemDiscount > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
              <span className="text-slate-500">Item discounts</span>
              <span className={`text-slate-700 ${amountClass}`}>
                −{formatCurrency(totals.itemDiscount, invoice.currency)}
              </span>
            </div>
          )}

          {totals.invoiceDiscount > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
              <span className="text-slate-500">Invoice discount</span>
              <span className={`text-slate-700 ${amountClass}`}>
                −{formatCurrency(totals.invoiceDiscount, invoice.currency)}
              </span>
            </div>
          )}

          {totals.tax > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
              <span className="text-slate-500">{invoice.taxLabel || "Tax"}</span>
              <span className={`text-slate-800 ${amountClass}`}>
                {formatCurrency(totals.tax, invoice.currency)}
              </span>
            </div>
          )}

          {totals.shipping > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
              <span className="text-slate-500">Additional charges</span>
              <span className={`text-slate-800 ${amountClass}`}>
                {formatCurrency(totals.shipping, invoice.currency)}
              </span>
            </div>
          )}

          <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t pt-4 ${style.border}`}>
            <span className="font-bold text-slate-900">Total</span>
            <span
              className={`text-lg font-extrabold ${amountClass}`}
              style={{ color: style.accent }}
            >
              {formatCurrency(totals.total, invoice.currency)}
            </span>
          </div>

          {totals.amountPaid > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-sm">
              <span className="text-slate-500">Amount paid</span>
              <span className={`text-slate-700 ${amountClass}`}>
                {formatCurrency(totals.amountPaid, invoice.currency)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg bg-slate-50 px-3 py-3">
            <span className="text-sm font-bold text-slate-700">Balance due</span>
            <span className={`font-extrabold text-slate-900 ${amountClass}`}>
              {formatCurrency(totals.balance, invoice.currency)}
            </span>
          </div>
        </section>

        {(invoice.paymentInstructions || invoice.notes) && (
          <div className="mt-9 grid gap-6 sm:grid-cols-2">
            {invoice.paymentInstructions && (
              <section>
                <h3 className={`text-[10px] font-bold text-slate-500 ${style.label}`}>
                  Payment instructions
                </h3>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-600">
                  {invoice.paymentInstructions}
                </p>
              </section>
            )}

            {invoice.notes && (
              <section>
                <h3 className={`text-[10px] font-bold text-slate-500 ${style.label}`}>
                  Notes
                </h3>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-600">
                  {invoice.notes}
                </p>
              </section>
            )}
          </div>
        )}

        <footer className="mt-10 border-t border-slate-200 pt-4">
          {invoice.footer && (
            <p className="mb-3 whitespace-pre-line text-xs leading-5 text-slate-500">
              {invoice.footer}
            </p>
          )}
          <p className="text-center text-xs text-slate-400">
            Thank you for your business.
          </p>
        </footer>
      </div>
    </article>
  );
}
