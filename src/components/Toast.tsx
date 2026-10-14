import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastMessage = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

export default function Toast({
  toast,
  onClose
}: {
  toast: ToastMessage | null;
  onClose: () => void;
}) {
  if (!toast) return null;

  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
    info: "border-indigo-200 bg-indigo-50 text-indigo-900"
  };

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info
  }[toast.type];

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={`fixed bottom-5 right-5 z-[100] flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles[toast.type]}`}
    >
      <Icon size={19} className="shrink-0" />
      <p className="text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="ml-2 rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}
