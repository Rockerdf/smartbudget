import type { ReactNode } from "react";
import type { Screen } from "../App";
import { SITE } from "../lib/site";

// Shared header and footer for the public pages (landing, legal pages, contact,
// public Help Center). Landing-page sections are reached with goToSection().

const SCROLL_KEY = "sb_scroll_to";

/** Navigates to the landing page and scrolls to a section id (features, how, faq). */
export function goToSection(navigate: (s: Screen) => void, id: string, onLanding: boolean) {
  if (onLanding) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  try { sessionStorage.setItem(SCROLL_KEY, id); } catch { /* ignore */ }
  navigate("landing");
}

/** Called by the landing page once it has mounted. */
export function consumePendingSection() {
  let id: string | null = null;
  try { id = sessionStorage.getItem(SCROLL_KEY); sessionStorage.removeItem(SCROLL_KEY); } catch { /* ignore */ }
  if (id) setTimeout(() => document.getElementById(id!)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
}

export function Logo({ onClick, dark = false }: { onClick?: () => void; dark?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5" aria-label={`${SITE.name} home`}>
      <span className="w-9 h-9 rounded-[10px] bg-[#2563EB] flex items-center justify-center">
        <span className="text-white font-bold text-lg">S</span>
      </span>
      <span className={`font-bold text-[17px] tracking-tight ${dark ? "text-white" : "text-[#0F172A]"}`}>{SITE.name}</span>
    </button>
  );
}

export function PublicHeader({ navigate, signedIn }: { navigate: (s: Screen) => void; signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#E2E8F0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Logo onClick={() => navigate(signedIn ? "dashboard" : "landing")} />
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          <button type="button" onClick={() => navigate("helpCenter")} className="hidden sm:block px-3 py-2 text-[#374151] hover:text-[#2563EB] font-medium">Help</button>
          <button type="button" onClick={() => navigate("contact")} className="hidden sm:block px-3 py-2 text-[#374151] hover:text-[#2563EB] font-medium">Contact</button>
          {signedIn ? (
            <button type="button" onClick={() => navigate("dashboard")} className="px-4 py-2 rounded-full bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8]">
              Back to app
            </button>
          ) : (
            <>
              <button type="button" onClick={() => navigate("login")} className="px-3 py-2 text-[#374151] hover:text-[#2563EB] font-medium">Sign in</button>
              <button type="button" onClick={() => navigate("register")} className="px-4 py-2 rounded-full bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8]">
                Get Started
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

type FooterLink = { label: string; onClick: () => void };

export function SiteFooter({ navigate, onLanding = false }: { navigate: (s: Screen) => void; onLanding?: boolean }) {
  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: "Product",
      links: [
        { label: "Features", onClick: () => goToSection(navigate, "features", onLanding) },
        { label: "How it works", onClick: () => goToSection(navigate, "how", onLanding) },
        { label: "FAQ", onClick: () => goToSection(navigate, "faq", onLanding) },
        { label: "Create account", onClick: () => navigate("register") },
      ],
    },
    {
      heading: "Support",
      links: [
        { label: "Help Center", onClick: () => navigate("helpCenter") },
        { label: "Contact us", onClick: () => navigate("contact") },
        { label: "About", onClick: () => navigate("about") },
        { label: "Accessibility", onClick: () => navigate("accessibility") },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", onClick: () => navigate("privacy") },
        { label: "Terms of Use", onClick: () => navigate("terms") },
        { label: "Disclaimer", onClick: () => navigate("disclaimer") },
        { label: "Cookies & Storage", onClick: () => navigate("cookies") },
        { label: "Security", onClick: () => navigate("security") },
      ],
    },
  ];

  return (
    <footer className="bg-[#0A1628]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Logo dark onClick={() => (onLanding ? window.scrollTo({ top: 0, behavior: "smooth" }) : navigate("landing"))} />
            <p className="mt-3 text-sm text-white/50 leading-relaxed">{SITE.tagline}</p>
            <a href="https://moneysmart.gov.au" target="_blank" rel="noopener noreferrer"
              className="mt-5 inline-block text-xs text-white/45 hover:text-white/80 underline-offset-2 hover:underline">
              Free government money guidance: Moneysmart ↗
            </a>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <p className="font-semibold mb-4 text-[13px] text-white/60 uppercase tracking-[0.08em]">{col.heading}</p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button type="button" onClick={link.onClick}
                      className="text-sm text-white/50 hover:text-white/90 transition-colors text-left">
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/35">© {SITE.year} {SITE.name}. A university student project, {SITE.country}.</p>
          <p className="text-xs text-white/30 max-w-[520px] text-center sm:text-right">
            For educational purposes only. Not financial advice. Prototype: do not enter real bank details.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ navigate, signedIn, children }: { navigate: (s: Screen) => void; signedIn: boolean; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] font-sans">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-white px-3 py-2 rounded-lg shadow">Skip to content</a>
      <PublicHeader navigate={navigate} signedIn={signedIn} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter navigate={navigate} />
    </div>
  );
}
