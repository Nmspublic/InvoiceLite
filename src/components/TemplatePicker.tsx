import { Check, FileText, LayoutTemplate, Sparkles } from "lucide-react";
import type { InvoiceTemplate } from "../types";

const templates: {
  id: InvoiceTemplate;
  name: string;
  description: string;
  icon: typeof FileText;
  accent: string;
  surface: string;
  badge: string;
}[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional, structured, and business-ready.",
    icon: FileText,
    accent: "#374151",
    surface: "#f3f4f6",
    badge: "Professional"
  },
  {
    id: "modern",
    name: "Modern",
    description: "Minimal, clean, with a bold visual hierarchy.",
    icon: LayoutTemplate,
    accent: "#4f46e5",
    surface: "#eef2ff",
    badge: "Minimal"
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Refined typography and warm, subtle accents.",
    icon: Sparkles,
    accent: "#896642",
    surface: "#faf4eb",
    badge: "Refined"
  }
];

export default function TemplatePicker({
  value,
  onChange
}: {
  value: InvoiceTemplate;
  onChange: (template: InvoiceTemplate) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => {
        const Icon = template.icon;
        const selected = value === template.id;

        return (
          <button
            key={template.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(template.id)}
            className={`group overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              selected
                ? "border-indigo-500 ring-2 ring-indigo-100"
                : "border-slate-200"
            }`}
          >
            <div
              className="relative p-5"
              style={{ backgroundColor: template.surface }}
            >
              <div className="mx-auto aspect-[0.77] max-w-[210px] bg-white p-4 shadow-sm">
                <div
                  className="mb-4 h-1.5 w-full"
                  style={{ backgroundColor: template.accent }}
                />

                <div className="flex justify-between gap-3">
                  <div className="w-1/2">
                    <div
                      className="mb-2 h-3 w-4/5"
                      style={{ backgroundColor: template.accent }}
                    />
                    <div className="mb-1 h-1.5 w-full bg-slate-200" />
                    <div className="h-1.5 w-3/4 bg-slate-100" />
                  </div>
                  <div className="w-1/3 text-right">
                    <div className="ml-auto mb-2 h-3 w-full bg-slate-300" />
                    <div className="ml-auto h-1.5 w-3/4 bg-slate-100" />
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {[1, 2, 3, 4].map((line) => (
                    <div
                      key={line}
                      className="flex items-center gap-2 border-b border-slate-100 pb-2"
                    >
                      <div className="h-2 w-2/3 bg-slate-100" />
                      <div className="ml-auto h-2 w-1/5 bg-slate-200" />
                    </div>
                  ))}
                </div>

                <div
                  className="ml-auto mt-4 h-4 w-1/2"
                  style={{ backgroundColor: template.surface }}
                />
              </div>

              {selected && (
                <span className="absolute right-3 top-3 rounded-full bg-indigo-600 p-1.5 text-white">
                  <Check size={14} />
                </span>
              )}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">
                  {template.name}
                </h3>
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {template.badge}
                </span>
              </div>

              <p className="mt-1 text-sm leading-5 text-slate-500">
                {template.description}
              </p>

              <p
                className={`mt-3 text-xs font-semibold ${
                  selected ? "text-indigo-700" : "text-slate-400"
                }`}
              >
                {selected ? "Currently selected" : "Select template"}
              </p>

              <span className="sr-only">
                <Icon size={14} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
