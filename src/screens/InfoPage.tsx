import { useEffect } from "react";
import type { Screen } from "../App";
import { INFO_PAGES, INFO_TITLES } from "../content/legal";
import type { InfoBlock, InfoKey } from "../content/legal";
import { SITE } from "../lib/site";

type PageKey = Exclude<InfoKey, "contact">;

const LEGAL_NAV: PageKey[] = ["privacy", "terms", "disclaimer", "cookies"];
const INFO_NAV: PageKey[] = ["about", "accessibility", "security"];

// Turns plain-text mentions of a few known addresses into links.
const LINKABLE: Record<string, string> = {
  "ndh.org.au": "https://ndh.org.au",
  "moneysmart.gov.au": "https://moneysmart.gov.au",
  "oaic.gov.au": "https://www.oaic.gov.au",
  "scamwatch.gov.au": "https://www.scamwatch.gov.au",
};

function RichText({ text }: { text: string }) {
  const emails = [SITE.supportEmail, SITE.privacyEmail];
  const tokens = [...Object.keys(LINKABLE), ...emails, "1800 007 007"];
  const re = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(re).map((part, i) => {
        if (LINKABLE[part]) return <a key={i} href={LINKABLE[part]} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] underline underline-offset-2 hover:text-[#1D4ED8]">{part}</a>;
        if (emails.includes(part as typeof emails[number])) return <a key={i} href={`mailto:${part}`} className="text-[#2563EB] underline underline-offset-2">{part}</a>;
        if (part === "1800 007 007") return <a key={i} href="tel:1800007007" className="text-[#2563EB] underline underline-offset-2">{part}</a>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function Block({ block }: { block: InfoBlock }) {
  if (block.kind === "p") return <p className="text-[15px] leading-7 text-[#334155]"><RichText text={block.text} /></p>;
  if (block.kind === "list")
    return (
      <ul className="space-y-2 pl-1">
        {block.items.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-7 text-[#334155]">
            <span className="mt-[11px] w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" aria-hidden="true" />
            <span><RichText text={item} /></span>
          </li>
        ))}
      </ul>
    );
  const warn = block.tone === "warning";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${warn ? "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]" : "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]"}`}>
      <RichText text={block.text} />
    </div>
  );
}

export default function InfoPage({ page, navigate }: { page: PageKey; navigate: (s: Screen) => void }) {
  const content = INFO_PAGES[page];

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.title = `${content.title} · ${SITE.name}`;
    return () => { document.title = SITE.name; };
  }, [content.title]);

  const navGroup = (keys: PageKey[], label: string) => (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">{label}</p>
      <ul className="space-y-0.5">
        {keys.map((k) => (
          <li key={k}>
            <button type="button" onClick={() => navigate(k)}
              aria-current={k === page ? "page" : undefined}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${k === page ? "bg-[#EFF6FF] text-[#2563EB] font-semibold" : "text-[#475569] hover:bg-white hover:text-[#0F172A]"}`}>
              {INFO_TITLES[k]}
            </button>
          </li>
        ))}
        {label === "Company" && (
          <li>
            <button type="button" onClick={() => navigate("contact")} className="w-full text-left px-3 py-2 rounded-lg text-sm text-[#475569] hover:bg-white hover:text-[#0F172A]">
              Contact
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="grid lg:grid-cols-[220px_1fr] gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {navGroup(LEGAL_NAV, "Legal")}
            {navGroup(INFO_NAV, "Company")}
          </div>
        </aside>

        <article className="min-w-0">
          <nav className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-5" aria-label="Breadcrumb">
            <button type="button" onClick={() => navigate("landing")} className="hover:text-[#2563EB] font-medium">Home</button>
            <span aria-hidden="true">›</span>
            <span className="text-[#0F172A] font-medium">{content.title}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">{content.title}</h1>
          <p className="mt-3 text-[17px] text-[#64748B] leading-relaxed max-w-2xl">{content.summary}</p>
          {content.legal && <p className="mt-3 text-xs text-[#94A3B8]">Last updated: {SITE.legalUpdated}</p>}

          {content.legal && (
            <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#64748B] leading-5">
              This page is written for an educational student prototype and is provided as sample wording. It should be reviewed by a qualified professional before {SITE.name} is offered to the public.
            </div>
          )}

          {/* On small screens, an in-page contents list replaces the sidebar. */}
          {content.sections.length > 3 && (
            <details className="lg:hidden mt-6 bg-white border border-[#E2E8F0] rounded-xl">
              <summary className="px-4 py-3 text-sm font-semibold text-[#0F172A] cursor-pointer">On this page</summary>
              <ul className="px-4 pb-3 space-y-1">
                {content.sections.map((s) => (
                  <li key={s.id}><a href={`#${s.id}`} className="text-sm text-[#2563EB]">{s.heading}</a></li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-8 bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-6 sm:p-10 space-y-10">
            {content.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24 space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold text-[#0F172A]">{section.heading}</h2>
                {section.blocks.map((b, i) => <Block key={i} block={b} />)}
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-[#64748B]">Questions about this page?</span>
            <button type="button" onClick={() => navigate("contact")} className="font-semibold text-[#2563EB] hover:underline">Contact us</button>
            <span className="text-[#CBD5E1]">·</span>
            <button type="button" onClick={() => navigate("helpCenter")} className="font-semibold text-[#2563EB] hover:underline">Visit the Help Center</button>
          </div>

          {/* Related pages for small screens */}
          <div className="lg:hidden mt-10 grid grid-cols-2 gap-2">
            {[...LEGAL_NAV, ...INFO_NAV].filter((k) => k !== page).map((k) => (
              <button key={k} type="button" onClick={() => navigate(k)}
                className="text-left text-sm px-3 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#334155] hover:border-[#BFDBFE]">
                {INFO_TITLES[k]}
              </button>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
