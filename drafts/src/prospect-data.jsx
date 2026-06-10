// Pacific Insurance PH — Prospect Pipeline data
const PP_STAFF = { eman: "Eman Reyes", matt: "Matt Nassr", joy: "Joy Mercado", bea: "Bea Lim" };

// Product color coding
const PP_PRODUCTS = {
  "Blue Royale": "#059669",
  "Select": "#2563eb",
  "Travel Insurance": "#d97706",
  "BC Flexi": "#7c3aed",
  "FlexiShield": "#0891b2",
  "Premier Health": "#db2777",
  "Family Shield": "#0d9488",
};

const PP_KPIS = [
  { id: "active", icon: "users", value: "42", label: "Active Prospects", delta: "+6", dir: "up", spark: [28,30,29,33,35,34,37,38,40,39,41,42] },
  { id: "followups", icon: "phone", value: "8", label: "Follow-ups Due Today", delta: "3 overdue", dir: "flat", tone: "amber" },
  { id: "proposals", icon: "fileText", value: "12", label: "Proposals Pending", delta: "+2", dir: "up" },
  { id: "starts", icon: "clipboard", value: "9", label: "Application Starts", delta: "+4", dir: "up" },
  { id: "conv", icon: "award", value: "15", label: "Conversions This Month", delta: "+5", dir: "up" },
  { id: "rate", icon: "trendUp", value: "36%", label: "Conversion Rate", delta: "+3.1pt", dir: "up" },
];

// Full 11-stage pipeline overview
const PP_PIPELINE = [
  { name: "New Inquiry", count: 9, value: 1820000, health: "good" },
  { name: "Discovery", count: 6, value: 1340000, health: "good" },
  { name: "Information Gathering", count: 5, value: 1120000, health: "watch" },
  { name: "Brochure Sent", count: 4, value: 980000, health: "good" },
  { name: "Proposal Requested", count: 3, value: 720000, health: "watch" },
  { name: "Proposal Received", count: 3, value: 690000, health: "good" },
  { name: "Proposal Sent", count: 4, value: 1060000, health: "risk" },
  { name: "Product Selected", count: 3, value: 840000, health: "good" },
  { name: "Application Started", count: 5, value: 1280000, health: "good" },
  { name: "Converted", count: 15, value: 3950000, health: "good" },
  { name: "Lost", count: 4, value: 0, health: "risk" },
];

// Kanban — 7 working columns
const PP_COLUMNS = [
  { key: "New Inquiry", color: "#64748b" },
  { key: "Discovery", color: "#0891b2" },
  { key: "Brochure Sent", color: "#2563eb" },
  { key: "Proposal Sent", color: "#7c3aed" },
  { key: "Product Selected", color: "#d97706" },
  { key: "Application Started", color: "#059669" },
  { key: "Converted", color: "#047857" },
];

const PP_PROSPECTS = [
  // New Inquiry
  { id: 1, name: "John Santos", product: "Blue Royale", staff: "eman", stage: "New Inquiry", last: "Inquiry via website", follow: 1, prio: "high", value: 185000 },
  { id: 2, name: "Anna Cruz", product: "Select", staff: "joy", stage: "New Inquiry", last: "Referral from R. Velasco", follow: 0, prio: "med", value: 92000 },
  { id: 3, name: "Kevin Lao", product: "Travel Insurance", staff: "bea", stage: "New Inquiry", last: "FB Messenger inquiry", follow: 2, prio: "low", value: 18000 },
  // Discovery
  { id: 4, name: "Robert Lim", product: "Premier Health", staff: "eman", stage: "Discovery", last: "Discovery call done", follow: -1, prio: "high", value: 240000 },
  { id: 5, name: "Carla Mendez", product: "Blue Royale", staff: "joy", stage: "Discovery", last: "Needs assessment sent", follow: 1, prio: "med", value: 168000 },
  // Brochure Sent
  { id: 6, name: "Maria Cruz", product: "Blue Royale", staff: "eman", stage: "Brochure Sent", last: "Brochure opened 3x", follow: 0, prio: "high", value: 156000 },
  { id: 7, name: "Tonio Reyes", product: "Family Shield", staff: "joy", stage: "Brochure Sent", last: "Brochure sent", follow: 3, prio: "med", value: 132000 },
  { id: 8, name: "Liza Park", product: "Select", staff: "joy", stage: "Brochure Sent", last: "Reviewing options", follow: 2, prio: "low", value: 88000 },
  // Proposal Sent
  { id: 9, name: "Daniel Yu", product: "Premier Health", staff: "eman", stage: "Proposal Sent", last: "Proposal sent 5d ago", follow: -2, prio: "high", value: 265000 },
  { id: 10, name: "Grace Tan", product: "Blue Royale", staff: "matt", stage: "Proposal Sent", last: "Awaiting decision", follow: 1, prio: "high", value: 198000 },
  { id: 11, name: "Marco Cua", product: "Select", staff: "joy", stage: "Proposal Sent", last: "Negotiating premium", follow: 0, prio: "med", value: 110000 },
  // Product Selected
  { id: 12, name: "Patricia Lim", product: "Blue Royale", staff: "eman", stage: "Product Selected", last: "Chose Blue Royale", follow: 1, prio: "high", value: 185000 },
  { id: 13, name: "Allan Ong", product: "Family Shield", staff: "joy", stage: "Product Selected", last: "Confirmed coverage", follow: 2, prio: "med", value: 148000 },
  // Application Started
  { id: 14, name: "Bianca Sy", product: "Premier Health", staff: "eman", stage: "Application Started", last: "Filling application", follow: 0, prio: "high", value: 220000 },
  { id: 15, name: "Noel Dela Paz", product: "Blue Royale", staff: "matt", stage: "Application Started", last: "Submitting documents", follow: 1, prio: "med", value: 175000 },
  { id: 16, name: "Rina Flores", product: "Select", staff: "joy", stage: "Application Started", last: "Medical scheduled", follow: 3, prio: "low", value: 95000 },
  // Converted
  { id: 17, name: "Diego Mercado", product: "Blue Royale", staff: "eman", stage: "Converted", last: "App APP-2026-000129", follow: 99, prio: "low", value: 210000 },
  { id: 18, name: "Sofia Reyes", product: "Family Shield", staff: "matt", stage: "Converted", last: "Policy issued", follow: 99, prio: "low", value: 148000 },
];

const PP_PROPOSALS = [
  { name: "Maria Cruz", product: "Blue Royale", step: 2, status: "Awaiting Decision", days: "Sent 5 days ago", staff: "eman" },
  { name: "Daniel Yu", product: "Premier Health", step: 2, status: "Awaiting Decision", days: "Sent 5 days ago", staff: "eman" },
  { name: "Grace Tan", product: "Blue Royale", step: 2, status: "Awaiting Decision", days: "Sent 2 days ago", staff: "matt" },
  { name: "Robert Lim", product: "Premier Health", step: 1, status: "Proposal Received", days: "From carrier today", staff: "eman" },
  { name: "Carla Mendez", product: "Blue Royale", step: 0, status: "Proposal Requested", days: "Requested 1 day ago", staff: "joy" },
  { name: "Marco Cua", product: "Select", step: 2, status: "Negotiating", days: "Sent 8 days ago", staff: "joy" },
];

const PP_PRODUCT_INTEREST = [
  { name: "Blue Royale", pct: 46, color: "#059669" },
  { name: "Select", pct: 28, color: "#2563eb" },
  { name: "Travel Insurance", pct: 15, color: "#d97706" },
  { name: "BC Flexi", pct: 8, color: "#7c3aed" },
  { name: "FlexiShield", pct: 3, color: "#0891b2" },
];

const PP_FOLLOWUPS = [
  { action: "Call John Santos", sub: "New inquiry · discovery call", product: "Blue Royale", when: "Today, 10:00 AM", urg: "today", staff: "eman", icon: "phone" },
  { action: "Send brochure to Maria Cruz", sub: "Requested product details", product: "Blue Royale", when: "Today, 11:30 AM", urg: "today", staff: "eman", icon: "mail" },
  { action: "Follow up proposal with Daniel Yu", sub: "Awaiting decision · 5 days", product: "Premier Health", when: "Overdue 1 day", urg: "over", staff: "eman", icon: "fileText" },
  { action: "Send intake form to Anna Cruz", sub: "New referral prospect", product: "Select", when: "Today, 3:00 PM", urg: "today", staff: "joy", icon: "clipboard" },
  { action: "Follow up proposal with Robert Lim", sub: "Proposal received from carrier", product: "Premier Health", when: "Overdue 2 days", urg: "over", staff: "eman", icon: "fileText" },
  { action: "Check in with Grace Tan", sub: "Proposal sent · decision pending", product: "Blue Royale", when: "Tomorrow", urg: "soon", staff: "matt", icon: "phone" },
];

const PP_INTAKE = { sent: 28, completed: 19, awaiting: 9, recent: [
  { name: "Carla Mendez", when: "2h ago" },
  { name: "Tonio Reyes", when: "5h ago" },
  { name: "Liza Park", when: "Yesterday" },
] };

const PP_ACTIVITY = [
  { type: "convert", who: "Eman Reyes", text: "converted <b>Diego Mercado</b> to application APP-2026-000129", time: "22 minutes ago" },
  { type: "proposal_sent", who: "Matt Nassr", text: "sent proposal to <b>Grace Tan</b> — Blue Royale", time: "1 hour ago" },
  { type: "discovery", who: "Eman Reyes", text: "completed discovery call with <b>Robert Lim</b>", time: "2 hours ago" },
  { type: "brochure", who: "Joy Mercado", text: "sent brochure to <b>Tonio Reyes</b> — Family Shield", time: "3 hours ago" },
  { type: "proposal_req", who: "Joy Mercado", text: "requested proposal from carrier for <b>Carla Mendez</b>", time: "4 hours ago" },
  { type: "inquiry", who: "System", text: "new inquiry created — <b>Kevin Lao</b> (Travel Insurance)", time: "5 hours ago" },
  { type: "intake", who: "Carla Mendez", text: "completed <b>intake form</b>", time: "Yesterday, 4:40 PM" },
];

const PP_QUICK = [
  { label: "New Prospect", icon: "plus", primary: true },
  { label: "Send Intake Form", icon: "clipboard" },
  { label: "Send Brochure", icon: "mail" },
  { label: "Request Proposal", icon: "fileText" },
  { label: "Log Discovery Call", icon: "phone" },
  { label: "Convert to Application", icon: "arrowRight" },
];

window.PPData = { PP_STAFF, PP_PRODUCTS, PP_KPIS, PP_PIPELINE, PP_COLUMNS, PP_PROSPECTS, PP_PROPOSALS, PP_PRODUCT_INTEREST, PP_FOLLOWUPS, PP_INTAKE, PP_ACTIVITY, PP_QUICK };
