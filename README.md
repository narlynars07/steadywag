# Steadywag

**A care companion for a dog with a chronic illness.** It reads his records and tells you what the paperwork doesn't say.

Built on one real case: Theo, an 8-year-old Shih Tzu mix with copper storage hepatopathy, recurrent pancreatitis and high triglycerides. His care lived in about 180 pages of reports, emails and things said out loud in exam rooms. Steadywag turns that into one structured, sourced record in Sanity, then puts an agent, a daily plan, check-ins and appointments on top of it. Built for the [DEV Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16), Path One: an agent that queries real content.

**The idea in one example.** A medication was on the written list, but the dog never got it: a specialist told one caregiver out loud to skip it, and nobody updated the paper. The structure knows (`medication.status = "listed-not-given"` plus a `recordGap`). The PDFs don't. The agent, the Today page, the sitter brief and the home page all read that one fact.

- **Live site:** https://steadywag.com (also https://steadywag.vercel.app). It installs as an app on a phone or computer.
- **Sanity project ID:** `yahsq70q`, dataset `production` (public read, 516 documents, 22 types)
- **Studio:** https://steadywag.sanity.studio
- **Public dataset query:** `https://yahsq70q.api.sanity.io/v2026-10-01/data/query/production?query=count(*)`

## What's in the repo

| Folder | What it is |
| --- | --- |
| [`web/`](web/README.md) | The Next.js 16 site: the Ask agent, Today, Check-in, Appointments, History, Your dog. **Start with `web/README.md`** for the architecture, guardrails and how to run it. |
| `studio/` | The Sanity Studio and the 22-type schema. |
| `evals/` | 24 audit questions with checkable expectations, and a runner. See [`evals/README.md`](evals/README.md). |
| `scripts/` | Builds and loads the de-identified dataset. |
| `docs/` | The Sanity Context setup sheet, and how the record stays current. |

## How it uses Sanity

- **Two Sanity Context endpoints, read-only.** A chart endpoint in GROQ mode over the dataset, and a knowledge endpoint backed by a Knowledge Base built from the cited guidance and diet-plan rules.
- **Structure does the work.** Confidence on every fact (`confirmed`, `single-source`, `conflicting`), documents for what the chart does *not* know (`recordGap`), and the vet's written words kept apart from the family's routine.
- **Honest failure.** If the Context endpoints are unreachable, the agent says so on every answer instead of quietly changing how it works.

## Guardrails

The agent never diagnoses, gives or changes a dose, or tells you to start or stop anything. A small scope gate declines anything not about Theo. Web search is limited to a short list of veterinary sources and labeled "From the web". Check-ins and appointments stay in the visitor's own browser. Details and the full list are in [`web/README.md`](web/README.md).

## Not medical advice

Steadywag tracks and prepares. It never diagnoses, doses, or changes a plan. None of the guidance entries has been reviewed by a veterinarian yet.

## License

[MIT](LICENSE) for the code. The dataset is a de-identified record of one dog, shared for the challenge; the veterinary guidance entries are summaries in our own words that link to every original source.
