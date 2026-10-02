type P = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
);

export const SunIcon = ({ size = 18, className }: P) =>
  svg(size, className, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></>);
export const MoonIcon = ({ size = 18, className }: P) =>
  svg(size, className, <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);
export const ScreenIcon = ({ size = 18, className }: P) =>
  svg(size, className, <><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></>);
export const TrashIcon = ({ size = 16, className }: P) =>
  svg(size, className, <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />);
export const UpIcon = ({ size = 16, className }: P) => svg(size, className, <path d="m6 15 6-6 6 6" />);
export const DownIcon = ({ size = 16, className }: P) => svg(size, className, <path d="m6 9 6 6 6-6" />);
export const ExpandIcon = ({ size = 18, className }: P) =>
  svg(size, className, <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
export const TrophyIcon = ({ size = 56, className }: P) =>
  svg(
    size,
    className,
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
    </>
  );
