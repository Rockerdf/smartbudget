// Real downloads for the "Export" buttons: CSV files and printable (Save as PDF) reports.

type Cell = string | number | boolean | null | undefined;

function csvCell(v: Cell): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  // The BOM lets Excel open UTF-8 CSV files (e.g. "$" and emoji) correctly.
  const blob = new Blob([type.startsWith("text/csv") ? "﻿" + content : content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, rows: Cell[][]) {
  downloadFile(filename, toCsv(rows));
}

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type ReportSection = { heading: string; rows: Cell[][]; note?: string };

/**
 * Opens a clean, printable report in a new tab and starts the browser's print
 * dialog, where the person can choose "Save as PDF". Returns false if a popup
 * blocker stopped the new tab.
 */
export function printReport(title: string, subtitle: string, sections: ReportSection[]): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  const tables = sections
    .map((s) => {
      const [head, ...body] = s.rows;
      const thead = head ? `<tr>${head.map((c) => `<th>${escapeHtml(String(c ?? ""))}</th>`).join("")}</tr>` : "";
      const tbody = body.length
        ? body.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${head?.length ?? 1}" class="empty">Nothing recorded yet.</td></tr>`;
      return `<section><h2>${escapeHtml(s.heading)}</h2>${s.note ? `<p class="note">${escapeHtml(s.note)}</p>` : ""}<table><thead>${thead}</thead><tbody>${tbody}</tbody></table></section>`;
    })
    .join("");
  w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box} body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0F172A;margin:32px;font-size:12px}
  header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2563EB;padding-bottom:12px;margin-bottom:20px}
  h1{font-size:20px;margin:0} .sub{color:#64748B;margin:4px 0 0} .brand{font-weight:700;color:#2563EB}
  h2{font-size:14px;margin:22px 0 8px} table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #E2E8F0;vertical-align:top} th{background:#F8FAFC;font-weight:600}
  .empty{color:#94A3B8;font-style:italic} .note{color:#64748B;margin:0 0 6px}
  footer{margin-top:28px;color:#94A3B8;font-size:10px;border-top:1px solid #E2E8F0;padding-top:8px}
  @media print{body{margin:12mm} section{break-inside:avoid-page}}
</style></head><body>
<header><div><h1>${escapeHtml(title)}</h1><p class="sub">${escapeHtml(subtitle)}</p></div><div class="brand">SmartBudget</div></header>
${tables}
<footer>Generated ${escapeHtml(new Date().toLocaleString("en-AU"))}. SmartBudget is an educational prototype. This report is not financial advice.</footer>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
</body></html>`);
  w.document.close();
  return true;
}
