import { useTheme } from "../hooks";
import { MoonIcon, ScreenIcon, SunIcon } from "./Icons";

export interface Crumb {
  label: string;
  href?: string;
}

export function openDisplay(activityId: string) {
  window.open(`#/display/${activityId}`, `sst-display-${activityId}`, "popup=no");
}

export default function Shell({
  crumbs = [],
  displayFor,
  children,
}: {
  crumbs?: Crumb[];
  displayFor?: string;
  children: React.ReactNode;
}) {
  const { theme, toggle } = useTheme();
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav__in">
          <div className="nav__l">
            <a href="#/" aria-label="All activities" className="nav__logo">
              <img src="/logo.png" alt="SST Makerspace" />
            </a>
            <div className="crumb">
              <span>/</span>
              <a href="#/">Race Control</a>
              {crumbs.map((c) => (
                <span key={c.label} style={{ display: "contents" }}>
                  <span>/</span>
                  {c.href ? <a href={c.href}>{c.label}</a> : <span>{c.label}</span>}
                </span>
              ))}
            </div>
          </div>
          <div className="nav__r">
            {displayFor && (
              <button className="btn btn--sm" onClick={() => openDisplay(displayFor)}>
                <ScreenIcon size={15} /> Audience display
              </button>
            )}
            <button className="icon-btn" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </nav>
      <main>{children}</main>
      <footer className="footer">
        <div className="wrap">
          <span>© {new Date().getFullYear()} SST Makerspace · Race Control</span>
          <span>sstmakerspace.org</span>
        </div>
      </footer>
    </div>
  );
}
