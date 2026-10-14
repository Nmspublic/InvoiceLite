import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Copy,
  FilePlus2,
  FileText,
  Search,
  Trash2,
  Wallet,
  CircleDollarSign,
  CheckCircle2,
  Clock3
} from "lucide-react";
import type { Invoice, InvoiceStatus } from "../types";
import { calculateTotals, getInvoiceStatus } from "../utils/calculations";
import { formatCurrency, formatDate } from "../utils/formatting";

interface DashboardProps {
  invoices: Invoice[];
  currency: Invoice["currency"];
  onCreate: () => void;
  onEdit: (invoice: Invoice) => void;
  onDuplicate: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700"
};

export default function Dashboard({
  invoices,
  currency,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete
}: DashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "amount">("newest");

  const today = new Date().toISOString().slice(0, 10);

  const summaries = useMemo(() => {
    const totals = invoices.map((invoice) => ({
      invoice,
      totals: calculateTotals(invoice),
      status: getInvoiceStatus(invoice, today)
    }));

    return {
      count: invoices.length,
      invoiced: totals.reduce(
        (sum, entry) => sum + entry.totals.total,
        0
      ),
      outstanding: totals
        .filter((entry) => entry.status === "sent" || entry.status === "overdue")
        .reduce((sum, entry) => sum + entry.totals.balance, 0),
      paid: totals.reduce(
        (sum, entry) => sum + entry.totals.amountPaid,
        0
      )
    };
  }, [invoices, today]);

  const filtered = useMemo(() => {
    const result = invoices.filter((invoice) => {
      const status = getInvoiceStatus(invoice, today);
      const term = search.trim().toLowerCase();

      const matchesSearch =
        !term ||
        invoice.invoiceNumber.toLowerCase().includes(term) ||
        invoice.client.name.toLowerCase().includes(term) ||
        invoice.business.name.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      if (sort === "amount") {
        return calculateTotals(b).total - calculateTotals(a).total;
      }

      const dateA = a.issueDate || "";
      const dateB = b.issueDate || "";

      return sort === "newest"
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });

    return result;
  }, [invoices, search, statusFilter, sort, today]);

  const stats = [
    {
      label: "Total invoices",
      value: String(summaries.count),
      icon: FileText,
      detail: "All saved invoices",
      color: "bg-indigo-50 text-indigo-600"
    },
    {
      label: "Total invoiced",
      value: formatCurrency(summaries.invoiced, currency),
      icon: CircleDollarSign,
      detail: "Invoice totals, including drafts",
      color: "bg-blue-50 text-blue-600"
    },
    {
      label: "Outstanding",
      value: formatCurrency(summaries.outstanding, currency),
      icon: Wallet,
      detail: "Sent and overdue balances",
      color: "bg-amber-50 text-amber-700"
    },
    {
      label: "Amount paid",
      value: formatCurrency(summaries.paid, currency),
      icon: CheckCircle2,
      detail: "Payments recorded manually",
      color: "bg-emerald-50 text-emerald-700"
    }
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-indigo-600">
            YOUR WORKSPACE
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Invoices
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Create, organize, and manage your billing.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        >
          <FilePlus2 size={18} />
          Create invoice
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500">
                  {stat.label}
                </span>
                <span className={`rounded-xl p-2.5 ${stat.color}`}>
                  <Icon size={19} />
                </span>
              </div>

              <p className="mt-4 break-words text-2xl font-bold tracking-tight text-slate-900">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Your invoices
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {filtered.length} of {invoices.length} invoices
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoices..."
                aria-label="Search invoices"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 sm:w-48"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by invoice status"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
              <ArrowDownUp size={15} className="text-slate-400" />
              <select
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as typeof sort)
                }
                aria-label="Sort invoices"
                className="min-w-0 bg-transparent py-2.5 text-sm outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="amount">Highest amount</option>
              </select>
            </label>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              {invoices.length === 0 ? (
                <FilePlus2 size={25} />
              ) : (
                <Search size={25} />
              )}
            </div>

            <h3 className="mt-4 font-semibold text-slate-900">
              {invoices.length === 0
                ? "Your first invoice starts here"
                : "No matching invoices"}
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {invoices.length === 0
                ? "Create a professional invoice in minutes. Your drafts stay in this browser."
                : "Try another search term or change your status filter."}
            </p>

            {invoices.length === 0 && (
              <button
                type="button"
                onClick={onCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Create your first invoice
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((invoice) => {
                const status = getInvoiceStatus(invoice, today);
                const totals = calculateTotals(invoice);

                return (
                  <article key={invoice.id} className="space-y-3 p-4">
                    <button
                      type="button"
                      onClick={() => onEdit(invoice)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-all font-semibold text-slate-900">
                            {invoice.invoiceNumber}
                          </p>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {invoice.client.name || "Unnamed client"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          {formatDate(invoice.issueDate)}
                        </p>
                        <p className="font-semibold text-slate-900">
                          {formatCurrency(totals.total, invoice.currency)}
                        </p>
                      </div>
                    </button>

                    <div className="flex gap-2 border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        onClick={() => onDuplicate(invoice)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <Copy size={14} /> Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(invoice)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Invoice</th>
                    <th className="px-5 py-3.5 font-semibold">Client</th>
                    <th className="px-5 py-3.5 font-semibold">Issue date</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Amount</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map((invoice) => {
                    const status = getInvoiceStatus(invoice, today);
                    const totals = calculateTotals(invoice);

                    return (
                      <tr key={invoice.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => onEdit(invoice)}
                            className="font-semibold text-slate-900 hover:text-indigo-700"
                          >
                            {invoice.invoiceNumber}
                          </button>
                        </td>
                        <td className="max-w-[200px] truncate px-5 py-4 text-slate-600">
                          {invoice.client.name || "Unnamed client"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                          {formatDate(invoice.issueDate)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                          {formatCurrency(totals.total, invoice.currency)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onDuplicate(invoice)}
                              aria-label={`Duplicate ${invoice.invoiceNumber}`}
                              title="Duplicate invoice"
                              className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(invoice)}
                              aria-label={`Delete ${invoice.invoiceNumber}`}
                              title="Delete invoice"
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {invoices.length > 0 && (
        <p className="flex items-center gap-2 text-xs leading-5 text-slate-400">
          <Clock3 size={14} />
          Overdue status is derived from the due date and outstanding balance.
          Payment amounts are recorded manually.
        </p>
      )}
    </div>
  );
}
