# Changes

## Admin panel made fully real (28 October 2026)

- **Database (`supabase/admin_upgrade.sql`, also appended to `schema.sql`):** new tables for the activity log, sign-in events (with IP address and browser), lesson progress, content visibility and site settings; staff-only functions for dashboard stats, reports, security overview and the activity log. Role changes, suspensions, account deletions, settings and content changes are logged automatically by the database. Failed sign-in logging is rate limited. Security records are deleted after 12 months. 35 new permission tests (`supabase/tests/02_admin_tests.sql`).
- **Dashboard:** live counts, 30-day sign-up/sign-in chart, feature adoption, users by role, real recent activity, newest accounts, and working quick actions (including a user CSV export).
- **Reports:** monthly user activity, financial totals (anonymised), spending by category (only shown when 3+ people used it), lesson engagement and security, for 3/6/12 months, each exportable as CSV, plus a full PDF report.
- **Security Center:** real failed and successful sign-ins with IP and device; automatic alerts (5+ failed sign-ins in 24 hours, suspended accounts trying to sign in, new staff roles) that can be marked resolved.
- **Activity Log:** every staff action and sign-in event, with filters, search, paging and CSV export.
- **Roles & Permissions:** generated from the rules the app and database actually enforce, with live member lists.
- **Content:** hide or feature any lesson, video or book for all users; lesson start/completion stats. Lesson progress is now saved to each account.
- **Site Settings:** maintenance mode (holding page for non-staff), close sign-ups (also enforced by the database), switch the AI assistant off, and an announcement banner.
- Removed the "sample data" banner and the fake "All systems operational" (now a real database connection check). The admin panel now works on phones with a slide-out menu.
- Privacy Policy updated to describe sign-in records, lesson progress and staff access to totals.


## Launch-readiness pass (26 October 2026)

Starting point: the exact code running in Figma Make (newer than the Desktop repo; includes the demo-bank feature).

### New pages (each has its own web address)
- `/privacy` Privacy Policy, `/terms` Terms of Use, `/disclaimer` Disclaimer, `/cookies` Cookies & Local Storage, `/accessibility` Accessibility Statement, `/security` Security, `/about` About, `/contact` Contact (working form that opens the visitor's email app), `/help` public Help Center.
- Shared public header and footer. All 14 footer links now go somewhere (they all showed "coming soon" before). Browser Back/Forward works between pages.
- Legal pages are linked from the footer, sign-in page, sign-up page (Terms/Privacy pop-ups link to the full text), Help Center, Settings › Privacy, the app sidebar and the phone "More" menu.
- All site details (emails, hours, dates) live in `src/lib/site.ts`.

### Education Hub
- 15 real YouTube videos (Moneysmart/ASIC, Khan Academy, Two Cents/PBS, Vox, Motley Fool and others), each checked to exist and allow embedding. They play in privacy-enhanced mode and only load when pressed.
- Every lesson now includes a matching video.
- New lesson: Superannuation Basics (Australia).
- Books tab: 8 recommended books linked to Open Library, with covers.
- Free help tab: Moneysmart, National Debt Helpline (1800 007 007), Khan Academy Financial Literacy, Scamwatch.
- Lesson progress is now saved (it reset every time you left the page).
- "Suggested for you" now depends on your data (no goals yet / no budget yet) instead of always showing.

### Fake or broken things fixed
- **Analytics was almost entirely hard-coded sample data** (charts, "+4.2%" changes, "savings grew from $7.5k to $70.7k" insights, wellness radar). Rebuilt so every figure, chart and insight comes from your own transactions, budgets and goals. Monthly/Quarterly/Annual and date-range filters now really change the data.
- Analytics PDF export, Settings "Export CSV" and "Export PDF" only showed a "prototype" message. They now download a real CSV / open a printable report you can save as PDF.
- Dashboard "Budget Remaining" subtracted all spending (including categories with no budget), so it showed a negative figure while budget adherence said 100%. Now matches the Budget page.
- Notification bell always showed a red "unread" dot. It now shows the real unread count.
- Settings: "Member since January 2025" was hard-coded (now the real sign-up date); the currency picker did nothing (now shows AUD); notification toggles weren't saved and "Weekly report" emails don't exist (now two real toggles that control which alerts you get); consent wording made honest.
- "Continue with Google" buttons on sign-in and sign-up did nothing; removed.
- "Try Demo" on the landing page opened the login form; replaced with "See how it works".
- Help Center: search box didn't filter anything, the six topic cards did nothing, "Email Support", "Privacy Policy" and "Terms" showed "coming soon", several answers pointed to the wrong place (e.g. Delete Account is in the Privacy tab). All fixed; support hours changed from US Eastern time to AEST.
- "Join thousands of people" claims removed (unverifiable).
- Admin: Reports said "Export downloaded" even when nothing downloaded; Security Center export now downloads a CSV; System Settings "Saved" message made honest; non-working "Schedule weekly" removed.

### Design and usability
- Phones: the bottom bar only reached 5 of the 10 sections (Health Score, Learn, Help, Ask AI and Settings were unreachable). Added a "More" tab with everything, plus alerts, legal links and sign out.
- Landing hero "6-Month Savings Trend" chart was empty (bars had zero height). Fixed.
- "Up and running" step arrows were stuck below the cards. Now sit between them.
- "Sign in" was hidden on phones on the landing page. Now visible.
- Settings tabs were cut off on phones; Settings showed two chat buttons. Fixed.
- Dark mode: header bar stayed white with invisible title; tinted panels and badges stayed bright. Added proper dark styles.
- Every page now opens at the top (some opened half-way down).
- Long pop-up messages no longer run off the screen on phones.
- Settings toggles are now real buttons (keyboard and screen-reader accessible).
- Money and dates use Australian formatting throughout.
- Warning icon on the demo bank page was drawn incorrectly.

### Deployment
- Standalone `vite.config.ts` (the old one depended on Figma Make internals) with split bundles for faster loading.
- `index.html` with real title, description, favicon and theme colour.
- `vercel.json` and `netlify.toml` (page routing + security headers), `public/robots.txt`.
- GitHub Actions CI: type-check, tests, build.
- New `README.md` with setup, Supabase, deploy, GitHub and pre-launch checklist.
- Removed Figma Make–only files (`.figma/`, `AGENTS.md`, `CLAUDE.md`, `pnpm-lock.yaml`) and four unused admin screens (`AccessLog`, `AiLog`, `Categories`, `Flagged`).

Checked: TypeScript clean, production build clean (no warnings), 12/12 unit tests pass, every page and screen opened on desktop and phone with zero console errors.

---

## Earlier: security and real-data fix pack


## Security (most important)
- Removed hard-coded superadmin credentials, localStorage "users" and sessions. Sign-in is Supabase Auth only; role is read from the database.
- `supabase/schema.sql` rewritten (idempotent): RLS on every table, no anon access, users can update only their own `name`, role/status changes only through checked functions (`admin_set_role`, `admin_set_status`), system categories protected, check constraints, `delete_my_account`, `touch_last_login`, last-superadmin protection.
- Deleted dead code that exposed an admin password: `src/screens/admin/AdminLogin.tsx` (plus unused `BudgetPlanner.tsx`, `ExpenseTracker.tsx`). **Delete these three files from your repo.**
- `.gitignore` no longer hides `.env.example`; `.env.example` added (names only). Missing env vars show a setup page instead of a blank screen.

## Real behaviour instead of fake behaviour
- Settings: name save, password change, sign out other devices and Delete Account now really work; fake 2FA and fake sessions list removed.
- Budgets and Savings Goals are stored in Supabase (no seed data / localStorage).
- Transaction categories are now actually saved (previously always null).
- Transaction validation: description, real date, amount > 0 and a maximum; 12 unit tests.
- Dashboard, Health Score, Insights, Notifications are calculated from the user's real data; fake bills, "top 38% of users", "+3 vs last month", invented tips removed.
- Admin Users: create/delete removed (accounts are created by registration); edit role/status, reset password by email, self-protection.
- Fake bank accounts removed from the app shell.

## Honest content
- Landing: invented testimonials and "top 15%" removed; data-storage claims corrected. Help Center storage/encryption/delete text corrected.
- Admin: fake savings, 98.7% health and "All systems operational" removed; sample-data banners added.

## Files
New: `src/lib/{categories,errors,budgets,goals,insights}.ts`, `supabase/tests/*`, `.env.example`, `README.md`, `CHANGES.md`.
Replaced/patched: see the zip (paths mirror the project). Copy over your project, delete the three files above, then run `supabase/schema.sql`.
