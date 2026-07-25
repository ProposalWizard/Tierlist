// Small icon set for the History/Hall of Fame cards. Kept as simple geometric
// SVG (no external assets) so they render crisply at chip size and inherit
// currentColor for the locked/unlocked states.

export function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 3h10v6a5 5 0 0 1-10 0V3Z" fill="currentColor" />
      <path d="M7 5.2H4.6a2.3 2.3 0 0 0 0 4.6H6.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 5.2h2.4a2.3 2.3 0 0 1 0 4.6H17.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 13.6V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.4 17.3h5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.4 20.4h7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function StarBadgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3.1 14.12 9.39 20.75 9.46 15.42 13.41 17.41 19.74 12 15.9 6.59 19.74 8.58 13.41 3.25 9.46 9.88 9.39 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 5.5 15.5 12 9 18.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2" fill="currentColor" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
