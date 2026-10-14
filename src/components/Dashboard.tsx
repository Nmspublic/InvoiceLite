
import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Copy,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";

import type { Invoice, AppSettings } from "../types";
import { formatCurrency, formatDate } from "../utils/formatting";
import { calculateTotals } from "../utils/calculations";

interface DashboardProps {
  invoices: Invoice[];
  settings: AppSettings;
  onCreateInvoice: () => void;
  onOpenInvoice: (invoiceId: string) => void;
  onDuplicateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoice: Invoice) => void;
  onExportInvoice: (invoice: Invoice) => void;
}

type StatusFilter = "all" | "draft" | "sent" | "paid" | "overdue";

function getInvoiceStatus(invoice: Invoice): StatusFilter {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "sent" && invoice.dueDate < new Date().toISOString().slice(0, 10)) {
    return "overdue";
  }
  return invoice.status as StatusFilter;
}

function StatusBadge({ status }: { status: StatusFilter }) {
  const styles: Record<StatusFilter, string> = {
    all: "bg-slate-100 text-slate-600",
    draft: "bg-slate-100 text-slate-600",
    sent: "bg-blue-50 text-blue-700",
    paid: "bg-emerald-50 text-emerald-700",
    overdue: "bg-red-50 text-red-700",
  };

  const labels: Record<StatusFilter, string> = {
    all: "All",
    draft: "Draft",
    sent: "Sent",
    paid: "Paid",
    overdue: "Overdue",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function Dashboard({
  invoices,
  settings,
  onCreateInvoice,
  onOpenInvoice,
  onDuplicateInvoice,
  onDeleteInvoice,
  onExportInvoice,
}: DashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [menuInvoiceId, setMenuInvoiceId] = useState<string | null>(null);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invoices
      .filter((invoice) => {
        const status = getInvoiceStatus(invoice);
        const matchesStatus =
          statusFilter === "all" || status === statusFilter;

        const matchesSearch =
          !query ||
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          invoice.client.name.toLowerCase().includes(query) ||
          invoice.client.email.toLowerCase().includes(query);

        return matchesStatus && matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime(),
      );
  }, [invoices, search, statusFilter]);

  const summary = useMemo(() => {
    return invoices.reduce(
      (result, invoice) => {
        const totals = calculateTotals(invoice);

        result.total += totals.total;
        result.paid +=
          invoice.status === "paid" ? totals.total : invoice.amountPaid || 0;

        if (invoice.status !== "paid") {
          result.outstanding += Math.max(
            0,
            totals.total - (invoice.amountPaid || 0),
          );
        }

        if (getInvoiceStatus(invoice) === "overdue") {
          result.overdue += Math.max(
            0,
            totals.total - (invoice.amountPaid || 0),
          );
        }

        return result;
      },
      { total: 0, paid: 0, outstanding: 0, overdue: 0 },
    );
  }, [invoices]);

  const currency = settings.currency;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total invoiced"
          value={formatCurrency(summary.total, currency)}
          description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} created`}
          icon={<FileText size={18} />}
        />
        <SummaryCard
          label="Payments received"
          value={formatCurrency(summary.paid, currency)}
          description="Recorded payments"
          icon={<ArrowDownToLine size={18} />}
        />
        <SummaryCard
          label="Outstanding"
          value={formatCurrency(summary.outstanding, currency)}
          description="Remaining balance"
          icon={<FilePlus2 size={18} />}
        />
        <SummaryCard
          label="Overdue"
          value={formatCurrency(summary.overdue, currency)}
          description="Past-due balances"
          icon={<Trash2 size={18} />}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Your invoices</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search and manage your saved invoices.
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateInvoice}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <FilePlus2 size={16} />
            Create invoice
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice number, client, or email..."
              aria-label="Search invoices"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            aria-label="Filter invoices by status"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileText size={24} />
            </div>
            <h3 className="mt-4 text-base font-semibold">
              {invoices.length === 0
                ? "Your first invoice starts here"
                : "No matching invoices"}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {invoices.length === 0
                ? "Create a professional invoice, add your client and items, then export it as a PDF."
                : "Try a different search term or status filter."}
            </p>
            {invoices.length === 0 && (
              <button
                type="button"
                onClick={onCreateInvoice}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <FilePlus2 size={16} />
                Create your first invoice
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Invoice</th>
                    <th className="px-5 py-3 font-semibold">Client</th>
                    <th className="px-5 py-3 font-semibold">Issue date</th>
                    <th className="px-5 py-3 font-semibold">Due date</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Total</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((invoice) => {
                    const totals = calculateTotals(invoice);
                    const status = getInvoiceStatus(invoice);

                    return (
                      <tr
                        key={invoice.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => onOpenInvoice(invoice.id)}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            {invoice.invoiceNumber}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-800">
                            {invoice.client.name || "Unnamed client"}
                          </p>
                          {invoice.client.email && (
                            <p className="mt-1 text-xs text-slate-500">
                              {invoice.client.email}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatDate(invoice.issueDate)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold tabular-nums">
                          {formatCurrency(totals.total, invoice.currency)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={() =>
                                setMenuInvoiceId((current) =>
                                  current === invoice.id ? null : invoice.id,
                                )
                              }
                              aria-label={`Actions for ${invoice.invoiceNumber}`}
                              aria-expanded={menuInvoiceId === invoice.id}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <MoreHorizontal size={18} />
                            </button>

                            {menuInvoiceId === invoice.id && (
                              <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg">
                                <ActionButton
                                  icon={<FileText size={15} />}
                                  onClick={() => {
                                    onOpenInvoice(invoice.id);
                                    setMenuInvoiceId(null);
                                  }}
                                >
                                  Open invoice
                                </ActionButton>
                                <ActionButton
                                  icon={<Copy size={15} />}
                                  onClick={() => {
                                    onDuplicateInvoice(invoice);
                                    setMenuInvoiceId(null);
                                  }}
                                >
                                  Duplicate
                                </ActionButton>
                                <ActionButton
                                  icon={<ArrowDownToLine size={15} />}
                                  onClick={() => {
                                    onExportInvoice(invoice);
                                    setMenuInvoiceId(null);
                                  }}
                                >
                                  Export JSON
                                </ActionButton>
                                <ActionButton
                                  danger
                                  icon={<Trash2 size={15} />}
                                  onClick={() => {
                                    onDeleteInvoice(invoice);
                                    setMenuInvoiceId(null);
                                  }}
                                >
                                  Delete
                                </ActionButton>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredInvoices.map((invoice) => {
                const totals = calculateTotals(invoice);
                const status = getInvoiceStatus(invoice);

                return (
                  <article key={invoice.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(invoice.id)}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </button>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          {invoice.client.name || "Unnamed client"}
                        </p>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold tabular-nums">
                          {formatCurrency(totals.total, invoice.currency)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Due {formatDate(invoice.dueDate)}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => onDuplicateInvoice(invoice)}
                          aria-label={`Duplicate ${invoice.invoiceNumber}`}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportInvoice(invoice)}
                          aria-label={`Export ${invoice.invoiceNumber} as JSON`}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                        >
                          <ArrowDownToLine size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteInvoice(invoice)}
                          aria-label={`Delete ${invoice.invoiceNumber}`}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Showing {filteredInvoices.length} of {invoices.length} invoice
          {invoices.length === 1 ? "" : "s"}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </span>
      </div>
      <p className="mt-4 break-words text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
