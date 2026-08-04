export type ToastState = {
  message: string;
  tone: "success" | "error" | "saving";
} | null;

const toastClasses = {
  success: "bg-[#4C1D95] text-white",
  error: "bg-[#DC2626] text-white",
  saving: "bg-[#7C3AED] text-white"
};

const toastIcon = {
  success: "✓",
  error: "!",
  saving: "•"
};

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`fixed inset-x-4 bottom-20 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-[0_8px_32px_rgba(76,29,149,0.18)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-sm ${toastClasses[toast.tone]}`}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs">{toastIcon[toast.tone]}</span>
      {toast.message}
    </div>
  );
}
