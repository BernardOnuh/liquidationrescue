// The LiquidationRescue mark, shared by the homepage and the app.
/** The mark: a shield holding one red candle (the crash) and one green candle (the rescue). */
export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 2.5 27 6.6v8.1c0 7.3-4.7 12.2-11 14.8C9.7 26.9 5 22 5 14.7V6.6Z" fill="rgb(34 227 154 / 0.1)" stroke="#22e39a" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12.2 9.5v12.5" stroke="#ff3b3b" strokeWidth="1.2" strokeLinecap="round" /><rect x="10.4" y="11.5" width="3.6" height="7.5" rx="0.8" fill="#ff3b3b" />
      <path d="M19.8 8v11.5" stroke="#22e39a" strokeWidth="1.2" strokeLinecap="round" /><rect x="18" y="9.5" width="3.6" height="7" rx="0.8" fill="#22e39a" />
    </svg>
  );
}
