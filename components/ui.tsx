import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Tone = "primary" | "secondary" | "tertiary";

const buttonClasses: Record<Tone, string> = {
  primary: "ao-btn-primary",
  secondary: "ao-btn-secondary",
  tertiary: "ao-btn-tertiary"
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({ tone = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return <button {...props} className={cn(buttonClasses[tone], "inline-flex items-center justify-center px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50", className)} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={cn("ao-card", className)} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("ao-input h-10 w-full px-3 text-sm font-medium", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("ao-input w-full px-3 py-2.5 text-sm font-medium leading-6", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("ao-select h-10 w-full px-3 text-sm font-medium", className)} />;
}

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn("ao-label", className)} />;
}

export function Modal({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return <div className="ao-modal-backdrop"><div role="dialog" aria-modal="true" className={cn("ao-modal-content", className)}>{children}</div></div>;
}
