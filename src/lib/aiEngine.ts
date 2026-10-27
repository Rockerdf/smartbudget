// ── AI Response Engine ────────────────────────────────────────────────────────
// Generates context-aware, rule-based responses. No external API calls.
// All financial content is educational only — never prescriptive.

export type AssistantContext =
  | "dashboard"
  | "transactions"
  | "budget"
  | "savings"
  | "profile"
  | "admin-users"
  | "admin-security"
  | "admin-audit";

export type ContextData = {
  // User finance data (optional — only available on user screens)
  totalSpent?:    number;
  monthlyIncome?: number;
  savingsRate?:   number;     // 0–1
  topCategory?:   string;
  goalsCount?:    number;
  budgetUsed?:    number;     // 0–1  (spent/budget)
  transactionCount?: number;
  userName?:      string;

  // Admin data (optional — only available on admin screens)
  totalUsers?:    number;
  activeUsers?:   number;
  suspendedUsers?: number;
  openAlerts?:    number;
  auditCount?:    number;
};

// ── Disclaimer ────────────────────────────────────────────────────────────────

export const FINANCIAL_DISCLAIMER =
  "Educational insight only – not financial advice. SmartBudget does not provide personalised investment, tax, credit, or insurance recommendations.";

// ── Suggested prompts per context ─────────────────────────────────────────────

export const SUGGESTED_PROMPTS: Record<AssistantContext, string[]> = {
  dashboard: [
    "How is my spending looking this month?",
    "What's my current savings rate?",
    "Which category am I spending most on?",
    "How can I improve my financial health?",
    "What should I focus on next?",
  ],
  transactions: [
    "What are my biggest expenses this month?",
    "How do I categorise a transaction?",
    "What does 'AI-suggested category' mean?",
    "How can I spot unusual spending?",
    "What's a good way to track cash purchases?",
  ],
  budget: [
    "Am I on track with my budget?",
    "Which category is closest to its limit?",
    "How do I set a budget for a new category?",
    "What is the 50/30/20 rule?",
    "How much should I budget for food?",
  ],
  savings: [
    "Am I on track for my goals?",
    "Which goal needs the most attention?",
    "How do I calculate how long a goal will take?",
    "What is a good emergency fund size?",
    "How do automatic transfers help savings?",
  ],
  profile: [
    "How do I update my email?",
    "How do I connect a bank account?",
    "How do I change my password?",
    "What data does SmartBudget store?",
    "How do I delete my account?",
  ],
  "admin-users": [
    "How do I suspend a user?",
    "How do I reset a user's password?",
    "What roles can I assign to users?",
    "How do I create a new admin account?",
    "What happens when I delete a user?",
  ],
  "admin-security": [
    "What does a brute-force alert mean?",
    "How are IPs automatically blocked?",
    "How do I resolve a security alert?",
    "What is credential stuffing?",
    "What counts as a suspicious login?",
  ],
  "admin-audit": [
    "How do I filter the audit log?",
    "What events are captured in the log?",
    "How do I export audit data?",
    "What does a 'critical' severity mean?",
    "How far back do logs go?",
  ],
};

// ── Response generation ───────────────────────────────────────────────────────

type Message = { text: string; disclaimer?: boolean };

function match(input: string, ...keywords: string[]): boolean {
  const lc = input.toLowerCase();
  return keywords.some((k) => lc.includes(k));
}

function fmt(n: number, currency = true): string {
  const abs = Math.abs(n);
  if (currency) return `$${abs.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return abs.toLocaleString("en-AU");
}

// ── Dashboard responses ───────────────────────────────────────────────────────

function dashboardResponse(input: string, data: ContextData): Message {
  const { totalSpent = 2567, monthlyIncome = 4200, savingsRate, topCategory = "Housing", userName } = data;
  const rate = savingsRate ?? ((monthlyIncome - totalSpent) / monthlyIncome);
  const ratePercent = Math.round(rate * 100);
  const saved = monthlyIncome - totalSpent;
  const name = userName ? `, ${userName.split(" ")[0]}` : "";

  if (match(input, "spending", "spent", "expense", "how much")) {
    return {
      text: `This month you've spent ${fmt(totalSpent)} of your ${fmt(monthlyIncome)} income. That leaves ${fmt(saved)} — a savings rate of about ${ratePercent}%.\n\nYour top spending category is **${topCategory}**. If you want to reduce spending, reviewing that category first usually has the biggest impact.`,
      disclaimer: true,
    };
  }

  if (match(input, "savings rate", "saving rate", "how much saving", "am i saving")) {
    const advice =
      ratePercent >= 20
        ? "That's above the commonly cited 20% benchmark — a positive sign."
        : ratePercent >= 10
        ? "That's in the 10–20% range, which many people find a practical starting point."
        : "Many financial educators suggest working toward 10–20% over time, but every situation is different.";
    return {
      text: `Your current savings rate is **${ratePercent}%** (${fmt(saved)} saved out of ${fmt(monthlyIncome)} income). ${advice}\n\nSmall, consistent changes — like reducing one discretionary category — can raise this meaningfully over several months.`,
      disclaimer: true,
    };
  }

  if (match(input, "category", "most", "biggest", "top")) {
    return {
      text: `Your highest spending category this month is **${topCategory}**. \n\nExploring the Transactions page can help you see exactly which merchants are driving this. Seeing individual transactions often reveals small recurring costs that add up faster than expected.`,
      disclaimer: true,
    };
  }

  if (match(input, "improve", "better", "health", "tips", "advice", "focus", "next")) {
    const tips = [
      `• **Review ${topCategory} spending** — it's your largest outgoing.`,
      `• **Set a monthly budget cap** for discretionary categories on the Budget page.`,
      `• **Check your savings goals** — even a small increase in monthly contributions compounds over time.`,
      `• **Connect a second account** to get a fuller picture of your cash flow.`,
    ];
    return {
      text: `Here are a few areas worth exploring${name}:\n\n${tips.join("\n")}\n\nSmall, consistent habits tend to outperform large one-off efforts over time.`,
      disclaimer: true,
    };
  }

  if (match(input, "hello", "hi", "hey", "help")) {
    return {
      text: `Hi${name}! I'm your Dashboard Assistant. I can help you understand your spending, savings rate, and overall financial picture.\n\nTry asking me about your spending this month, your savings rate, or what to focus on next.`,
    };
  }

  return {
    text: `I can help you understand your dashboard data. You've spent ${fmt(totalSpent)} this month (savings rate: ${ratePercent}%). Try asking about your spending, savings rate, or which category to focus on.`,
    disclaimer: true,
  };
}

// ── Transaction responses ─────────────────────────────────────────────────────

function transactionsResponse(input: string, data: ContextData): Message {
  const { totalSpent = 2567, topCategory = "Food & Dining", transactionCount = 24 } = data;

  if (match(input, "biggest", "largest", "most expensive", "top expense")) {
    return {
      text: `Based on your transaction history, **${topCategory}** is driving the most spend this month — a common pattern for many people.\n\nLook for recurring charges (subscriptions, auto-renewals) and compare merchants to spot where small savings might be possible.`,
      disclaimer: true,
    };
  }

  if (match(input, "categoris", "category", "label", "tag")) {
    return {
      text: `SmartBudget uses AI-suggested categories for each transaction. The suggestion appears next to the merchant name.\n\n**To confirm or change a category:**\n1. Click the category label on any transaction row\n2. Select the correct category from the dropdown\n3. The change is saved immediately and updates your budget totals\n\nConfirmed categories help the AI learn your preferences over time.`,
    };
  }

  if (match(input, "ai", "suggested", "suggestion", "auto")) {
    return {
      text: `The **AI-suggested category** is a best-guess based on the merchant name. Common merchants are recognised automatically.\n\nIf the suggestion is wrong, you can correct it in one click — this makes your budget reports more accurate.`,
    };
  }

  if (match(input, "unusual", "suspicious", "weird", "strange", "anomaly")) {
    return {
      text: `To spot unusual spending, look for:\n\n• **Merchants you don't recognise** — may indicate an unauthorised charge\n• **Duplicate transactions** from the same merchant on the same day\n• **Subscriptions you've forgotten** — recurring small amounts add up\n• **Large one-off amounts** outside your normal pattern\n\nIf you see an unrecognised charge, contact your bank or card issuer promptly.`,
      disclaimer: true,
    };
  }

  if (match(input, "cash", "atm", "withdrawal")) {
    return {
      text: `Cash transactions won't appear automatically — only card and bank transfers do. To track cash spending, you can manually log it via the Add Transaction button and label it with the appropriate category.\n\nSome people find a simple rule helpful: split cash withdrawals across the likely categories they'll be used for.`,
      disclaimer: true,
    };
  }

  if (match(input, "hello", "hi", "hey", "help")) {
    return {
      text: `Hi! I'm your Transaction Assistant. I can help you understand your spending patterns, explain categories, and spot unusual charges.\n\nYou have **${transactionCount} transactions** recorded this month, totalling **${fmt(totalSpent)} in expenses**.`,
    };
  }

  return {
    text: `I can help with your transactions. You have ${transactionCount} transactions this month. Try asking about your biggest expenses, how categories work, or how to spot unusual spending.`,
    disclaimer: true,
  };
}

// ── Budget responses ──────────────────────────────────────────────────────────

function budgetResponse(input: string, data: ContextData): Message {
  const { budgetUsed = 0.75, topCategory = "Housing", monthlyIncome = 4200 } = data;
  const usedPercent = Math.round(budgetUsed * 100);

  if (match(input, "on track", "track", "how am i", "status")) {
    const status =
      budgetUsed < 0.7
        ? "You're tracking well below your budget limits this month."
        : budgetUsed < 0.9
        ? "You're on track but getting closer to some category limits."
        : "You're near or over budget in some categories — worth checking which ones.";
    return {
      text: `Overall you've used about **${usedPercent}%** of your monthly budget. ${status}\n\nCheck the category bars — any bar that's orange or red is approaching its limit.`,
      disclaimer: true,
    };
  }

  if (match(input, "50/30/20", "rule", "guideline", "how much should")) {
    return {
      text: `The **50/30/20 guideline** is a popular way to think about budgeting:\n\n• **50%** — Needs (rent, groceries, utilities, transport)\n• **30%** — Wants (dining out, subscriptions, hobbies)\n• **20%** — Savings & debt repayment\n\nWith ${fmt(monthlyIncome)} income, that would be roughly:\n• Needs: ${fmt(monthlyIncome * 0.5)}\n• Wants: ${fmt(monthlyIncome * 0.3)}\n• Savings: ${fmt(monthlyIncome * 0.2)}\n\nThese are rough reference points, not rules — every household's situation is different.`,
      disclaimer: true,
    };
  }

  if (match(input, "set", "create", "add", "new budget", "new category")) {
    return {
      text: `To set a budget for a category:\n\n1. Find the category card on this page\n2. Click the **edit (pencil)** icon\n3. Enter your monthly limit\n4. Save — your budget bar will update instantly\n\nStart with categories where you have the most control over spending.`,
    };
  }

  if (match(input, "food", "groceries", "dining")) {
    return {
      text: `Food & Dining budgets vary widely by household size and location. A common reference range is **10–15% of income** for groceries plus dining out.\n\nLooking at your last 2–3 months of transactions can reveal your typical baseline — that's often a more realistic starting point than a target figure.`,
      disclaimer: true,
    };
  }

  if (match(input, "limit", "over budget", "exceeded", "warning")) {
    return {
      text: `When a category reaches **80% of its limit** it turns orange. At **100%** it turns red.\n\nIf you've gone over budget in a category, a few options worth considering:\n\n• **Reduce remaining spending** in that category for the month\n• **Adjust the limit** if the budget was unrealistic\n• **Review transactions** to see if any were miscategorised`,
      disclaimer: true,
    };
  }

  if (match(input, "hello", "hi", "hey", "help")) {
    return {
      text: `Hi! I'm your Budget Assistant. I can explain how your budget works, help you understand the 50/30/20 guideline, and answer questions about individual categories.\n\nYou've used about **${usedPercent}%** of your overall budget this month.`,
    };
  }

  return {
    text: `I can help with your budget. You've used ${usedPercent}% of your monthly limits. Try asking about the 50/30/20 rule, how to set a budget cap, or whether you're on track.`,
    disclaimer: true,
  };
}

// ── Savings responses ─────────────────────────────────────────────────────────

function savingsResponse(input: string, data: ContextData): Message {
  const { goalsCount = 3, savingsRate, monthlyIncome = 4200, totalSpent = 2567 } = data;
  const saved = monthlyIncome - totalSpent;
  const rate  = savingsRate ?? (saved / monthlyIncome);
  const rateP = Math.round(rate * 100);

  if (match(input, "on track", "track", "progress", "how am i")) {
    return {
      text: `You have **${goalsCount} active savings goals**. Based on your current monthly surplus of **${fmt(saved)}**, you're saving at a **${rateP}% rate**.\n\nCheck each goal's progress bar — any goal showing red is behind its target date. Increasing the monthly contribution, even slightly, can have a notable effect on the projected completion date.`,
      disclaimer: true,
    };
  }

  if (match(input, "emergency fund", "emergency", "rainy day")) {
    return {
      text: `An **emergency fund** is typically described as 3–6 months of essential living expenses (rent, food, utilities, transport).\n\nWith your current expense level of roughly **${fmt(totalSpent)}/month**, that range would be approximately **${fmt(totalSpent * 3)}–${fmt(totalSpent * 6)}**.\n\nMany people build this before focusing on other savings goals, since it provides a financial buffer that reduces the need to take on debt for unexpected costs.`,
      disclaimer: true,
    };
  }

  if (match(input, "how long", "calculate", "when will", "timeline")) {
    return {
      text: `The time to reach a goal is roughly: **(Target – Current Saved) ÷ Monthly Contribution**\n\nFor example, if you need $3,000 more and contribute $200/month, that's 15 months.\n\nYou can see each goal's projected date on its card. Increasing monthly contributions — even by a small amount — shortens the timeline more than you might expect due to the compounding effect of consistent saving.`,
      disclaimer: true,
    };
  }

  if (match(input, "automatic", "auto", "transfer", "direct debit", "standing order")) {
    return {
      text: `Setting up an **automatic transfer on payday** is one of the most reliable habits for consistent saving. The idea is to move money to savings before you have the chance to spend it.\n\nMost banks allow you to schedule recurring transfers to a separate account. Even a small automatic amount, consistently applied, builds meaningfully over time.`,
      disclaimer: true,
    };
  }

  if (match(input, "attention", "behind", "struggling", "which goal")) {
    return {
      text: `To identify which goal needs the most attention, look for:\n\n• **Red progress bars** — the goal is significantly behind\n• **Goals with far-off target dates** but low current savings\n• **Goals with low monthly contributions** relative to the remaining amount\n\nFocusing extra contributions on the goal furthest from its target date (or the one with the nearest deadline) can help you stay on schedule.`,
      disclaimer: true,
    };
  }

  if (match(input, "hello", "hi", "hey", "help")) {
    return {
      text: `Hi! I'm your Savings Coach. I can help you understand your goals, explain how to calculate timelines, and discuss savings strategies.\n\nYou have **${goalsCount} active goals** and you're currently saving at a **${rateP}% rate** (${fmt(saved)}/month).`,
    };
  }

  return {
    text: `I can help with your savings goals. You have ${goalsCount} active goals and a current savings rate of ${rateP}%. Try asking about your emergency fund, how to calculate timelines, or why automatic transfers help.`,
    disclaimer: true,
  };
}

// ── Profile / Settings responses ──────────────────────────────────────────────

function profileResponse(input: string, _data: ContextData): Message {
  if (match(input, "email", "change email", "update email")) {
    return {
      text: `To update your email address:\n\n1. Scroll to the **Profile** section on this page\n2. Click **Edit** next to your name\n3. Update your email and save\n\nNote: Your new email will be used for login.`,
    };
  }

  if (match(input, "password", "change password", "reset password")) {
    return {
      text: `To change your password, use the **Change Password** section on this page. You'll need to enter your current password, then your new password twice to confirm.\n\nIf you've forgotten your current password, use the **Forgot Password** link on the login page.`,
    };
  }

  if (match(input, "bank", "connect", "account", "link")) {
    return {
      text: `To connect a bank account:\n\n1. Scroll to **Connected Accounts** on this page\n2. Click **Connect Another Account**\n3. Select your bank and follow the prompts\n\nYou can connect multiple accounts (checking and savings). You can also disconnect an account at any time from this page.`,
    };
  }

  if (match(input, "data", "store", "privacy", "what data")) {
    return {
      text: `SmartBudget stores:\n\n• Your **name and email** (for your account)\n• **Transactions** you import or add manually\n• **Budget settings and savings goals** you create\n\nWe do **not** store your banking credentials. Account connections use read-only bank feeds.\n\nAll data is stored locally in your browser in this prototype version.`,
    };
  }

  if (match(input, "delete", "close account", "remove")) {
    return {
      text: `To delete your account, contact your administrator or support team. In this prototype, clearing your browser's local storage will remove all your data.\n\n**Note:** Deleted data cannot be recovered.`,
    };
  }

  if (match(input, "hello", "hi", "hey", "help")) {
    return {
      text: `Hi! I'm your Profile Assistant. I can help you update your account details, manage connected accounts, and answer questions about your data.\n\nWhat would you like help with?`,
    };
  }

  return {
    text: `I can help with your account settings. Try asking about updating your email, changing your password, connecting a bank account, or what data SmartBudget stores.`,
  };
}

// ── Admin: User Management responses ─────────────────────────────────────────

function adminUsersResponse(input: string, data: ContextData): Message {
  const { totalUsers = 0, activeUsers = 0, suspendedUsers = 0 } = data;

  if (match(input, "suspend", "block", "disable")) {
    return {
      text: `To suspend a user:\n\n1. Find the user in the table\n2. Click the **orange suspend button** (⊘ icon) on their row\n3. Confirm in the dialog\n\nSuspended users cannot log in immediately. You can reactivate them at any time using the **green activate button**.`,
    };
  }

  if (match(input, "reset", "password")) {
    return {
      text: `To reset a user's password:\n\n1. Find the user in the table\n2. Click the **lock icon** (🔒) on their row\n3. Enter and confirm the new password (minimum 6 characters)\n4. Save\n\nThe user will need to use the new password on their next login. You can also tell them to use the Forgot Password flow on the login page.`,
    };
  }

  if (match(input, "role", "promote", "admin", "assign")) {
    return {
      text: `To change a user's role:\n\n1. Click the **edit (pencil) icon** on any user row\n2. Change the **Role** dropdown to the desired role\n3. Save\n\nAvailable roles: **User**, **Support**, **Admin**, and **Super Admin** (Super Admin only).\n\nNote: You can only assign roles up to (not exceeding) your own role level.`,
    };
  }

  if (match(input, "create", "add", "new user")) {
    return {
      text: `To create a new user:\n\n1. Click the **Create User** button in the top-right\n2. Fill in: Name, Email, Password (min. 6 chars), Role, and Status\n3. Click **Create User**\n\nThe user will appear in the table immediately and can log in with the credentials you provide. Ask them to change their password on first login.`,
    };
  }

  if (match(input, "delete", "remove")) {
    return {
      text: `To delete a user:\n\n1. Click the **red delete button** (🗑 icon) on the user's row\n2. Confirm in the dialog — this action is permanent\n\n**Note:** You cannot delete your own account or the built-in Super Admin / Admin accounts.\n\nConsider **suspending** instead of deleting if you may need to restore access later.`,
    };
  }

  if (match(input, "hello", "hi", "hey", "help", "overview", "summary")) {
    return {
      text: `Hi! I'm the User Management Assistant. The platform currently has **${totalUsers} registered accounts** — **${activeUsers} active** and **${suspendedUsers} suspended**.\n\nI can help you with suspending users, resetting passwords, assigning roles, or creating new accounts.`,
    };
  }

  return {
    text: `I can help with user management. You have ${totalUsers} total accounts (${activeUsers} active, ${suspendedUsers} suspended). Try asking about suspending users, resetting passwords, or assigning roles.`,
  };
}

// ── Admin: Security responses ─────────────────────────────────────────────────

function adminSecurityResponse(input: string, data: ContextData): Message {
  const { openAlerts = 0 } = data;

  if (match(input, "brute force", "brute-force", "multiple attempt", "repeated login")) {
    return {
      text: `A **brute-force alert** fires when the system detects many failed login attempts against a single account in a short window.\n\nThe platform automatically blocks the offending IP after the configured threshold (default: 5 attempts). You can see blocked IPs on the **Failed Logins** tab and manually review them.\n\n**Action:** If your admin account was targeted, verify no successful logins occurred from that IP.`,
    };
  }

  if (match(input, "block", "blocked ip", "unblock")) {
    return {
      text: `IPs are **automatically blocked** when they exceed the failed login threshold. Blocked IPs appear with a red "Blocked" badge on the Failed Logins tab.\n\nIf a legitimate user was blocked (e.g., they forgot their password and tried many times), you can reset their password and ask them to try from a different network, which will have a clean IP record.`,
    };
  }

  if (match(input, "resolve", "dismiss", "close alert", "fix alert")) {
    return {
      text: `To resolve a security alert:\n\n1. Switch to the **Security Alerts** tab\n2. Review the alert details\n3. Click **Resolve** on the alert row\n\nResolving marks the alert as handled. Consider investigating the underlying cause before resolving — for critical alerts, document what you found.`,
    };
  }

  if (match(input, "credential stuffing", "stuffing")) {
    return {
      text: `**Credential stuffing** is when attackers use lists of email/password pairs (often from other data breaches) to try to access accounts on your platform.\n\nSigns: many different emails attempted from one IP in a short period, mostly "no account found" failures.\n\n**Mitigations:** Rate limiting (already active), account lockouts (active), and encouraging users to use unique passwords (via the Education Hub).`,
    };
  }

  if (match(input, "suspicious login", "suspicious", "unusual login")) {
    return {
      text: `Logins that may warrant review:\n\n• **Login from a new country or unusual IP range**\n• **Login at an unusual time** (e.g., 3 AM)\n• **Multiple failed attempts before a successful login**\n• **Login immediately after a password reset**\n\nThe Recent Logins tab shows device, IP, and timestamp for all successful logins.`,
    };
  }

  if (match(input, "hello", "hi", "hey", "help", "overview")) {
    return {
      text: `Hi! I'm the Security Assistant. There are currently **${openAlerts} open alert${openAlerts !== 1 ? "s" : ""}** requiring attention.\n\nI can help you understand security alerts, explain how IP blocking works, or guide you through resolving specific threats.`,
    };
  }

  return {
    text: `I can help with platform security. There are ${openAlerts} open alerts. Try asking about brute-force attempts, how IP blocking works, or how to resolve alerts.`,
  };
}

// ── Admin: Audit Log responses ────────────────────────────────────────────────

function adminAuditResponse(input: string, data: ContextData): Message {
  const { auditCount = 20 } = data;

  if (match(input, "filter", "search", "find")) {
    return {
      text: `You can filter the audit log by:\n\n• **Search** — type a user email, action name, or IP address\n• **Category** — Auth, User, Content, Settings, AI, Data\n• **Severity** — Info, Warning, Critical\n\nAll filters combine — you can search by email AND filter by category at the same time. The count updates live.`,
    };
  }

  if (match(input, "what event", "captured", "logged", "what is recorded")) {
    return {
      text: `The audit log captures:\n\n• **Auth events** — logins, logouts, failed attempts, IP blocks\n• **User management** — creates, edits, suspensions, deletions, role changes\n• **Content** — drafts, publishes\n• **Settings** — configuration changes\n• **AI** — flagged interactions, boundary events\n• **Data** — backups, exports\n\nSystem-generated events show "system" as the actor.`,
    };
  }

  if (match(input, "export", "download", "csv")) {
    return {
      text: `To export the audit log:\n\n1. Apply any filters you want (the export includes only filtered results)\n2. Click **Export CSV** in the top-right\n3. A CSV file will download to your computer\n\nThe export includes: ID, Timestamp, Actor, Role, Action, Target, IP, Category, and Severity.`,
    };
  }

  if (match(input, "critical", "severity", "warning", "info")) {
    return {
      text: `**Severity levels:**\n\n• 🔴 **Critical** — Immediate action likely required (e.g., brute-force, jailbreak attempt, IP block)\n• 🟠 **Warning** — Notable event worth reviewing (e.g., suspended user attempted login, settings changed)\n• 🔵 **Info** — Normal platform activity (logins, content published, backups)\n\nRows with Critical severity are highlighted red in the table.`,
    };
  }

  if (match(input, "far back", "history", "retention", "how long")) {
    return {
      text: `In this prototype, the audit log displays the most recent **${auditCount} events**. In a production deployment, log retention is typically configured to 90 days, 1 year, or longer depending on compliance requirements.\n\nFor compliance-sensitive platforms (financial, healthcare), many jurisdictions require at least 12 months of audit log retention.`,
    };
  }

  if (match(input, "hello", "hi", "hey", "help", "overview")) {
    return {
      text: `Hi! I'm the Audit Log Assistant. The log currently shows **${auditCount} recorded events**.\n\nI can help you filter logs, understand what's captured, export data, or explain severity levels.`,
    };
  }

  return {
    text: `I can help with the audit log. There are ${auditCount} events recorded. Try asking how to filter, what events are logged, how to export, or what severity levels mean.`,
  };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export function generateResponse(
  context: AssistantContext,
  input: string,
  data: ContextData = {}
): Message {
  switch (context) {
    case "dashboard":     return dashboardResponse(input, data);
    case "transactions":  return transactionsResponse(input, data);
    case "budget":        return budgetResponse(input, data);
    case "savings":       return savingsResponse(input, data);
    case "profile":       return profileResponse(input, data);
    case "admin-users":   return adminUsersResponse(input, data);
    case "admin-security":return adminSecurityResponse(input, data);
    case "admin-audit":   return adminAuditResponse(input, data);
    default:              return { text: "I'm not sure how to help with that yet. Try rephrasing your question.", disclaimer: false };
  }
}
