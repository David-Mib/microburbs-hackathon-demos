/** Small line icons for listing features. */
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const BedIcon = () => (
  <svg {...base}>
    <path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
    <circle cx="7" cy="11" r="1.6" />
  </svg>
);
export const BathIcon = () => (
  <svg {...base}>
    <path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2zM6 12V6a2 2 0 0 1 3.6-1.2M7 19l-1 2M17 19l1 2" />
  </svg>
);
export const CarIcon = () => (
  <svg {...base}>
    <path d="M5 16V12l2-5h10l2 5v4M3 16h18v2H3zM5 12h14" />
    <circle cx="7.5" cy="14" r=".6" />
    <circle cx="16.5" cy="14" r=".6" />
  </svg>
);
export const AreaIcon = () => (
  <svg {...base}>
    <path d="M4 4h16v16H4zM4 9h5M15 20v-5h5" />
  </svg>
);
export const PinIcon = () => (
  <svg {...base} width={15} height={15}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </svg>
);
