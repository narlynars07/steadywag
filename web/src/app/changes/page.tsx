import { Chip, PageHead } from "@/components/ui";
import { getRecordUpdates } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "What changed · Steadywag" };
export const revalidate = 60;

const KIND = { added: { label: "Added", tone: "green" }, corrected: { label: "Corrected", tone: "brand" }, flagged: { label: "Flagged", tone: "amber" }, resolved: { label: "Resolved", tone: "green" } } as const;
const BASIS = { vet: "Confirmed by his vet", family: "Reported by his family", documents: "From his documents" } as const;

export default async function ChangesPage() {
  const updates = await getRecordUpdates();
  return (
    <>
      <PageHead
        title="What changed"
        lead="A record is only useful if it stays true. Every time something is added, corrected, flagged or resolved, it is logged here with who said so."
      />
      <div className="space-y-6">
        <ol className="space-y-3 border-l-2 border-line pl-5">
          {updates.map((u) => (
            <li key={u._id} className="relative rounded-xl border border-line bg-surface p-4">
              <span aria-hidden="true" className="absolute -left-[30px] top-5 h-3.5 w-3.5 rounded-full border-2 border-paper bg-brand" />
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={KIND[u.kind].tone}>{KIND[u.kind].label}</Chip>
                <time dateTime={u.date} className="text-sm text-muted">{fmtDate(u.date)}</time>
                <span className="text-xs text-muted">· {BASIS[u.basis]}</span>
              </div>
              <h2 className="mt-1 font-semibold text-ink">{u.title}</h2>
              {u.summary && <p className="mt-1 text-sm leading-relaxed text-ink2">{u.summary}</p>}
            </li>
          ))}
        </ol>

        <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow)]" aria-labelledby="how">
          <h2 id="how" className="text-xl font-bold text-ink">How this record stays current</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink2">
            Everything about Theo lives in one structured record, so a fix is made once and shows up everywhere. Here is what happens when his vet removes ursodiol from the written list:
          </p>
          <ol className="mt-3 space-y-2 text-[15px] leading-snug text-ink2">
            {[
              ["Mark it stopped.", "In the Studio, ursodiol's status changes to stopped and gets an end date and a note about the visit."],
              ["Close the loose ends.", "Its record gap and its question for the vet are marked resolved."],
              ["Log it.", "A new entry is added to this page: what changed, the date, and that his vet confirmed it."],
              ["Everything updates itself.", "Within about a minute, the callout on the home page, Today, the sitter brief, Visit prep and the assistant's answers all stop saying it is unresolved, because they all read the same record."],
            ].map(([bold, rest], i) => (
              <li key={bold} className="flex gap-2.5">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-extrabold text-brand2">{i + 1}</span>
                <span><strong className="font-semibold text-ink">{bold}</strong> {rest}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted">Nothing on this site edits the record from the browser. Changes are made by the owner in the Studio, so every change has a person and a source behind it.</p>
        </section>
      </div>
    </>
  );
}
