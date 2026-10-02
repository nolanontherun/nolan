// Rule-based business-email intelligence. Deterministic, local, explainable.
// Every extracted value carries a certainty: FACT (explicit), INFERENCE (hedged or derived), UNKNOWN.
// Nothing here writes to the database or marks anything paid/confirmed.

export type Certainty = "FACT" | "INFERENCE" | "UNKNOWN";
export type Fact = { key: string; label: string; value: string; certainty: Certainty; evidence: string; amount?: number; currency?: string };

const HEDGES = /\b(probably|around|about|roughly|approximately|approx\.?|up to|maybe|could do|can probably|in the range|ballpark|somewhere|~)\b/i;

function sentenceAround(text: string, idx: number, len: number) {
  const start = Math.max(text.lastIndexOf(".", idx - 1), text.lastIndexOf("\n", idx - 1)) + 1;
  let end = text.indexOf(".", idx + len);
  const nl = text.indexOf("\n", idx + len);
  if (end === -1 || (nl !== -1 && nl < end)) end = nl === -1 ? text.length : nl;
  return text.slice(start, Math.min(text.length, end + 1)).trim();
}

const CUR: Record<string, string> = { "$": "USD", "usd": "USD", "€": "EUR", "eur": "EUR", "£": "GBP", "gbp": "GBP", "cad": "CAD", "aud": "AUD", "chf": "CHF", "¥": "JPY", "jpy": "JPY" };

export function extractAmounts(text: string): { amount: number; currency: string; evidence: string; hedged: boolean; index: number }[] {
  const out: { amount: number; currency: string; evidence: string; hedged: boolean; index: number }[] = [];
  const re = /(?:(USD|EUR|GBP|CAD|AUD|CHF|JPY)\s?|([$€£¥]))\s?(\d[\d,]*(?:\.\d+)?)\s?(k|K|thousand)?(?!\w)|(\d[\d,]*(?:\.\d+)?)\s?(k|K)?\s?(USD|EUR|GBP|CAD|AUD|CHF|dollars|euros)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const code = (m[1] || m[2] || m[7] || "").toLowerCase();
    const cur = CUR[code] ?? (code === "dollars" ? "USD" : code === "euros" ? "EUR" : "USD");
    const numStr = (m[3] || m[5] || "").replace(/,/g, "");
    let n = parseFloat(numStr);
    if (!isFinite(n)) continue;
    if (m[4] || m[6]) n *= 1000;
    const evidence = sentenceAround(text, m.index, m[0].length);
    const around = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 5);
    out.push({ amount: Math.round(n * 100), currency: cur, evidence, hedged: HEDGES.test(around), index: m.index });
  }
  return out;
}

const DELIVERABLE_RULES: [RegExp, string, string][] = [
  [/(\d+|one|two|three|four|five|six)\s+(?:instagram\s+|ig\s+)?reels?/i, "Instagram", "Reel"],
  [/(\d+|one|two|three|four|five|six)\s+tiktoks?(?:\s+videos?)?/i, "TikTok", "TikTok video"],
  [/(\d+|one|two|three|four|five|six)\s+(?:instagram\s+|ig\s+)?stor(?:y|ies)(?:\s+frames?)?/i, "Instagram", "Story"],
  [/(\d+|one|two|three|four|five|six)\s+youtube\s+shorts?/i, "YouTube", "YouTube Short"],
  [/(\d+|one|two)\s+(?:dedicated\s+)?youtube\s+(?:dedicated\s+)?videos?/i, "YouTube", "YouTube dedicated video"],
  [/youtube\s+integration/i, "YouTube", "YouTube integration"],
  [/(\d+|one|two|three|four|five|six)\s+(?:ugc\s+)?(?:videos?|clips?)/i, "Other", "Video"],
  [/\bugc\b/i, "Other", "UGC"],
  [/(\d+|one|two|three|four|five|six)\s+photos?/i, "Photography", "Photography"],
  [/raw footage/i, "Other", "Raw footage"],
  [/link in bio/i, "Instagram", "Link in bio"],
  [/affiliate (?:link|code)/i, "Other", "Affiliate link"],
];
const NUMWORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

export function extractDeliverables(text: string): Fact[] {
  const out: Fact[] = [];
  for (const [re, platform, ctype] of DELIVERABLE_RULES) {
    const m = text.match(re);
    if (!m) continue;
    const q = m[1] ? (NUMWORD[m[1].toLowerCase()] ?? parseInt(m[1], 10)) : null;
    out.push({ key: "deliverable", label: "Deliverable", value: `${q ?? "?"} × ${platform} ${ctype}`.replace("? ×", "Quantity unknown ×"), certainty: q ? "FACT" : "INFERENCE", evidence: sentenceAround(text, m.index!, m[0].length) });
  }
  return out;
}

export function extractUsage(text: string): Fact[] {
  const out: Fact[] = [];
  const paid = text.match(/(\d+)\s*(day|days|month|months|year|years)\s+(?:of\s+)?(?:paid|ad|advertising)\s+(?:usage|rights|licen[cs]e)|(?:paid|ad|advertising)\s+(?:usage|rights|licen[cs]e)\s+(?:for|of)\s+(\d+)\s*(day|days|month|months|year|years)/i);
  if (paid) {
    const n = paid[1] ?? paid[3]; const unit = paid[2] ?? paid[4];
    out.push({ key: "usage:paid", label: "Paid usage", value: `${n} ${unit}`, certainty: "FACT", evidence: sentenceAround(text, paid.index!, paid[0].length) });
  } else {
    const generic = text.match(/paid usage|usage rights|ad rights|paid media|whitelisting|whitelist|dark post|spark ads?|partnership ads?/i);
    if (generic) out.push({ key: "usage:mention", label: /whitelist/i.test(generic[0]) ? "Whitelisting" : "Usage mention", value: "Mentioned, terms not stated", certainty: "INFERENCE", evidence: sentenceAround(text, generic.index!, generic[0].length) });
  }
  const wl = text.match(/whitelist(?:ing)?|dark post(?:ing)?|spark ads?|partnership ads?/i);
  if (wl && paid) out.push({ key: "usage:whitelisting", label: "Whitelisting / dark posting", value: wl[0], certainty: "FACT", evidence: sentenceAround(text, wl.index!, wl[0].length) });
  const ex = text.match(/exclusiv(?:e|ity)[^.]{0,80}?(\d+)\s*(day|days|month|months|year|years)|(\d+)\s*(day|days|month|months|year|years)[^.]{0,40}exclusiv/i);
  if (ex) out.push({ key: "exclusivity", label: "Exclusivity", value: `${ex[1] ?? ex[3]} ${ex[2] ?? ex[4]}`, certainty: "FACT", evidence: sentenceAround(text, ex.index!, ex[0].length) });
  else if (/exclusiv/i.test(text)) { const i = text.search(/exclusiv/i); out.push({ key: "exclusivity", label: "Exclusivity", value: "Mentioned, terms not stated", certainty: "INFERENCE", evidence: sentenceAround(text, i, 9) }); }
  return out;
}

export function extractPaymentTerms(text: string): Fact[] {
  const out: Fact[] = [];
  const net = text.match(/\bnet[\s-]?(\d{1,3})\b/i) || text.match(/(?:within|in)\s+(\d{1,3})\s+(?:business\s+|calendar\s+)?days\s+(?:of|after|from)\s+(?:invoice|receipt|delivery|publication|posting)/i) || text.match(/paid\s+(?:within\s+)?(\d{1,3})\s+days/i);
  if (net) out.push({ key: "payment_terms", label: "Payment terms", value: `Net ${net[1]}`, certainty: "FACT", evidence: sentenceAround(text, net.index!, net[0].length) });
  return out;
}

export function extractDates(text: string): Fact[] {
  const out: Fact[] = [];
  const months = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const re = new RegExp(`\\b(?:by|before|on|until|due|deadline|live by|post(?:ing)? (?:on|by))?\\s*((?:${months})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?)`, "gi");
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(text))) {
    const v = m[1].trim();
    if (seen.has(v)) continue;
    seen.add(v);
    const ev = sentenceAround(text, m.index, m[0].length);
    const kind = /deadline|due|by |before|live|post/i.test(ev) ? "Deadline mentioned" : "Date mentioned";
    out.push({ key: "date", label: kind, value: v, certainty: "FACT", evidence: ev });
  }
  const dow = text.match(/\b(?:by|before|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|end of (?:the )?(?:week|month))\b/i);
  if (dow) out.push({ key: "date", label: "Relative deadline", value: dow[1], certainty: "INFERENCE", evidence: sentenceAround(text, dow.index!, dow[0].length) });
  return out;
}

export function extractDeal(text: string): { facts: Fact[]; summary: string } {
  const facts: Fact[] = [];
  const amounts = extractAmounts(text);
  const nonTiny = amounts.filter((a) => a.amount >= 5000); // ignore $1-$49 mentions (shipping etc.)
  for (const a of nonTiny.slice(0, 3)) {
    const ctx = a.evidence.toLowerCase();
    const isBudget = /budget|offer|pay|compensation|fee|rate|fixed|flat|per\b|for\b|total/.test(ctx);
    facts.push({
      key: "offer", label: a.hedged ? "Potential budget" : "Offer", value: `${a.amount / 100}`, amount: a.amount, currency: a.currency, certainty: a.hedged ? "INFERENCE" : isBudget ? "FACT" : "INFERENCE", evidence: a.evidence,
    });
  }
  facts.push(...extractDeliverables(text), ...extractUsage(text), ...extractPaymentTerms(text), ...extractDates(text));
  const n = facts.length;
  return { facts, summary: n ? `AI detected ${n} deal detail${n === 1 ? "" : "s"}` : "No deal details detected" };
}

// ---------------------------------------------------------------- payment promises
const PROMISE = [
  /we(?:'ll| will)\s+(?:process|send|pay|release|issue)[^.]{0,60}(?:payment|invoice|funds)[^.]{0,40}/i,
  /payment\s+(?:is|has been|was)\s+(?:being\s+)?(?:processed|processing|submitted|scheduled|sent|approved|released)/i,
  /(?:finance|accounting|accounts payable|ap team)\s+(?:will|is going to|are going to)[^.]{0,60}/i,
  /(?:you(?:'ll| will)\s+(?:receive|get)\s+(?:payment|the funds|funds))[^.]{0,60}/i,
  /(?:funds|payment)\s+(?:will|should)\s+(?:arrive|be (?:sent|released|with you))[^.]{0,50}/i,
  /(?:anticipate|expect)\s+(?:you\s+)?(?:will\s+)?(?:to\s+)?receive\s+(?:the\s+)?(?:funds|payment)[^.]{0,40}/i,
  /invoices?\s+(?:will be|are)\s+paid\s+within\s+\d+\s+days[^.]{0,40}/i,
];
export function detectPaymentPromise(text: string): { text: string; claimed: string | null } | null {
  for (const re of PROMISE) {
    const m = text.match(re);
    if (m) {
      const ev = sentenceAround(text, m.index!, m[0].length);
      const when = ev.match(/(next week|this week|tomorrow|today|end of (?:the )?(?:week|month)|within\s+\d+\s+(?:business\s+)?days|in \d+ days|(?:on|by)\s+(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}))/i);
      return { text: ev, claimed: when ? when[1] : null };
    }
  }
  return null;
}

// ---------------------------------------------------------------- lead detection
const LEAD = [
  /we(?:'d| would)\s+love\s+to\s+(?:work|collaborate|partner)/i, /are you available/i, /can you (?:send|share)\s+(?:your\s+)?(?:rates?|pricing|media kit|rate card)/i,
  /what(?:'s| is)\s+your\s+(?:pricing|rate|rates|availability)/i, /we have a campaign/i, /would you be (?:interested|open)/i, /(?:discuss|explore)\s+a\s+(?:partnership|collaboration)/i,
  /(?:paid|sponsored)\s+(?:collaboration|partnership|opportunity|campaign|integration)/i, /media kit/i, /budget (?:for|of|is)/i, /we(?:'d| would)\s+like to\s+(?:offer|work|invite|partner)/i,
  /collab(?:oration)?\s+(?:opportunity|proposal|offer)/i, /(?:offer|offering)\s+(?:you\s+)?(?:\$|€|£|a fee|a flat)/i, /brand (?:ambassador|partnership)/i,
];
export function detectLead(text: string): { matched: string[]; confidence: "high" | "medium" | "low" } {
  const matched = LEAD.filter((r) => r.test(text)).map((r) => (text.match(r) ?? [""])[0]);
  const hasAmount = extractAmounts(text).some((a) => a.amount >= 5000);
  const score = matched.length + (hasAmount ? 1 : 0);
  return { matched, confidence: score >= 3 ? "high" : score === 2 ? "medium" : "low" };
}

// ---------------------------------------------------------------- suspicious signals
const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|libero|aol|proton|protonmail|icloud|mail|gmx|qq|163|126)\.[a-z.]+$/i;
export function suspiciousSignals(msg: { from: string; body: string; subject?: string; claimedCompany?: string | null; links?: string[] }): { level: "none" | "suspicious"; reasons: string[] } {
  const reasons: string[] = [];
  const text = `${msg.subject ?? ""}\n${msg.body}`;
  const fromAddr = (msg.from.match(/<([^>]+)>/)?.[1] ?? msg.from).toLowerCase();
  const domain = fromAddr.split("@")[1] ?? "";
  if (/gift cards?|itunes card|steam card|google play card/i.test(text)) reasons.push("Mentions gift cards as payment or reimbursement.");
  if (/\b(bitcoin|btc|ethereum|usdt|crypto(?:currency)?|wallet address)\b/i.test(text)) reasons.push("Mentions cryptocurrency.");
  if (/(?:install|download)\s+(?:this\s+)?(?:app|software|plugin|extension|program|tool)|\.exe\b|\.scr\b|\.apk\b|anydesk|teamviewer/i.test(text)) reasons.push("Asks you to install software or opens an executable.");
  if (/(?:send|pay|wire|transfer)\s+(?:us\s+|me\s+)?(?:a\s+)?(?:\$|€|£)?\d+[^.]{0,40}(?:before|first|upfront|in advance|shipping fee|registration fee|insurance|deposit)/i.test(text) || /(?:upfront|advance|registration|verification)\s+(?:fee|payment|deposit)/i.test(text)) reasons.push("Asks you to pay money before the campaign pays you.");
  if (/(?:ssn|social security|passport (?:number|scan|copy)|bank (?:login|password)|password|one[- ]time code|verification code|routing number and|full card number)/i.test(text)) reasons.push("Asks for sensitive information.");
  if (/(?:whatsapp|telegram|signal|wechat|kik)\b/i.test(text) && /(?:message|contact|chat|reach|move|continue)/i.test(text)) reasons.push("Asks to move the conversation to a messaging platform.");
  if (/(?:urgent|immediately|within 24 hours|act now|last chance|expires today|final notice)/i.test(text) && /(?:payment|account|verify|offer|contract)/i.test(text)) reasons.push("Urgency that pressures a fast decision.");
  if (/(?:log ?in|sign ?in|verify your account|confirm your (?:account|payment))\b/i.test(text) && (msg.links?.length ?? /https?:\/\//i.test(text) ? 1 : 0)) reasons.push("Unexpected login or payment link.");
  if (msg.claimedCompany) {
    const cc = msg.claimedCompany.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cc && domain && !FREE_MAIL.test(fromAddr) && !domain.replace(/[^a-z0-9]/g, "").includes(cc.slice(0, Math.min(cc.length, 6)))) reasons.push(`Sender domain (${domain}) does not appear to match the company they claim to represent (${msg.claimedCompany}).`);
    if (FREE_MAIL.test(fromAddr)) reasons.push(`Writes from a personal mail address (${domain}) while claiming to represent ${msg.claimedCompany}.`);
  }
  if (/\.(?:zip|rar|exe|scr|iso)\b/i.test(text)) reasons.push("Mentions a suspicious attachment type.");
  return { level: reasons.length ? "suspicious" : "none", reasons };
}

// ---------------------------------------------------------------- classification + priority
export function classifyEmail(msg: { from: string; to?: string; subject?: string; body: string; knownDomains?: string[]; ignoreDomains?: string[] }): {
  klass: string; priority: "Critical" | "High" | "Medium" | "Low" | "Ignore"; signals: string[]; suspicious: string[]; lead: ReturnType<typeof detectLead>; promise: ReturnType<typeof detectPaymentPromise>;
} {
  const text = `${msg.subject ?? ""}\n${msg.body}`;
  const fromAddr = (msg.from.match(/<([^>]+)>/)?.[1] ?? msg.from).toLowerCase();
  const domain = fromAddr.split("@")[1] ?? "";
  const signals: string[] = [];
  const sus = suspiciousSignals({ from: msg.from, body: msg.body, subject: msg.subject });
  const lead = detectLead(text);
  const promise = detectPaymentPromise(text);
  let klass = "Other";
  let priority: "Critical" | "High" | "Medium" | "Low" | "Ignore" = "Low";
  if (msg.ignoreDomains?.some((d) => domain.endsWith(d.toLowerCase()))) return { klass: "Other", priority: "Ignore", signals: ["Sender domain is on your ignore list."], suspicious: [], lead, promise };
  if (/unsubscribe|view (?:this )?(?:email )?in (?:your )?browser|newsletter|weekly digest|no-?reply@/i.test(text + fromAddr) && !lead.matched.length) { klass = "Newsletter"; priority = "Ignore"; signals.push("Looks like a newsletter or automated mailing."); }
  else if (sus.level === "suspicious" && sus.reasons.length >= 2) { klass = "Suspicious"; priority = "Critical"; signals.push("Multiple suspicious signals."); }
  else if (lead.matched.length && !/\binvoice\b|remittance|payout|overdue|wire transfer/i.test(text)) { klass = extractAmounts(text).length ? "Proposal" : "New Lead"; priority = lead.confidence === "high" ? "High" : "Medium"; signals.push(`Matches lead phrasing: “${lead.matched[0]}”.`); }
  else if (/\binvoice\b|\bpayments?\b|remittance|wire transfer|payout|\bpaid (?:you|to you|out)\b/i.test(text)) { klass = /invoice/i.test(msg.subject ?? "") ? "Invoice" : "Payment"; priority = "High"; signals.push("Mentions payment or an invoice."); }
  else if (/contract|agreement|sign(?:ed|ature)?|docusign|nda\b/i.test(text)) { klass = "Contract"; priority = "High"; signals.push("Mentions a contract or signature."); }
  else if (/usage rights|whitelist|exclusiv/i.test(text)) { klass = /exclusiv/i.test(text) ? "Exclusivity" : "Usage Rights"; priority = "High"; signals.push("Mentions usage or exclusivity."); }
  else if (lead.matched.length) { klass = extractAmounts(text).length ? "Proposal" : "New Lead"; priority = lead.confidence === "high" ? "High" : "Medium"; signals.push(`Matches lead phrasing: “${lead.matched[0]}”.`); }
  else if (/gift|product (?:seeding|send)|send you (?:a|our)|complimentary|pr package/i.test(text)) { klass = /pr package|gift/i.test(text) ? "PR / Gifting" : "Product Seeding"; priority = "Low"; }
  else if (/affiliate|commission/i.test(text)) { klass = "Affiliate"; priority = "Low"; }
  else if (/draft|deliverable|upload|post(?:ing)? (?:on|by)|approve|revision/i.test(text)) { klass = "Deliverable"; priority = "Medium"; }
  if (sus.reasons.length && klass !== "Suspicious") signals.push(`${sus.reasons.length} possible warning signal${sus.reasons.length === 1 ? "" : "s"}.`);
  const amounts = extractAmounts(text);
  if (amounts.some((a) => a.amount >= 1000000) && (klass === "Proposal" || klass === "New Lead")) { priority = "High"; signals.push("Mentions an amount of $10,000 or more."); }
  if (/(?:overdue|past due|final reminder|legal|lawyer|dispute)/i.test(text) && /invoice|payment/i.test(text)) { priority = "Critical"; signals.push("Overdue, dispute or legal language around payment."); }
  return { klass, priority, signals, suspicious: sus.reasons, lead, promise };
}

// ---------------------------------------------------------------- thread follow-up detection
export type ThreadMsg = { date: string; direction: "in" | "out" | "draft" | string; classification?: string | null; subject?: string | null };
export function threadFollowUp(msgs: ThreadMsg[], todayISO: string, thresholds: { replyDays: number; chaseDays: number; maxReplyAge?: number; maxChaseAge?: number } = { replyDays: 2, chaseDays: 5 }): { kind: "needs_reply" | "waiting_on_them"; days: number } | null {
  const real = msgs.filter((m) => m.date && m.direction !== "draft").sort((a, b) => a.date.localeCompare(b.date));
  if (!real.length) return null;
  const last = real[real.length - 1];
  const days = Math.round((Date.parse(todayISO) - Date.parse(last.date.slice(0, 10))) / 86400000);
  const replyClasses = ["New Lead", "Proposal", "Negotiation", "Contract", "Follow-up", "Existing Deal", "Existing Client", "Usage Rights", "Exclusivity"];
  const chaseClasses = [...replyClasses, "Invoice", "Payment", "Deliverable"];
  const maxReply = (thresholds as any).maxReplyAge ?? 30, maxChase = (thresholds as any).maxChaseAge ?? 60;
  if (last.direction === "in" && days >= thresholds.replyDays && days <= maxReply && (!last.classification || replyClasses.includes(last.classification))) return { kind: "needs_reply", days };
  if (last.direction === "out" && days >= thresholds.chaseDays && days <= maxChase && (!last.classification || chaseClasses.includes(last.classification))) return { kind: "waiting_on_them", days };
  return null;
}
