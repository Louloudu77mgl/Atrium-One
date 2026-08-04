import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  name:
    | "alert"
    | "bell"
    | "chart"
    | "check"
    | "document"
    | "gear"
    | "image"
    | "message"
    | "phone"
    | "refresh"
    | "sparkle"
    | "star"
    | "party"
    | "link"
    | "store"
    | "home"
    | "search"
    | "inbox"
    | "mail"
    | "lock"
    | "trash";
};

const paths: Record<IconProps["name"], ReactNode> = {
  alert: <path d="M12 3 2.8 19a1.5 1.5 0 0 0 1.3 2.2h15.8a1.5 1.5 0 0 0 1.3-2.2L12 3Zm0 5.2v5.6m0 3.2h.01" />,
  bell: <path d="M18 9a6 6 0 1 0-12 0c0 7-2.5 7-2.5 7h17S18 16 18 9Zm-8 10a2 2 0 0 0 4 0" />,
  chart: <path d="M4 19V5m0 14h16M8 16V9m4 7V6m4 10v-4" />,
  check: <path d="m5 12 4 4L19 6" />,
  document: <path d="M7 3h6l4 4v14H7V3Zm6 0v5h5M9 12h6M9 16h6" />,
  gear: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 3.5-2-.4a6.6 6.6 0 0 0-.7-1.7l1.1-1.7-2.1-2.1-1.7 1.1c-.5-.3-1.1-.5-1.7-.7L12 4h-3l-.4 2c-.6.2-1.2.4-1.7.7L5.2 5.6 3.1 7.7l1.1 1.7c-.3.5-.5 1.1-.7 1.7L1.5 12v3l2 .4c.2.6.4 1.2.7 1.7l-1.1 1.7 2.1 2.1 1.7-1.1c.5.3 1.1.5 1.7.7l.4 2h3l.4-2c.6-.2 1.2-.4 1.7-.7l1.7 1.1 2.1-2.1-1.1-1.7c.3-.5.5-1.1.7-1.7l2-.4v-3Z" />,
  image: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm3 10 3.2-3.2 2.2 2.2 3.3-4.3L20 17M8 8.5h.01" />,
  message: <path d="M4 5.5h16v10H8l-4 4v-14Zm4 4h8M8 13h5" />,
  phone: <path d="M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3Zm3 15h2" />,
  refresh: <path d="M20 7v5h-5M4 17v-5h5m9.2-3A7 7 0 0 0 6.4 7.5L4 10m16 4-2.4 2.5A7 7 0 0 1 5.8 15" />,
  sparkle: <path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3Zm6 12 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  party: <path d="m4 20 4-13 9 9-13 4Zm8-14 2-2m1 5 4-1m-1 5 2 2" />,
  link: <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />,
  store: <path d="M4 9h16l-1-5H5L4 9Zm1 0v10h14V9M8 19v-6h8v6" />,
  home: <path d="M3 11.5 12 4l9 7.5V20h-6v-6H9v6H3v-8.5Z" />,
  search: <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.3-2.2L21 21" />,
  inbox: <path d="M4 5h16v10l-3 4H7l-3-4V5Zm0 10h5l1.5 2h3L15 15h5" />,
  mail: <path d="M3.5 6h17v12h-17V6Zm1 1 7.5 6 7.5-6" />,
  lock: <path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5V10Zm7 4v3" />,
  trash: <path d="M4 7h16M9 7V5h6v2m-8 0 1 12h8l1-12M10 11v5m4-5v5" />
};

export function Icon({ name, className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      {paths[name]}
    </svg>
  );
}
