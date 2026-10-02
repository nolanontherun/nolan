export const STAGES = ["Lead", "Contacted", "Negotiating", "Proposal sent", "Agreed", "Contract sent", "Contract signed", "Production", "Content delivered", "Invoice sent", "Paid", "Lost", "Archived"] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["Lead", "Contacted", "Negotiating", "Proposal sent", "Agreed", "Contract sent", "Contract signed", "Production", "Content delivered", "Invoice sent"];
export const NEGOTIATING_STAGES: Stage[] = ["Lead", "Contacted", "Negotiating", "Proposal sent"];
export const BOOKED_STAGES: Stage[] = ["Agreed", "Contract sent", "Contract signed", "Production", "Content delivered", "Invoice sent", "Paid"];

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF"] as const;
export const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", JPY: "¥", CHF: "CHF " };

export const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Photography", "Web", "Other"];
export const CONTENT_TYPES = ["Reel", "TikTok video", "Story", "YouTube integration", "YouTube dedicated video", "YouTube Short", "Photography", "UGC", "Raw footage", "Edited assets", "Commercial", "Collab post", "Dark post", "Link in bio", "Affiliate link", "Carousel", "Article", "Video"];
export const DELIVERABLE_STATUS = ["Planned", "In production", "In review", "Approved", "Delivered", "Published"];
export const USAGE_KINDS = ["Organic usage", "Paid usage", "Creator whitelisting", "Dark posting", "Brand social usage", "Website usage", "Amazon usage", "Advertising", "Broadcast", "TV", "OOH", "Print", "Raw footage licensing", "Edited asset licensing"];
export const DEAL_SOURCES = ["Direct inbound", "Agency", "Manager", "Email", "Instagram", "TikTok", "Referral", "Existing relationship", "Website", "Event", "Other"];
export const CONTACT_TYPES = ["Brand", "Agency", "PR", "Influencer marketing", "Talent manager", "Social", "Creative", "Marketing", "Production", "Tourism board", "Affiliate", "Other"];
export const PAYMENT_METHODS = ["Wire", "ACH", "PayPal", "Stripe", "Wise", "Check", "Cash", "Other"];
export const INVOICE_STATUSES = ["Draft", "Sent", "Viewed", "Due soon", "Due today", "Overdue", "Partially paid", "Paid", "Disputed", "Written off", "Void"];
export const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,001–10,000", "10,000+"];
export const CATEGORIES = ["Travel & Hospitality", "Travel Gear & Outdoor", "Tech & Cameras", "Music Promo", "Auto & Fuel", "Apparel & Lifestyle", "Apps & Software", "Other"];
export const DEFAULT_TAGS = ["Camera", "Travel", "Outdoor", "Automotive", "Fashion", "Tech", "Tourism", "Hotel", "Food", "Adventure", "Creator tools", "Software", "Gear", "Clothing", "Music"];
export const EXPENSE_CATEGORIES = ["DP / assistant", "Travel", "Talent", "Production", "Gear", "Software", "Other"];
export const EMAIL_CLASSES = ["New Lead", "Existing Client", "Existing Deal", "Negotiation", "Proposal", "Contract", "Invoice", "Payment", "Follow-up", "Deliverable", "Usage Rights", "Exclusivity", "Product Seeding", "Affiliate", "PR / Gifting", "Newsletter", "Spam", "Suspicious", "Personal", "Other"];
export const PRIORITIES = ["Critical", "High", "Medium", "Low", "Ignore"];

export const STAGE_TONE: Record<string, "good" | "warn" | "bad" | "mute" | "accent"> = {
  Lead: "mute", Contacted: "mute", Negotiating: "accent", "Proposal sent": "accent", Agreed: "accent", "Contract sent": "warn", "Contract signed": "accent", Production: "accent",
  "Content delivered": "warn", "Invoice sent": "warn", Paid: "good", Lost: "bad", Archived: "mute",
};
