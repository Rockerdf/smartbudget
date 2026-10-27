// Education Hub content: lessons, videos, books and free help.
// Every video below was checked on YouTube (title, channel and that embedding
// is allowed) and every book against Open Library on 26 October 2026.

export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export type Lesson = {
  id: number;
  title: string;
  category: string;
  duration: string;
  difficulty: Difficulty;
  desc: string;
  content: string;
  /** YouTube video id shown with the lesson. */
  videoId?: string;
};

export const CATEGORIES = [
  { id: "all",       label: "All Topics",           icon: "📚" },
  { id: "budgeting", label: "Budgeting Basics",     icon: "📊" },
  { id: "saving",    label: "Saving Money",         icon: "💰" },
  { id: "debt",      label: "Managing Debt",        icon: "📉" },
  { id: "wellbeing", label: "Financial Wellbeing",  icon: "🌱" },
  { id: "credit",    label: "Understanding Credit", icon: "💳" },
];

export const LESSONS: Lesson[] = [
  {
    id: 1, videoId: "vftjBTjFlzI", category: "saving", difficulty: "Beginner", duration: "5 min",
    title: "Why an Emergency Fund is Your Most Important First Step",
    desc: "Before investing, before paying down debt aggressively — most financial educators recommend having a cash buffer first. Here's why.",
    content: `An emergency fund is a dedicated pool of cash you can access quickly without selling anything or taking on debt. The typical guidance is three to six months of essential living costs.\n\nThe purpose is simple: life surprises you. A car repair, a job loss, an unexpected medical bill — without a cash buffer, these events force you to use a credit card or personal loan, which starts a cycle that's hard to break.\n\nHow much you need depends on your situation:\n• If you have a stable job with good leave entitlements, three months is a reasonable starting point.\n• If you're self-employed, freelance, or in a volatile industry, six months is more appropriate.\n\nWhere to keep it: a high-interest savings account that's separate from your everyday account. The separation is deliberate — it adds a small friction that prevents you dipping in for non-emergencies.\n\nContributing even a small fixed amount each month builds it steadily. $50 a week becomes $2,600 in a year.`,
  },
  {
    id: 2, videoId: "HQzoZfc3GwQ", category: "budgeting", difficulty: "Beginner", duration: "5 min",
    title: "The 50/30/20 Framework",
    desc: "A simple structure for dividing your take-home pay across needs, wants, and savings.",
    content: `The 50/30/20 framework divides your after-tax income into three buckets:\n\n• 50% Needs — rent, groceries, utilities, insurance, minimum debt repayments\n• 30% Wants — dining out, subscriptions, holidays, hobbies\n• 20% Savings & extra debt repayment\n\nIt's a starting point, not a law. In cities with high rents, housing alone might take 40%+ of income, leaving less for the other buckets. In that case, trimming wants before savings is usually the right call.\n\nThe value of this framework is that it gives every dollar a category before you spend it, which helps you notice when a category is creeping too high. Most people who track spending for the first time discover their "wants" category is significantly larger than they expected.`,
  },
  {
    id: 3, videoId: "Ryn49zHaYcM", category: "budgeting", difficulty: "Intermediate", duration: "8 min",
    title: "Zero-Based Budgeting: Every Dollar Gets a Job",
    desc: "A stricter method where income minus all assigned expenses equals zero — leaving nothing unaccounted for.",
    content: `Zero-based budgeting means you plan where every dollar goes before the month begins. Income minus all planned expenses (including savings) equals zero. That doesn't mean you spend everything — savings and investment contributions are line items.\n\nThe discipline it creates: because every dollar is assigned, discretionary spending requires a conscious reallocation. Want to go out for dinner twice this week? You need to move money from another category.\n\nIt works especially well for people who have tried simpler budgets but still feel like money "disappears" without knowing where it went. The act of assigning each dollar creates awareness.`,
  },
  {
    id: 4, videoId: "XImly72tLw0", category: "saving", difficulty: "Beginner", duration: "4 min",
    title: "Automating Your Savings",
    desc: "How to make saving the default rather than the exception — and why it works.",
    content: `The most consistent savers typically don't rely on willpower. They automate.\n\nAutomation means setting up an automatic transfer from your everyday account to a savings account on the day after payday — before you have a chance to spend it. Because you never see the money in your spending account, you adapt to living on what's left.\n\nStart small if needed: even $25 a week is $1,300 a year. You can increase the amount over time as your income grows or your expenses reduce.\n\nThe psychological effect of automation is significant: it removes the weekly decision "should I save this week?" and replaces it with a standing instruction. Decision fatigue around saving disappears.`,
  },
  {
    id: 5, videoId: "8jYX2Lbum8o", category: "debt", difficulty: "Intermediate", duration: "7 min",
    title: "Debt Avalanche vs Debt Snowball",
    desc: "Two strategies for paying off multiple debts. One minimises interest paid, the other maximises momentum.",
    content: `If you have multiple debts, two frameworks are commonly discussed:\n\nDebt Avalanche:\nPay minimum repayments on all debts, then direct any extra money to the highest-interest debt first. Once that's paid, roll the payment to the next highest. This approach minimises the total interest you pay over time.\n\nDebt Snowball:\nPay minimum repayments on all debts, then direct extra money to the smallest balance first regardless of interest rate. When that's paid off, roll the payment to the next smallest. The quick wins on small debts build momentum and motivation.\n\nWhich is better? Mathematically, the avalanche wins. Behaviourally, research suggests many people stick to the snowball longer because of the motivational benefit of closing out accounts.\n\nThe best strategy is the one you'll actually follow through on. Neither is universally right.`,
  },
  {
    id: 6, videoId: "Rm6UdfRs3gw", category: "debt", difficulty: "Beginner", duration: "5 min",
    title: "Understanding Interest Rates on Personal Loans",
    desc: "What APR and comparison rates mean, and how interest accumulates.",
    content: `When you borrow money, lenders charge interest — a percentage of the outstanding balance per year. Understanding how this works helps you make more informed comparisons.\n\nKey terms:\n• Interest rate (or nominal rate) — the annual rate charged on the loan balance\n• Comparison rate — includes most fees and charges in a single percentage, making loans easier to compare\n\nHow compound interest works against borrowers:\nIf you owe $10,000 at 18% per year and only pay the minimum, the interest accrues on top of interest. That $10,000 can take years and thousands of dollars in interest to fully repay.\n\nGeneral principle: high-interest debt (credit cards, payday loans) is typically the most expensive and has the most impact on your net financial position. Lower-interest debt (mortgages, student loans) is less urgent to eliminate quickly.`,
  },
  {
    id: 7, videoId: "-S91Pe-BjL8", category: "credit", difficulty: "Beginner", duration: "8 min",
    title: "How Credit Scores Work",
    desc: "The five factors behind your score and how each one is influenced by your behaviour.",
    content: `A credit score summarises your borrowing history into a number lenders use to assess risk. Different countries use different scoring systems, but the underlying factors are similar:\n\n1. Payment history (~35% of score in many models)\nPaying bills on time is the biggest factor. A single missed payment can have a significant effect.\n\n2. Credit utilisation (~30%)\nThe proportion of your available credit you're using. Using more than 30% of your limit can lower your score; less is generally better.\n\n3. Length of credit history (~15%)\nOlder accounts help. Closing old accounts can shorten your average credit age.\n\n4. Credit mix (~10%)\nA variety of credit types (credit cards, personal loans, mortgage) can help, but you shouldn't take on debt purely to diversify.\n\n5. New credit enquiries (~10%)\nApplying for credit generates a "hard enquiry" that temporarily lowers your score slightly.`,
  },
  {
    id: 8, videoId: "8BwtAdt6qPE", category: "wellbeing", difficulty: "Beginner", duration: "6 min",
    title: "Financial Stress and How to Manage It",
    desc: "Money is a leading source of stress. Practical approaches that help regardless of your income.",
    content: `Financial stress is widely reported as one of the most common sources of anxiety. It can affect sleep, relationships, and decision-making. Importantly, it affects people at all income levels — it's rarely just about how much you earn.\n\nCommon patterns that make it worse:\n• Avoiding looking at bank statements or opening bills\n• Making impulsive purchases as a way to feel in control temporarily\n• Not having a plan, so every financial surprise feels catastrophic\n\nApproaches that tend to help:\n• Knowing your numbers — anxiety often reduces when you face what's actually there rather than imagining it\n• Breaking the problem into small actions — one thing this week, not an overhaul\n• Having a buffer — even a small emergency fund changes how unpredictable expenses feel\n• Talking about it — financial difficulty is very common, and there are free financial counselling services available in most countries`,
  },
  {
    id: 9, videoId: "vhaA2rAoBLU", category: "credit", difficulty: "Beginner", duration: "7 min",
    title: "Your First Credit Card: A Practical Guide",
    desc: "How to use a credit card without it costing you money — what to do and what to avoid.",
    content: `A credit card can be a useful tool or an expensive one — the difference is almost entirely in how it's used.\n\nThe fundamental rule: pay your full balance every month. If you do this, you pay zero interest, and if your card has rewards, you effectively get paid to use it.\n\nIf you carry a balance:\nMost credit cards charge 15–22% per year on unpaid balances. A $500 balance carried for a year costs $75–$110 in interest. The interest accumulates quickly if you only make minimum payments.\n\nThings to look for in a first card:\n• No annual fee (until you're confident you'll use the benefits enough to justify it)\n• A credit limit you can comfortably pay off each month\n• A clear repayment mechanism (auto-pay for the full balance is the safest default)\n\nCredit cards are not extra income — the money is borrowed. Treating purchases differently because you're "not spending cash" is one of the most common ways people get into credit card debt.`,
  },
  {
    id: 10, videoId: "wkpFiOh88qQ", category: "saving", difficulty: "Beginner", duration: "5 min",
    title: "Setting Financial Goals That Stick",
    desc: "Why vague goals rarely work and how to structure goals with specificity and timelines.",
    content: `"I want to save more money" is not a goal — it's a wish. Goals that actually influence behaviour tend to be specific, time-bound, and written down.\n\nA better version: "I will save $3,000 by March 2027 by transferring $250 per fortnight to a separate savings account."\n\nThis works because:\n• The amount is specific ($3,000)\n• The timeline is concrete (March 2027)\n• The mechanism is defined ($250 per fortnight, automatic)\n\nAnother pattern that helps: name your savings accounts after the goal. "Emergency Fund", "Bali Trip 2027", "Car Replacement". Seeing the label when you check your balance makes the goal feel real rather than abstract.\n\nFinally, review your goals at least quarterly. Life changes — income goes up or down, priorities shift. An annual check isn't enough. A quarterly 15-minute review keeps goals relevant.`,
  },
  {
    id: 11, videoId: "L_75pPcrzBk", category: "wellbeing", difficulty: "Beginner", duration: "5 min",
    title: "Superannuation Basics (Australia)",
    desc: "What super is, how money gets into it, and why it's worth checking your account early in your career.",
    content: `Superannuation ("super") is money set aside while you work so you have income in retirement. In Australia, most employers must pay a percentage of your ordinary earnings into your super fund — this is called the Super Guarantee. From 1 July 2025 the rate is 12%.\n\nThree things worth knowing early:\n\n• Check you're being paid — your payslip should show super contributions. You can see your accounts in myGov (linked to the ATO).\n• Avoid multiple accounts — each account usually charges fees and may include insurance premiums. Many people consolidate into one fund.\n• Fees and investment options matter — small differences in fees compound over decades. Moneysmart's tools let you compare funds.\n\nYou generally can't access super until you reach your preservation age (60 for anyone born after 30 June 1964) and retire, except in limited circumstances.\n\nSuper rules change from time to time, so check the latest details at moneysmart.gov.au or ato.gov.au.`,
  },
];

export type Video = { id: string; title: string; channel: string; length: string; category: string; blurb: string };

export const VIDEOS: Video[] = [
  { id: "LmoWqCb8Hog", title: "How to Start a Budget in 5 Easy Steps", channel: "Moneysmart (ASIC)", length: "1:25", category: "budgeting", blurb: "The Australian Government's quick guide to setting up your first budget." },
  { id: "HQzoZfc3GwQ", title: "How To Manage Your Money (50/30/20 Rule)", channel: "WhiteBoard Finance", length: "7:08", category: "budgeting", blurb: "A clear whiteboard walkthrough of splitting income into needs, wants and savings." },
  { id: "Ryn49zHaYcM", title: "What Is a Zero-Based Budget?", channel: "EveryDollar", length: "2:50", category: "budgeting", blurb: "Giving every dollar a job, explained in under three minutes." },
  { id: "vftjBTjFlzI", title: "Why You NEED an Emergency Fund!", channel: "Two Cents (PBS)", length: "7:05", category: "saving", blurb: "Why a cash buffer matters and how much to aim for." },
  { id: "XImly72tLw0", title: "How I Automate My Finances", channel: "Thomas Frank", length: "11:39", category: "saving", blurb: "Setting up automatic transfers so saving happens by default." },
  { id: "wkpFiOh88qQ", title: "What are SMART goals and why do they matter?", channel: "Khan Academy", length: "4:04", category: "saving", blurb: "Turning vague money wishes into specific, time-bound goals." },
  { id: "8jYX2Lbum8o", title: "How to Pay Off Debt: Avalanche vs. Snowball", channel: "Humphrey Yang", length: "5:18", category: "debt", blurb: "Side-by-side comparison of the two most common payoff strategies." },
  { id: "PvEUj_mRfIo", title: "Tips For Getting Out of Debt", channel: "Two Cents (PBS)", length: "5:23", category: "debt", blurb: "Practical first steps when debt feels overwhelming." },
  { id: "Rm6UdfRs3gw", title: "Compound Interest Introduction", channel: "Khan Academy", length: "6:38", category: "debt", blurb: "How interest builds on interest — for savings and for loans." },
  { id: "GHHesANT6OM", title: "Interest Rates Explained", channel: "Wall Street Survivor", length: "2:17", category: "debt", blurb: "A short, animated explainer of what interest rates are." },
  { id: "-S91Pe-BjL8", title: "Credit Score Explained", channel: "Wall Street Survivor", length: "2:34", category: "credit", blurb: "The factors that make up a credit score, in plain language." },
  { id: "c0TQlgoUHRE", title: "What your credit score actually means", channel: "Vox", length: "12:38", category: "credit", blurb: "A deeper look at how credit scoring works and why it exists (US-focused)." },
  { id: "vhaA2rAoBLU", title: "How Does a Credit Card Work?", channel: "Motley Fool Money", length: "5:45", category: "credit", blurb: "Billing cycles, interest-free periods and how to avoid interest." },
  { id: "8BwtAdt6qPE", title: "Is Financial Anxiety Holding You Back?", channel: "LearnFree (GCFGlobal)", length: "2:35", category: "wellbeing", blurb: "Recognising money stress and simple ways to manage it." },
  { id: "L_75pPcrzBk", title: "What Is Superannuation and How Does It Work?", channel: "Moneysmart (ASIC)", length: "2:09", category: "wellbeing", blurb: "Australia's retirement savings system in two minutes." },
];

export type Book = { title: string; author: string; olKey: string; coverId: number; blurb: string; tag: string };

export const BOOKS: Book[] = [
  { title: "The Barefoot Investor", author: "Scott Pape", olKey: "/works/OL8869349W", coverId: 884884, tag: "Australian", blurb: "A plain-speaking Australian guide to budgeting with 'buckets', clearing debt and building a safety net." },
  { title: "The Psychology of Money", author: "Morgan Housel", olKey: "/works/OL21640039W", coverId: 10389354, tag: "Mindset", blurb: "Short stories about how behaviour, not maths, drives most money decisions." },
  { title: "I Will Teach You to Be Rich", author: "Ramit Sethi", olKey: "/works/OL8982032W", coverId: 6305971, tag: "Systems", blurb: "A step-by-step programme for automating your accounts and spending guilt-free on what you love." },
  { title: "Your Money or Your Life", author: "Vicki Robin & Joe Dominguez", olKey: "/works/OL4275330W", coverId: 6975229, tag: "Values", blurb: "Connects spending to the hours of life it costs, to help you spend on what matters." },
  { title: "Broke Millennial", author: "Erin Lowry", olKey: "/works/OL20056163W", coverId: 14626166, tag: "Beginners", blurb: "A friendly first book on budgeting, credit and debt for people starting out." },
  { title: "Get Good with Money", author: "Tiffany Aliche", olKey: "/works/OL24411890W", coverId: 10955890, tag: "Beginners", blurb: "Ten practical steps towards being 'financially whole', from budgeting to insurance." },
  { title: "The Simple Path to Wealth", author: "J. L. Collins", olKey: "/works/OL19747351W", coverId: 10448941, tag: "Investing basics", blurb: "Low-cost, long-term investing ideas explained simply (written for a US audience)." },
  { title: "The Richest Man in Babylon", author: "George S. Clason", olKey: "/works/OL8165007W", coverId: 10491331, tag: "Classic", blurb: "1920s parables with timeless lessons: pay yourself first and live below your means." },
];

export type Resource = { name: string; url: string; desc: string; phone?: string };

export const RESOURCES: Resource[] = [
  { name: "Moneysmart", url: "https://moneysmart.gov.au/budgeting", desc: "Free, independent guidance and calculators from the Australian Government (ASIC)." },
  { name: "National Debt Helpline", url: "https://ndh.org.au", phone: "1800 007 007", desc: "Free, confidential financial counselling if you're struggling with bills or debt." },
  { name: "Khan Academy – Financial Literacy", url: "https://www.khanacademy.org/college-careers-more/financial-literacy", desc: "A free online course covering budgeting, saving, credit and more." },
  { name: "Scamwatch", url: "https://www.scamwatch.gov.au", desc: "Learn to spot scams and report them (run by the ACCC)." },
];
