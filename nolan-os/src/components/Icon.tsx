const P: Record<string, string> = {
  today: "M12 3v2m0 14v2M5 12H3m18 0h-2M6.3 6.3 4.9 4.9m14.2 14.2-1.4-1.4M6.3 17.7l-1.4 1.4m14.2-14.2-1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  attention: "M12 3 2.5 20h19L12 3zm0 6v5m0 3v.5",
  deals: "M3 7h18v12H3zM8 7V5h8v2M3 12h18",
  company: "M4 21V5l8-2v18M12 9l8 2v10M8 9h.01M8 13h.01M8 17h.01M16 15h.01M16 18h.01",
  people: "M16 11a4 4 0 100-8 4 4 0 000 8zM3 21c0-4 3-7 7-7h2c4 0 7 3 7 7M8 11a3 3 0 100-6",
  agency: "M12 3v4m0 10v4M3 12h4m10 0h4M7 7l2 2m6 6 2 2M17 7l-2 2M9 15l-2 2M12 9a3 3 0 100 6 3 3 0 000-6z",
  campaign: "M3 11v2l15 6V5L3 11zm0 0H2m4 1.5V18a2 2 0 002 2h1",
  money: "M12 3v18m4-14H10a3 3 0 000 6h4a3 3 0 010 6H8",
  invoice: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7M9 9h2",
  payments: "M3 6h18v12H3zM3 10h18M7 15h3",
  deliver: "M4 4h16v12H4zM8 20h8M12 16v4M10 8l5 3-5 3z",
  rights: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  docs: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6",
  tasks: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  inbox: "M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5",
  chart: "M4 20V4m0 16h16M8 16v-5m4 5V8m4 8v-3",
  timeline: "M4 6h10M4 12h16M4 18h7M17 6h.01M14 18h.01",
  rate: "M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01",
  brief: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3",
  quality: "M9 12l2 2 4-5M12 3a9 9 0 100 18 9 9 0 000-18z",
  data: "M12 4c4.4 0 8 1.1 8 2.5S16.4 9 12 9 4 7.9 4 6.5 7.6 4 12 4zM4 6.5v5C4 12.9 7.6 14 12 14s8-1.1 8-2.5v-5M4 11.5v5C4 17.9 7.6 19 12 19s8-1.1 8-2.5v-5",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3",
  menu: "M4 7h16M4 12h16M4 17h16",
  sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
  close: "M6 6l12 12M18 6L6 18",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  download: "M12 4v12m-5-5 5 5 5-5M5 20h14",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
};
export function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={P[name] ?? P.today} />
    </svg>
  );
}
