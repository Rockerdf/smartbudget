// Site-wide details used by the footer, legal pages, Help Center and Contact page.
// Change them here and every page updates. Replace the placeholder email with a
// real inbox before you share the site publicly.

export const SITE = {
  name: "SmartBudget",
  tagline: "Financial wellness for everyone",
  /** Who runs the site. Shown on the legal pages. */
  operator: "the SmartBudget student project team",
  /** Placeholder address. Messages sent from the site open the visitor's email app addressed to this. */
  supportEmail: "support@smartbudget.example",
  privacyEmail: "privacy@smartbudget.example",
  country: "Australia",
  supportHours: "Monday to Friday, 9 am – 5 pm AEST (Sydney time)",
  /** Date shown as "Last updated" on the legal pages. */
  legalUpdated: "26 October 2026",
  year: 2026,
} as const;

/** Builds a mailto: link with an optional subject and body. */
export function mailto(to: string, subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const q = params.toString().replace(/\+/g, "%20");
  return `mailto:${to}${q ? `?${q}` : ""}`;
}
