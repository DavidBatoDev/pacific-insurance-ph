// Pacific Insurance PH — Mock data (realistic PH operations data)

const peso = (n) => "₱" + n.toLocaleString("en-PH");
const pesoShort = (n) => {
  if (n >= 1000000) return "₱" + (n / 1000000).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1000) return "₱" + (n / 1000).toFixed(0) + "K";
  return "₱" + n;
};

// avatar color from name
const AV_COLORS = ["#0ea5a3","#6366f1","#db7c2e","#0d9488","#7c3aed","#e0567a","#2563eb","#059669","#d97706","#0891b2","#9333ea","#dc2626"];
const initials = (name) => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
const avColor = (name) => AV_COLORS[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];

const STAFF = {
  matt: { name: "Matt Nassr", role: "Agency Owner", initials: "MN" },
  eman: { name: "Eman Reyes", role: "Operations Manager", initials: "ER" },
  joy: { name: "Joy Mercado", role: "Account Associate", initials: "JM" },
  paolo: { name: "Paolo Aquino", role: "Claims Specialist", initials: "PA" },
  bea: { name: "Bea Lim", role: "Travel Desk", initials: "BL" },
};

const ALERTS = [
  { id: "renewals", color: "amber", icon: "refresh", num: 8, label: "Renewals due within 30 days", screen: "renewals" },
  { id: "claims", color: "red", icon: "fileMissing", num: 3, label: "Claims awaiting documents", screen: "claims" },
  { id: "travel", color: "blue", icon: "wallet", num: 5, label: "Travel requests awaiting payment", screen: "travel" },
  { id: "apps", color: "violet", icon: "alertTri", num: 2, label: "Applications missing requirements", screen: "applications" },
];

const KPIS = [
  { id: "clients", icon: "users", value: "1,248", label: "Active Clients", delta: "+4.2%", dir: "up", spark: [38,40,39,42,44,43,47,46,49,52,51,55], screen: "clients" },
  { id: "policies", icon: "shield", value: "2,394", label: "Active Policies", delta: "+2.8%", dir: "up", spark: [60,62,61,64,63,66,68,67,70,72,74,76], screen: "policies" },
  { id: "apps", icon: "fileText", value: "41", label: "Applications In Progress", delta: "+9", dir: "up", spark: [22,28,25,30,34,32,38,36,40,37,39,41], screen: "applications" },
  { id: "claims", icon: "clipboard", value: "18", label: "Open Claims", delta: "-3", dir: "down", spark: [26,24,25,23,22,21,22,20,19,21,19,18], screen: "claims" },
  { id: "renewals", icon: "refresh", value: "72", label: "Upcoming Renewals", delta: "+12", dir: "up", spark: [40,44,48,52,50,55,58,62,60,66,70,72], screen: "renewals" },
  { id: "travel", icon: "plane", value: "15", label: "Open Travel Requests", delta: "0", dir: "flat", spark: [12,14,13,15,16,14,15,13,14,16,15,15], screen: "travel" },
];

const REVENUE = {
  total: 2188000,
  rows: [
    { label: "Applications awaiting payment", value: 1250000, color: "#059669", icon: "fileText", count: 14 },
    { label: "Renewals awaiting payment", value: 860000, color: "#2563eb", icon: "refresh", count: 23 },
    { label: "Travel insurance awaiting payment", value: 78000, color: "#d97706", icon: "plane", count: 5 },
  ],
};

const PRODUCTS = ["Blue Royale", "Select", "Maxicare Plus", "AsianLife Care", "Premier Health", "Global Travel", "Smart Traveler", "Family Shield"];

const APPLICATIONS = [
  { id: "APP-2026-000123", client: "John Santos", city: "Makati City", product: "Blue Royale", status: "Awaiting Payment", staff: "joy", due: 0, amount: 185000 },
  { id: "APP-2026-000124", client: "Maria Cruz", city: "Quezon City", product: "Select", status: "Missing Documents", staff: "eman", due: -2, amount: 92000 },
  { id: "APP-2026-000125", client: "Renato Dizon", city: "Pasig City", product: "Premier Health", status: "Under Review", staff: "joy", due: 3, amount: 240000 },
  { id: "APP-2026-000126", client: "Liza Gomez", city: "Cebu City", product: "Maxicare Plus", status: "Awaiting Payment", staff: "eman", due: 1, amount: 156000 },
  { id: "APP-2026-000127", client: "Andres Bonifacio", city: "Taguig City", product: "Family Shield", status: "Missing Documents", staff: "joy", due: -1, amount: 198000 },
  { id: "APP-2026-000128", client: "Carmela Tan", city: "Mandaluyong", product: "AsianLife Care", status: "Under Review", staff: "eman", due: 5, amount: 134000 },
  { id: "APP-2026-000129", client: "Diego Mercado", city: "Davao City", product: "Blue Royale", status: "Approved", staff: "joy", due: 2, amount: 210000 },
  { id: "APP-2026-000130", client: "Patricia Lim", city: "Alabang", product: "Select", status: "Awaiting Payment", staff: "eman", due: 4, amount: 88000 },
];

const RENEWALS = [
  { id: "POL-2021-04412", client: "Ramon Velasco", city: "Makati City", policy: "Blue Royale — Individual", date: "Jun 14, 2026", due: 4, status: "Awaiting Payment", amount: 62000 },
  { id: "POL-2020-09921", client: "Sofia Reyes", city: "Quezon City", policy: "Family Shield — Family", date: "Jun 18, 2026", due: 8, status: "Notice Sent", amount: 148000 },
  { id: "POL-2022-01183", client: "Miguel Torres", city: "Pasig City", policy: "Premier Health", date: "Jun 22, 2026", due: 12, status: "In Progress", amount: 95000 },
  { id: "POL-2019-07734", client: "Grace Castillo", city: "Cebu City", policy: "Maxicare Plus", date: "Jun 9, 2026", due: -1, status: "Overdue", amount: 73000 },
  { id: "POL-2021-08820", client: "Nestor Aguilar", city: "Taguig City", policy: "Select — Individual", date: "Jun 26, 2026", due: 16, status: "Notice Sent", amount: 54000 },
  { id: "POL-2020-03345", client: "Cristina Flores", city: "Iloilo City", policy: "AsianLife Care", date: "Jun 12, 2026", due: 2, status: "Awaiting Payment", amount: 110000 },
  { id: "POL-2022-05567", client: "Edgar Domingo", city: "Davao City", policy: "Family Shield — Family", date: "Jul 1, 2026", due: 21, status: "In Progress", amount: 132000 },
];

const CLAIMS = [
  { id: "CLM-2026-00781", client: "Teresa Mendoza", city: "Makati City", policy: "Maxicare Plus", status: "Additional Documents Required", updated: "2h ago", staff: "paolo", amount: 48000 },
  { id: "CLM-2026-00782", client: "Roberto Pascual", city: "Pasig City", policy: "Blue Royale", status: "Under Review", updated: "5h ago", staff: "paolo", amount: 120000 },
  { id: "CLM-2026-00783", client: "Angelica Reyes", city: "Quezon City", policy: "Premier Health", status: "Awaiting Response", updated: "1d ago", staff: "eman", amount: 67000 },
  { id: "CLM-2026-00784", client: "Fernando Lopez", city: "Cebu City", policy: "Family Shield", status: "Additional Documents Required", updated: "1d ago", staff: "paolo", amount: 95000 },
  { id: "CLM-2026-00785", client: "Isabel Navarro", city: "Taguig City", policy: "Select", status: "Approved", updated: "2d ago", staff: "paolo", amount: 32000 },
  { id: "CLM-2026-00786", client: "Marco Salvador", city: "Davao City", policy: "AsianLife Care", status: "Additional Documents Required", updated: "3h ago", staff: "eman", amount: 54000 },
];

const TRAVEL = [
  { id: "TRV-2026-000123", client: "Katrina Bautista", dest: "Japan", flag: "🇯🇵", status: "Awaiting Payment", next: "Send payment link", staff: "bea", date: "Jun 20 – Jun 28", amount: 18000 },
  { id: "TRV-2026-000124", client: "Jericho Ramos", dest: "South Korea", flag: "🇰🇷", status: "Awaiting Payment", next: "Send payment link", staff: "bea", date: "Jun 15 – Jun 22", amount: 14500 },
  { id: "TRV-2026-000125", client: "Hannah Villamor", dest: "Singapore", flag: "🇸🇬", status: "Policy Issued", next: "Deliver e-policy", staff: "bea", date: "Jun 12 – Jun 16", amount: 9800 },
  { id: "TRV-2026-000126", client: "Oliver Chua", dest: "United States", flag: "🇺🇸", status: "Awaiting Payment", next: "Send payment link", staff: "bea", date: "Jul 2 – Jul 18", amount: 31000 },
  { id: "TRV-2026-000127", client: "Bianca Soriano", dest: "Australia", flag: "🇦🇺", status: "Under Review", next: "Verify itinerary", staff: "eman", date: "Jun 25 – Jul 5", amount: 22000 },
  { id: "TRV-2026-000128", client: "Daniel Ocampo", dest: "Thailand", flag: "🇹🇭", status: "Awaiting Payment", next: "Send payment link", staff: "bea", date: "Jun 18 – Jun 24", amount: 8700 },
];

const TASKS = [
  { id: 1, group: "overdue", title: "Follow up payment — APP-2026-000124 (Maria Cruz)", tag: "Application", meta: "Due yesterday", done: false },
  { id: 2, group: "overdue", title: "Request missing TIN ID from Andres Bonifacio", tag: "Documents", meta: "Due 2 days ago", done: false },
  { id: 3, group: "today", title: "Call Ramon Velasco re: Blue Royale renewal", tag: "Renewal", meta: "Today, 2:00 PM", done: false },
  { id: 4, group: "today", title: "Send payment link to Katrina Bautista (Japan trip)", tag: "Travel", meta: "Today, 4:30 PM", done: false },
  { id: 5, group: "today", title: "Review claim CLM-2026-00786 documents", tag: "Claim", meta: "Today", done: true },
  { id: 6, group: "week", title: "Prepare renewal notices for July batch", tag: "Renewal", meta: "Thu, Jun 12", done: false },
  { id: 7, group: "week", title: "Birthday greeting + loyalty offer — John Santos", tag: "Relationship", meta: "Sun, Jun 15", done: false },
  { id: 8, group: "week", title: "Quarterly check-in call with Sofia Reyes", tag: "Relationship", meta: "Fri, Jun 13", done: false },
];

const ACTIVITY = [
  { id: 1, type: "policy", who: "Eman Reyes", text: "issued policy <b>POL-2026-01902</b> for Diego Mercado (Blue Royale)", time: "12 minutes ago" },
  { id: 2, type: "payment", who: "System", text: "verified <b>₱156,000</b> payment for APP-2026-000126 — Liza Gomez", time: "38 minutes ago" },
  { id: 3, type: "claim", who: "Roberto Pascual", text: "submitted claim <b>CLM-2026-00782</b> — Blue Royale hospitalization", time: "1 hour ago" },
  { id: 4, type: "travel", who: "Bea Lim", text: "delivered travel e-policy to Hannah Villamor — <b>Singapore</b>", time: "2 hours ago" },
  { id: 5, type: "doc", who: "Joy Mercado", text: "uploaded <b>medical questionnaire</b> for APP-2026-000125", time: "3 hours ago" },
  { id: 6, type: "renewal", who: "System", text: "sent renewal notice to Sofia Reyes — <b>Family Shield</b>", time: "4 hours ago" },
  { id: 7, type: "claim", who: "Paolo Aquino", text: "requested additional documents for <b>CLM-2026-00781</b>", time: "5 hours ago" },
  { id: 8, type: "client", who: "Eman Reyes", text: "added new client <b>Patricia Lim</b> from referral", time: "Yesterday, 4:12 PM" },
];

const RELATIONSHIPS = [
  { id: 1, type: "birthday", name: "John Santos", sub: "Client since 2019 · Blue Royale", when: "in 5 days", soon: true },
  { id: 2, type: "anniversary", name: "Maria Cruz", sub: "5-year client anniversary", when: "in 8 days", soon: false },
  { id: 3, type: "birthday", name: "Grace Castillo", sub: "Client since 2020 · Maxicare Plus", when: "in 2 days", soon: true },
  { id: 4, type: "loyalty", name: "Ramon Velasco", sub: "Loyalty reward due · Gold tier", when: "this week", soon: true },
  { id: 5, type: "anniversary", name: "Miguel Torres", sub: "3-year client anniversary", when: "in 11 days", soon: false },
  { id: 6, type: "loyalty", name: "Sofia Reyes", sub: "Referral bonus pending", when: "this week", soon: false },
];

const NOTIFICATIONS = [
  { id: 1, type: "payment", title: "Payment received — ₱156,000 from Liza Gomez (APP-2026-000126)", time: "38m ago", unread: true },
  { id: 2, type: "claim", title: "New claim submitted — CLM-2026-00782 by Roberto Pascual", time: "1h ago", unread: true },
  { id: 3, type: "renewal", title: "Renewal overdue — Grace Castillo (Maxicare Plus)", time: "3h ago", unread: true },
  { id: 4, type: "travel", title: "Travel request needs review — Bianca Soriano (Australia)", time: "5h ago", unread: false },
  { id: 5, type: "doc", title: "Documents uploaded for APP-2026-000125 — Renato Dizon", time: "Yesterday", unread: false },
];

// Clients table for the Clients screen
const CLIENTS = [
  { name: "John Santos", city: "Makati City", email: "john.santos@email.com", policies: 3, tier: "Gold", since: "2019", value: 410000, status: "Active" },
  { name: "Maria Cruz", city: "Quezon City", email: "maria.cruz@email.com", policies: 2, tier: "Silver", since: "2021", value: 186000, status: "Active" },
  { name: "Ramon Velasco", city: "Makati City", email: "r.velasco@email.com", policies: 4, tier: "Gold", since: "2018", value: 520000, status: "Active" },
  { name: "Sofia Reyes", city: "Quezon City", email: "sofia.reyes@email.com", policies: 3, tier: "Gold", since: "2020", value: 348000, status: "Active" },
  { name: "Miguel Torres", city: "Pasig City", email: "m.torres@email.com", policies: 1, tier: "Bronze", since: "2022", value: 95000, status: "Active" },
  { name: "Grace Castillo", city: "Cebu City", email: "grace.c@email.com", policies: 2, tier: "Silver", since: "2020", value: 168000, status: "At Risk" },
  { name: "Patricia Lim", city: "Alabang", email: "patricia.lim@email.com", policies: 1, tier: "Bronze", since: "2026", value: 88000, status: "New" },
  { name: "Edgar Domingo", city: "Davao City", email: "e.domingo@email.com", policies: 2, tier: "Silver", since: "2021", value: 214000, status: "Active" },
  { name: "Cristina Flores", city: "Iloilo City", email: "cristina.f@email.com", policies: 3, tier: "Gold", since: "2019", value: 376000, status: "Active" },
  { name: "Nestor Aguilar", city: "Taguig City", email: "n.aguilar@email.com", policies: 1, tier: "Bronze", since: "2023", value: 54000, status: "Active" },
];

window.PData = {
  peso, pesoShort, initials, avColor, STAFF,
  ALERTS, KPIS, REVENUE, PRODUCTS, APPLICATIONS, RENEWALS, CLAIMS, TRAVEL,
  TASKS, ACTIVITY, RELATIONSHIPS, NOTIFICATIONS, CLIENTS,
};
