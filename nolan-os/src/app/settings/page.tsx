import { all, getSetting } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui";
import { addIgnoreRule, removeIgnoreRule, saveSettings } from "@/lib/actions";

export const metadata = { title: "Settings" };
export default function Settings() {
  const profile = getSetting<any>("profile", {}); const inv = getSetting<any>("invoice", {}); const beh = getSetting<any>("behaviour", {}); const fx = getSetting<any>("fx", {});
  const rules = all<any>("SELECT * FROM notification_rules"); const ignores = all<any>("SELECT * FROM ignore_rules");
  const L = ({ l, children, h }: { l: string; children: React.ReactNode; h?: string }) => <label className="block"><span className="label">{l}</span>{children}{h && <span className="mt-1 block text-[11.5px] text-faint">{h}</span>}</label>;
  return (
    <div>
      <PageHeader title="Settings" kicker="Your rules" sub="Everything here changes how Nolan OS behaves. Nothing is sent anywhere: all data and analysis stay on this machine." />
      <div className="grid gap-x-14 lg:grid-cols-2">
        <Section title="Business profile">
          <form action={saveSettings} className="grid gap-3"><input type="hidden" name="kind" value="profile" />
            <L l="Your name"><input name="name" defaultValue={profile.name} className="input" /></L><L l="Business name"><input name="business" defaultValue={profile.business} className="input" /></L><L l="Email on invoices"><input name="email" defaultValue={profile.email} className="input" /></L><L l="Website"><input name="website" defaultValue={profile.website} className="input" /></L><L l="Address"><textarea name="address" defaultValue={profile.address} className="input" /></L>
            <div><button className="btn btn-primary">Save</button></div></form>
        </Section>
        <Section title="Invoices">
          <form action={saveSettings} className="grid gap-3"><input type="hidden" name="kind" value="invoice" />
            <L l="Number prefix" h={`Numbers look like ${inv.prefix ?? "NTR"}-${new Date().getFullYear()}-001 and count up each year.`}><input name="prefix" defaultValue={inv.prefix} className="input" /></L><L l="Default payment terms"><input name="defaultTerms" defaultValue={inv.defaultTerms} className="input" placeholder="Net 30" /></L>
            <L l="Bank and payment information" h="Printed on every invoice. Nothing is filled in for you."><textarea name="paymentInfo" defaultValue={inv.paymentInfo} className="input" rows={4} placeholder="Account name, IBAN / routing, SWIFT, PayPal email…" /></L><L l="Default invoice note"><textarea name="notes" defaultValue={inv.notes} className="input" /></L>
            <div><button className="btn btn-primary">Save</button></div></form>
        </Section>
        <Section title="Behaviour">
          <form action={saveSettings} className="grid gap-3"><input type="hidden" name="kind" value="behaviour" />
            <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" name="blockExclusivityConflicts" defaultChecked={beh.blockExclusivityConflicts} className="mt-1" /><span>Block a new deal when it conflicts with active exclusivity<span className="block text-[11.5px] text-faint">Off by default. When off, you get a warning and decide yourself.</span></span></label>
            <div className="grid grid-cols-2 gap-3"><L l="Dormant after (months)"><input name="dormantMonths" type="number" defaultValue={beh.dormantMonths} className="input" /></L><L l="Reply expected within (days)"><input name="replyDays" type="number" defaultValue={beh.replyDays} className="input" /></L><L l="Chase after silence (days)"><input name="chaseDays" type="number" defaultValue={beh.chaseDays} className="input" /></L><L l="Contract unsigned alert (days)"><input name="contractDays" type="number" defaultValue={beh.contractDays} className="input" /></L><L l="Usage warning (days)"><input name="usageWarnDays" type="number" defaultValue={beh.usageWarnDays} className="input" /></L><L l="Exclusivity warning (days)"><input name="exclusivityWarnDays" type="number" defaultValue={beh.exclusivityWarnDays} className="input" /></L><L l="High-value threshold (USD)"><input name="highValueUSD" type="number" defaultValue={beh.highValueUSD} className="input" /></L></div>
            <div><button className="btn btn-primary">Save</button></div></form>
        </Section>
        <Section title="Exchange rates" id="fx">
          <form action={saveSettings} className="grid gap-3" id="fx"><input type="hidden" name="kind" value="fx" />
            <p className="text-[12.5px] text-mute">Optional. Original amounts and currencies are never changed. A rate here only lets analytics include that currency in USD charts, labelled as converted. Leave empty to keep everything separate.</p>
            <div className="grid grid-cols-3 gap-3">{["EUR", "GBP", "CAD", "AUD", "JPY", "CHF"].map((c) => <L key={c} l={`${c} to USD`}><input name={`fx_${c}`} defaultValue={fx[c] ?? ""} className="input" inputMode="decimal" placeholder="not set" /></L>)}</div>
            <div><button className="btn btn-primary">Save</button></div></form>
        </Section>
        <Section title="Notifications">
          <form action={saveSettings} className="grid gap-2"><input type="hidden" name="kind" value="rules" />
            {rules.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line/[0.07] py-2 text-[13px]"><label className="flex items-center gap-2"><input type="checkbox" name={`on_${r.id}`} defaultChecked={!!r.enabled} />{r.label}</label>{r.threshold !== null && <input name={`th_${r.id}`} type="number" defaultValue={r.threshold} className="input !w-20" />}</div>)}
            <div className="mt-2"><button className="btn btn-primary">Save</button></div><p className="text-[11.5px] text-faint">Enabled rules decide what Attention surfaces. Each item can be dismissed on its own.</p></form>
        </Section>
        <Section title="Email privacy: what is ignored">
          <p className="mb-3 text-[12.5px] text-mute">Pasted or imported emails from these senders or domains are not analysed. Personal addresses and newsletters are excluded by adding them here.</p>
          <ul className="mb-3">{ignores.map((i) => <li key={i.id} className="flex items-center justify-between border-b border-line/[0.07] py-2 text-[13px]"><span>{i.value} <span className="text-faint">· {i.kind}</span></span><form action={removeIgnoreRule}><input type="hidden" name="id" value={i.id} /><button className="btn btn-ghost btn-sm">Remove</button></form></li>)}{!ignores.length && <li className="text-[13px] text-faint">Nothing ignored yet.</li>}</ul>
          <form action={addIgnoreRule} className="flex gap-2"><select name="kind" className="input !w-28"><option value="domain">Domain</option><option value="sender">Sender</option></select><input name="value" className="input" placeholder="newsletter.com or name@example.com" /><button className="btn">Add</button></form>
        </Section>
      </div>
    </div>
  );
}
