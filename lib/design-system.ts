export const appShellStyles = {
  page: "ao-page",
  pageInner: "ao-page-inner md:ml-60",
  content: "ao-page-content md:px-7 md:py-7",
  width: "ao-page-width ao-stack-6"
} as const;

export const surfaceStyles = {
  hero: "ao-hero",
  section: "ao-section-card",
  hans: "ao-hans-card",
  hansItem: "ao-hans-item",
  kpi: "ao-kpi-card",
  subtle: "ao-card-subtle",
  empty: "ao-empty-state",
  icon: "ao-card-icon"
} as const;

export const buttonStyles = {
  primary: "ao-btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-bold transition",
  secondary: "ao-btn-secondary inline-flex items-center justify-center px-4 py-2.5 text-sm font-bold transition",
  tertiary: "ao-btn-tertiary inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold transition"
} as const;

export const badgeStyles = {
  hans: "ao-badge ao-badge-hans",
  neutral: "ao-badge ao-badge-neutral",
  warning: "ao-badge ao-badge-warning",
  danger: "ao-badge ao-badge-danger"
} as const;

export const typographyStyles = {
  kicker: "ao-kicker",
  h1: "ao-h1",
  h2: "ao-h2",
  h3: "ao-h3",
  body: "ao-body",
  caption: "ao-caption"
} as const;
