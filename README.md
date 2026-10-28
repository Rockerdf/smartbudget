# SmartBudget

An educational personal-finance web app: track income and expenses, set monthly budgets, save towards goals, see your trends, and learn money basics with lessons, videos and books.

Built with **React 19, TypeScript, Vite, Tailwind CSS v4 and Supabase** (auth + PostgreSQL with Row Level Security).

> University capstone prototype. Not financial advice. Do not enter real bank details.

---

## 1. Run it on your computer

Requirements: [Node.js](https://nodejs.org) 20.19 or newer (22 recommended).

```bash
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
# open .env and paste your Supabase URL and anon key (see step 2)
npm run dev
```

Open http://localhost:5173.

## 2. Supabase (database + sign-in)

1. In your Supabase project go to **Project Settings › API** and copy the **Project URL** and the **anon / public** key into `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
   Never use the `service_role` key in this app.
2. **SQL Editor** › run `supabase/schema.sql` (safe to re-run).
3. **Authentication › Providers › Email**: set the minimum password length to 8.
4. **Authentication › URL Configuration**: set **Site URL** to your live address (e.g. `https://smartbudget.vercel.app`) and add it to **Redirect URLs**, so password-reset emails link to the right place.
5. First admin: register in the app, then in the SQL Editor run
   ```sql
   update public.users set role = 'superadmin' where email = 'you@example.com';
   ```

If the two `VITE_` values are missing, the app shows a "not configured yet" page instead of a blank screen.

## AI agent (Google Gemini)

The AI Agent page needs three things. Until they're done, the page explains what is missing; the rest of the app works without it.

1. **Database:** run `supabase/agent_upgrade.sql` in the SQL Editor (new projects: already in `schema.sql`).
2. **Gemini key:** create a free key at https://aistudio.google.com/apikey. In Supabase go to **Edge Functions › Secrets** and add `GEMINI_API_KEY` with that key. Optional: `GEMINI_MODEL` (default `gemini-flash-latest`).
3. **Deploy the function:** **Edge Functions › Deploy a new function › Via Editor**, name it exactly `agent`, replace the sample code with the whole of `supabase/functions/agent/index.ts`, and deploy. Then open the function's **Settings** and turn **Verify JWT** (Enforce JWT verification) **off**; the function checks the sign-in itself.
   (With the Supabase CLI instead: `supabase functions deploy agent --no-verify-jwt`.)

Never put the Gemini key in `.env` or in the website code. On Google's free tier, Google may use prompts and files to improve its products (this is stated in the Privacy Policy); use a paid key for real users' data.

## Upgrading an existing database

If your Supabase project was set up before 28 October 2026, open **SQL Editor → New query** and run, in this order, `supabase/admin_upgrade.sql` and then `supabase/agent_upgrade.sql`. Both are safe to run more than once. (`supabase/schema.sql` already includes both, so a new project only needs `schema.sql`.)

## Admin panel

Sign in with a `support`, `admin` or `superadmin` account to reach it. Everything is read live from the database through staff-only functions:

| Page | What it shows / does | Who |
|---|---|---|
| Dashboard | Users, activity, sign-ins, feature adoption, recent activity, quick actions, user export | all staff |
| AI Agent | Ask about the platform or give tasks; changes wait for Approve | all staff (tools by role) |
| Users | Search, suspend/reactivate, reset passwords, change roles | all staff (actions by role) |
| Roles & Permissions | The real permission rules and who has each role | superadmin |
| Reports | Monthly user, financial (anonymised), category, education and security reports; CSV/PDF | all staff |
| Content | Hide or feature lessons, videos and books; lesson completion stats | superadmin |
| Security Center | Failed/successful sign-ins with IP and device, automatic alerts | admin, superadmin |
| Activity Log | Every staff action and sign-in event; search, filter, export | admin, superadmin |
| Site Settings | Maintenance mode, sign-ups on/off, AI agent on/off and usage limits, announcement banner | superadmin |

Staff never see individual people's transactions, budgets or goals, only totals.

## 3. Deploy

The app is a static site (`npm run build` → `dist/`). Pages such as `/privacy` and `/terms` are handled by the app, so the host must send all paths to `index.html`. The config for that is already included.

**Vercel (easiest)**
1. Push this folder to a GitHub repository (see step 4).
2. At vercel.com › **Add New › Project** › import the repo. Vercel detects Vite and uses `vercel.json`.
3. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Then put the new URL into Supabase (step 2.4).

**Netlify**: **Add new site › Import from Git**, pick the repo. `netlify.toml` sets the build command, output folder and redirects. Add the same two environment variables under **Site configuration › Environment variables**.

**Any other static host**: run `npm run build` with the env vars set, upload `dist/`, and configure "rewrite all paths to /index.html".

## 4. Put it on GitHub

```bash
git init
git add .
git commit -m "SmartBudget: launch-ready version"
git branch -M main
git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
git push -u origin main
```

`.env` is ignored by git on purpose; your keys stay on your computer and in your hosting settings. The included GitHub Action (`.github/workflows/ci.yml`) type-checks, tests and builds every push.

## 5. Before going public: checklist

- [ ] Replace the placeholder emails in **`src/lib/site.ts`** (`support@smartbudget.example`, `privacy@smartbudget.example`) with real inboxes. Every page, the footer and the contact form use this file.
- [ ] Have the legal pages (`src/content/legal.ts`) reviewed. They are sample wording for a student prototype.
- [ ] Search engines are blocked for now (`<meta name="robots">` in `index.html` and `public/robots.txt`). Remove both when you want the site indexed.
- [ ] Set the Supabase Site URL / Redirect URLs to the live domain.
- [ ] Sign up, sign in, add a transaction, budget and goal, export your data, and delete a test account on the live site.

## Where things are

| What | File |
|---|---|
| Site name, contact emails, support hours, "last updated" date | `src/lib/site.ts` |
| Privacy, Terms, Disclaimer, Cookies, Accessibility, Security, About text | `src/content/legal.ts` |
| Lessons, videos, books and free-help links | `src/content/education.ts` |
| Page routing and URLs | `src/App.tsx` |
| Header/footer for public pages | `src/components/SiteChrome.tsx` |
| Database schema and security rules | `supabase/schema.sql` |
| AI agent server code (tools, Gemini) | `supabase/functions/agent/index.ts` |
| AI agent page | `src/screens/Agent.tsx`, `src/lib/agent.ts` |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run typecheck` | TypeScript check only |
| `npm test` | Transaction-validation unit tests |

## Known limitations

- Bank connection is a clearly labelled simulation ("Harbour Demo Bank").
- Two-factor authentication and changing your email address are not implemented.
- The AI agent can misread receipts; it shows exactly what it recorded so people can check.
- The contact form opens the visitor's email app (there is no server-side mail sending).

See `CHANGES.md` for the full list of fixes in this version.
