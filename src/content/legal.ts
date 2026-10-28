// Text for the public information and legal pages.
// This is placeholder wording for an educational student prototype. Have it
// reviewed by a qualified person before using SmartBudget with real customers.
import { SITE } from "../lib/site";

export type InfoBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "callout"; tone: "info" | "warning"; text: string };

export type InfoSection = { id: string; heading: string; blocks: InfoBlock[] };

export type InfoPageContent = {
  title: string;
  summary: string;
  legal: boolean;
  sections: InfoSection[];
};

const p = (text: string): InfoBlock => ({ kind: "p", text });
const list = (...items: string[]): InfoBlock => ({ kind: "list", items });
const note = (text: string, tone: "info" | "warning" = "info"): InfoBlock => ({ kind: "callout", tone, text });

export type InfoKey =
  | "about" | "contact" | "privacy" | "terms" | "disclaimer" | "cookies" | "accessibility" | "security";

export const INFO_PAGES: Record<Exclude<InfoKey, "contact">, InfoPageContent> = {
  about: {
    title: "About SmartBudget",
    summary: "Who we are, why we built SmartBudget and what it can (and can't) do for you.",
    legal: false,
    sections: [
      {
        id: "mission", heading: "Our mission",
        blocks: [
          p(`${SITE.name} helps people build confident, everyday money habits. You can track what you spend, set a monthly budget, save towards goals and learn the basics of personal finance in plain English.`),
          p("We believe financial wellbeing is a skill anyone can learn, and that good tools should be free, private and easy to understand."),
        ],
      },
      {
        id: "project", heading: "A student project",
        blocks: [
          p(`${SITE.name} is an educational prototype created as a university capstone project in ${SITE.country}. It is run by ${SITE.operator}, not by a bank or a licensed financial adviser.`),
          note("SmartBudget is for learning and personal organisation only. It does not provide financial, investment, tax or legal advice. Please do not enter real bank login details anywhere in the app.", "warning"),
        ],
      },
      {
        id: "features", heading: "What you can do",
        blocks: [
          list(
            "Record income and expenses and sort them into categories.",
            "Set monthly budgets per category and see how much is left.",
            "Create savings goals with target dates and track progress.",
            "See charts of your spending trends and a simple Financial Health Score.",
            "Learn with short lessons, curated videos and recommended books in the Education Hub.",
            "Ask the AI agent anything, or have it record receipts, import statements and manage budgets and goals for you.",
          ),
        ],
      },
      {
        id: "how", heading: "How it is built",
        blocks: [
          p("The app is built with React, TypeScript and Tailwind CSS. Accounts and data are handled by Supabase, which provides secure sign-in and a PostgreSQL database where Row Level Security ensures each person can only see their own records."),
          p("The bank connection is a clearly labelled simulation and never contacts a real bank."),
        ],
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    summary: "What information SmartBudget collects, why, where it is kept and the choices you have.",
    legal: true,
    sections: [
      {
        id: "overview", heading: "1. Overview",
        blocks: [
          p(`This policy explains how ${SITE.operator} ("we", "us") handles personal information when you use ${SITE.name}. We aim to handle personal information in line with the Australian Privacy Principles in the Privacy Act 1988 (Cth).`),
          p("By creating an account you agree to this policy. If you do not agree, please do not use the app."),
        ],
      },
      {
        id: "collect", heading: "2. Information we collect",
        blocks: [
          list(
            "Account details: your name, email address and an encrypted password (managed by our authentication provider, so we never see your password).",
            "Financial records you choose to enter: transactions, categories, budgets, savings goals and notes.",
            "Account activity: when your account was created, your Education Hub lesson progress, and a security record of sign-ins (successful and failed), sign-outs and password-reset requests, including the IP address and browser used.",
            "If you use the AI agent: your messages, its replies, and any files you upload (for example receipt photos, statements, spreadsheets or videos). Files are kept in private storage that only you can open.",
            "Preferences stored in your browser: theme (light or dark), notification choices and whether the demo bank is connected.",
          ),
          p("We do not ask for, and you should never enter, real bank usernames, passwords, card numbers or tax file numbers."),
        ],
      },
      {
        id: "use", heading: "3. How we use it",
        blocks: [
          list(
            "To create and secure your account and let you sign in.",
            "To show your dashboard, budgets, goals, charts, insights and notifications.",
            "To send account emails you request, such as password-reset links.",
            "To run the AI agent: answer your questions and carry out the tasks you ask for, such as recording a receipt as a transaction.",
            "To keep the service working, detect suspicious sign-in attempts, prevent misuse and fix problems.",
          ),
          p("We do not sell your personal information, show you advertising, or use your data to make credit decisions."),
        ],
      },
      {
        id: "store", heading: "4. Where your information is stored",
        blocks: [
          p("Your account and records are stored with Supabase, a third-party database and authentication provider. Depending on the hosting region of the project, data may be stored on servers outside Australia. Connections are encrypted with HTTPS, and database rules (Row Level Security) mean each user can read and change only their own records."),
          p("The website itself may be hosted by a static hosting provider (for example Vercel, Netlify or GitHub Pages), which may keep standard server logs such as IP addresses for security purposes."),
        ],
      },
      {
        id: "share", heading: "5. Who we share it with",
        blocks: [
          p("We only share information with service providers that help us run the app (database, authentication, email delivery and hosting), and only as needed for them to provide that service. We may also disclose information if the law requires it."),
          p("AI agent: when you send the agent a message, that message, recent messages in the same chat, any files you attach, and the records the agent looks up to answer you (for example your transactions for a month) are sent to Google's Gemini API to produce the reply. This project uses Google's free tier, under which Google may keep and use this content to improve its products, and it may be processed outside Australia. Do not upload documents containing passwords, full card numbers or identity documents. If you don't want your information sent to Google, don't use the AI agent; the rest of SmartBudget works without it."),
          p("Support and admin staff of the project can see basic account details (name, email, role, status and sign-in history) to help users and keep the service safe. They cannot see your password, and they never see your individual transactions, budgets or goals. Staff reports only show combined totals across all users (for example, the number of transactions recorded each month), and spending categories are only shown when at least three different people have used them."),
        ],
      },
      {
        id: "choices", heading: "6. Your choices and rights",
        blocks: [
          list(
            "View and update your name in Settings › Profile.",
            "Download your data at any time from Settings › Privacy (CSV or a printable report), including your AI agent chats.",
            "Delete any AI agent chat (and the files in it) from the chat list on the AI Agent page.",
            "Delete your account and all associated records from Settings › Privacy › Delete Account. This cannot be undone.",
            `Ask us to access or correct your information by emailing ${SITE.privacyEmail}.`,
          ),
        ],
      },
      {
        id: "retention", heading: "7. How long we keep it",
        blocks: [
          p("We keep your information while your account is open. When you delete your account, your profile, transactions, budgets, goals, lesson progress, AI agent chats and uploaded files are deleted. AI usage counters are kept for 2 days. Security records of sign-ins and staff actions are kept for up to 12 months to protect the service, then deleted. Backups held by our providers are removed on their normal schedule."),
        ],
      },
      {
        id: "children", heading: "8. Children",
        blocks: [p(`${SITE.name} is intended for people aged 16 and over. We do not knowingly collect information from younger children.`)],
      },
      {
        id: "contact", heading: "9. Contact and complaints",
        blocks: [
          p(`For privacy questions or complaints, email ${SITE.privacyEmail}. We aim to reply within 30 days. If you are not satisfied with our response, you can contact the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au.`),
          p("We may update this policy from time to time. The date at the top of this page shows when it last changed."),
        ],
      },
    ],
  },

  terms: {
    title: "Terms of Use",
    summary: "The rules for using SmartBudget. Please read them before creating an account.",
    legal: true,
    sections: [
      {
        id: "accept", heading: "1. Accepting these terms",
        blocks: [p(`By creating an account or using ${SITE.name}, you agree to these Terms of Use and our Privacy Policy. If you do not agree, please do not use the service.`)],
      },
      {
        id: "service", heading: "2. What SmartBudget is",
        blocks: [
          p(`${SITE.name} is a free, educational budgeting tool provided by ${SITE.operator}. It is a prototype and may change, contain errors or be unavailable at times. Features may be added or removed without notice.`),
          note("SmartBudget provides general information only and is not financial advice. See the Disclaimer for details.", "warning"),
        ],
      },
      {
        id: "account", heading: "3. Your account",
        blocks: [
          list(
            "You must be at least 16 years old and provide accurate details.",
            "Keep your password private. You are responsible for activity on your account.",
            "Tell us promptly if you think someone else has accessed your account.",
            "One person per account. Do not create accounts for others without their permission.",
          ),
        ],
      },
      {
        id: "use", heading: "4. Acceptable use",
        blocks: [
          p("You agree not to:"),
          list(
            "enter real bank login details, card numbers or other people's personal information;",
            "try to access other users' data or bypass security controls;",
            "upload harmful code, spam or unlawful content;",
            "overload, disrupt, copy or reverse-engineer the service.",
          ),
          p("We may suspend or close accounts that break these terms."),
        ],
      },
      {
        id: "content", heading: "5. Your content",
        blocks: [p("You own the information you enter. You give us permission to store and process it only to provide the service to you. You can export or delete it at any time from Settings.")],
      },
      {
        id: "third", heading: "6. Third-party content",
        blocks: [p("The Education Hub links to videos, books and websites made by others. We do not control or endorse that content and are not responsible for it. Opening those links is at your own discretion and subject to their own terms.")],
      },
      {
        id: "liability", heading: "7. No warranty and limitation of liability",
        blocks: [
          p("The service is provided \"as is\" without warranties of any kind. To the extent permitted by law, we are not liable for any loss arising from your use of the service, including decisions you make based on its calculations or content."),
          p("Nothing in these terms excludes rights you have under the Australian Consumer Law that cannot be excluded."),
        ],
      },
      {
        id: "end", heading: "8. Ending your use",
        blocks: [p("You can stop using SmartBudget and delete your account at any time from Settings. We may end the service, for example when the project finishes, and will try to give reasonable notice so you can export your data.")],
      },
      {
        id: "changes", heading: "9. Changes and governing law",
        blocks: [p(`We may update these terms. Continued use after changes means you accept them. These terms are governed by the laws of ${SITE.country}. Questions? Email ${SITE.supportEmail}.`)],
      },
    ],
  },

  disclaimer: {
    title: "Disclaimer",
    summary: "SmartBudget is an educational tool. Here is what that means for you.",
    legal: true,
    sections: [
      {
        id: "general", heading: "General information only",
        blocks: [
          note("The information in SmartBudget is general in nature and does not take into account your objectives, financial situation or needs. It is not financial, investment, credit, tax or legal advice.", "warning"),
          p(`${SITE.operator} is not a licensed financial adviser and does not hold an Australian Financial Services Licence or Australian Credit Licence. Before making a financial decision, consider whether the information is right for you and speak to a qualified, licensed professional.`),
        ],
      },
      {
        id: "calculations", heading: "Calculations and scores",
        blocks: [p("Budgets, charts, insights, savings projections and the Financial Health Score are simple calculations based only on the information you enter. They may be incomplete or inaccurate and are not a credit score or an official assessment of your finances.")],
      },
      {
        id: "assistant", heading: "The AI agent",
        blocks: [p("The AI agent uses Google Gemini to answer questions and to record, change or delete information in your own SmartBudget account when you ask it to. It can misread receipts or misunderstand requests, so check what it records; anything that deletes data waits for your approval. It does not know your full circumstances, cannot move real money, and its answers are general educational information, not financial advice.")],
      },
      {
        id: "bank", heading: "Demo bank connection",
        blocks: [p("The bank connection feature is a simulation using a fictional \"Harbour Demo Bank\". It does not connect to any real financial institution, and sample transactions are labelled [Demo].")],
      },
      {
        id: "links", heading: "External links",
        blocks: [p("Videos, books and websites listed in the Education Hub are created by third parties. We include them because they may be helpful for learning, not as endorsements, and they may contain views we do not share.")],
      },
      {
        id: "help", heading: "Need help with money worries?",
        blocks: [p("If you are in financial difficulty, free and confidential help is available from the National Debt Helpline on 1800 007 007 (ndh.org.au), and from Moneysmart (moneysmart.gov.au), the Australian Government's financial guidance website.")],
      },
    ],
  },

  cookies: {
    title: "Cookies & Local Storage",
    summary: "SmartBudget does not use advertising or tracking cookies. Here is what is stored in your browser and why.",
    legal: true,
    sections: [
      {
        id: "summary", heading: "In short",
        blocks: [note("We do not use advertising cookies, cross-site tracking or third-party analytics. We only store what the app needs to work and to remember your preferences.")],
      },
      {
        id: "essential", heading: "Essential storage",
        blocks: [
          p("These are needed for the app to work and cannot be switched off:"),
          list(
            "Sign-in session (stored by Supabase Auth in your browser's local storage) so you stay signed in.",
            "\"Remember me\" choice, so we know whether to keep you signed in after you close the browser.",
          ),
        ],
      },
      {
        id: "preferences", heading: "Preference storage",
        blocks: [
          list(
            "Light or dark theme.",
            "Which notifications you have read or dismissed, and which kinds you want to see.",
            "Whether the demo bank is connected, and your privacy consent choices.",
          ),
          p("This information stays in your browser and is not sent to us."),
        ],
      },
      {
        id: "third", heading: "Embedded videos",
        blocks: [p("Videos in the Education Hub are embedded from YouTube using its privacy-enhanced mode (youtube-nocookie.com). YouTube may set its own cookies only after you choose to play a video. See Google's privacy policy for details.")],
      },
      {
        id: "control", heading: "Your control",
        blocks: [p("You can clear this storage at any time in your browser settings. Doing so will sign you out and reset your preferences. You can also review your consent choices in Settings › Privacy.")],
      },
    ],
  },

  accessibility: {
    title: "Accessibility Statement",
    summary: "We want SmartBudget to be usable by everyone.",
    legal: false,
    sections: [
      {
        id: "commitment", heading: "Our commitment",
        blocks: [p(`We aim for ${SITE.name} to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA. We are a small student team, so some parts may not yet fully meet this goal.`)],
      },
      {
        id: "features", heading: "What we have done",
        blocks: [
          list(
            "Text and controls designed for readable colour contrast, with a dark mode option.",
            "Layouts that adapt to phones, tablets and desktop screens and support browser zoom.",
            "Buttons and form fields with visible labels and keyboard focus styles.",
            "Charts are accompanied by text figures so the information is not only shown visually.",
            "Videos in the Education Hub come from YouTube, which offers captions on most videos.",
          ),
        ],
      },
      {
        id: "known", heading: "Known limitations",
        blocks: [list(
          "Some charts may be hard to read with a screen reader; the same figures are shown as text on each page.",
          "Third-party content (such as videos) is controlled by its owners.",
        )],
      },
      {
        id: "feedback", heading: "Feedback",
        blocks: [p(`If something is hard to use, please tell us at ${SITE.supportEmail} and include the page and the device or assistive technology you use. We aim to respond within five business days.`)],
      },
    ],
  },

  security: {
    title: "Security",
    summary: "How SmartBudget protects your account and data, and how to report a problem.",
    legal: false,
    sections: [
      {
        id: "measures", heading: "How we protect you",
        blocks: [
          list(
            "All traffic is encrypted with HTTPS.",
            "Passwords are handled by Supabase Auth and stored as secure hashes; we never see them.",
            "Row Level Security in the database means each account can only read and change its own records.",
            "Roles (user, support, admin) are stored in the database and checked on the server, not in the browser.",
            "No real bank credentials are ever requested or stored.",
          ),
        ],
      },
      {
        id: "you", heading: "Keeping your account safe",
        blocks: [
          list(
            "Use a unique password of at least 8 characters that you don't use elsewhere.",
            "Sign out on shared computers, or use Settings › Security › Sign out of other devices.",
            "We will never ask for your password by email or phone.",
            "Be alert to scams. You can learn about and report scams at scamwatch.gov.au.",
          ),
        ],
      },
      {
        id: "report", heading: "Report a vulnerability",
        blocks: [p(`If you believe you have found a security issue, please email ${SITE.supportEmail} with the subject "Security" and steps to reproduce it. Please do not access other people's data or disrupt the service while testing.`)],
      },
    ],
  },
};

export const INFO_PATHS: Record<InfoKey, string> = {
  about: "/about",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
  disclaimer: "/disclaimer",
  cookies: "/cookies",
  accessibility: "/accessibility",
  security: "/security",
};

export const INFO_TITLES: Record<InfoKey, string> = {
  about: "About",
  contact: "Contact",
  privacy: "Privacy Policy",
  terms: "Terms of Use",
  disclaimer: "Disclaimer",
  cookies: "Cookies & Storage",
  accessibility: "Accessibility",
  security: "Security",
};
