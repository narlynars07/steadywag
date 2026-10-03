# Steadywag

Steadywag is a care companion built on one rare case: a public, sourced record, an agent that helps a family through the day, and a diet-history tool for other families.

It has two jobs:

1. **Theo's case, told honestly.** The de-identified records of one dog (Theo, a Shih Tzu mix with copper storage hepatopathy, recurrent pancreatitis and high triglycerides). Every fact is tied to its source. Gaps and contradictions in the records are kept visible on purpose. The Ask agent answers only from those records, from the family's own routine (labeled as such) and from cited veterinary guidance, through Sanity Context.
2. **A diet history for your dog.** A pre-diagnosis diet questionnaire, so families can give researchers consistent dietary copper exposure data. Copper is framed as what research is investigating, never as settled fact. Answers stay in the visitor's browser.

Built for the DEV Sanity Challenge, Path One (an agent that queries real content).

- **Live site:** https://steadywag.vercel.app
- **Sanity project ID:** `yahsq70q` (dataset `production`, public read)
- **Studio:** https://steadywag.sanity.studio
- **Public dataset query URL:** `https://yahsq70q.api.sanity.io/v2026-10-01/data/query/production?query=count(*)`

## Why the content is structured

Most of the value is in what a keyword search over the original PDFs could not tell you:

- `medication.status = "listed-not-given"` plus a `recordGap` of kind `verbal-instruction`: a drug is on the written list but was never given. The PDFs show it as active.
- `sourceNote.confidence` (`confirmed`, `single-source`, `conflicting`) on every fact that came from a record, so a conflict is a queryable state and not a sentence buried in a note.
- `recordGap` documents: what the chart does **not** know. Absence cannot be searched for. It has to be modeled.
- `dietHistoryEntry.origin` (`family-recall` or `medical-record`): the agent must say whether an earlier diet is what the family remembers or something a document states.

## What the site does

Five tabs. Four source labels are used everywhere: **Vet records**, **Family routine**, **Family recall**, **Your check-ins**.

| Route | What it is |
| --- | --- |
| `/` (Ask) | Task home: What does he need today, Something changed, Can he eat this, I'm watching Theo (sitter brief), Prep my vet visit, or a free question. Each task sends its own instructions to the agent. `/ask` redirects here. |
| `/sitter` | An instant sitter brief built from his records: the ursodiol warning first, his day in order with the vet's instructions and the family's times labeled, treats, foods never to give, warning signs, and a reminder to add phone numbers. Printable. Opened by "I'm watching Theo". |
| `/today` | A static page built from data: the day as a timeline (vet instruction first, family-routine times labeled), meds not due today, the food card, warning signs, activity. |
| `/check-in` | A 30-second daily log (appetite, energy, stool 1 to 7, vomiting, meds, note). Stored only in the browser under `steadywag.checkins.v1`, with CSV download and erase. |
| `/history` | "Theo in 60 seconds", a combined chart (ALT on a log scale, medication periods with their real breaks, flares and reactions), five chapters, four patterns. Also `/timeline`, `/labs`, `/meds`, `/visit-prep`. |
| `/your-dog` | The diet-history tool (blank by default; Theo's example at `/diet-history?example=1`, never saved) and the guide. Also `/food`, `/guide`. |

## Architecture

```
Browser ── Ask page (useChat) ──> POST /api/chat  (Next.js route, rate-limited)
                                      │
                                      ├─ Claude (claude-sonnet-5-5, AI SDK, up to 8 tool steps, read-only)
                                      │     instructions = base rules + the task's instructions + today's date + check-ins (if sent)
                                      │
                                      ├─ Sanity Context MCP endpoint 1: "chart" (GROQ mode over the dataset)
                                      │     tools: groq_query, schema_explorer, array_field_reader
                                      │
                                      ├─ Sanity Context MCP endpoint 2: "knowledge" (a Knowledge Base)
                                      │     tools: knowledge_base_search, knowledge_base_read
                                      │
                                      └─ Fallback (see below): direct GROQ against the public dataset
```

- **Web app** (`web/`): Next.js 16 and the Vercel AI SDK. Every page except the agent reads the same dataset with GROQ.
- **Dataset** (project `yahsq70q`): 500 documents across 19 types. New in this version: `careRoutine` (the family's own daily times), `historySummary`, `historyChapter` and `historyPattern` (written from the records, each pointing at the visits, labs and medications it rests on), and `medication.writtenInstruction` / `timingNote` (the vet's own wording, kept apart from the family's routine). See `studio/schemaTypes/`.
- **Request fields** (`POST /api/chat`): `messages`, plus three optional validated fields: `task` (`today`, `changed`, `eat`, `sitter`, `visit`, `free`), `today.date` (the visitor's local date, ignored if far from the server clock) and `checkins` (at most 14 entries, each field enumerated or length-capped). Check-ins go to the model marked as family-entered observations, inside delimiters, as data. Nothing is stored server-side.
- **Task instructions** (`web/src/lib/tasks.ts`): one block per task. Warning signs come first for "Something changed"; past flares are framed as "During past flares, his records show…"; "Can he eat this" declines what the plan does not cover; the sitter brief opens with the ursodiol warning and ends with the phone-number reminder.
- **Conversation:** one thread per browser tab, shared by the Ask page and the floating window, so follow-up questions work and it follows you between pages. It lives only in memory: closing the tab ends it, and nothing is saved. Earlier answers are sent back as text only, without their lookup results.
- **USDA food lookup:** the one place the agent can reach outside his chart. `usda_food_lookup` reads USDA FoodData Central for copper, sodium, fat, calories and protein per 100 g, only for a food his plan does not cover. Its numbers are labeled "USDA food data, not from his vet", compared with the approved foods already in his plan, and never turned into "safe". Only the food name leaves the server. `USDA_API_KEY` is optional (without it the shared demo key is used and the tool says when it is busy).
- **Today** answers "What does he need today?" with the Today page, not an agent run. It reads the visitor's clock: a "Due now" or "Next up" card, "Later today", and finished steps collapsed.
- **Work trace** (`web/src/lib/trace.ts`): the agent's tool calls become plain-language steps ("Reading his medication list") while it works, and source chips that link to the matching page when it finishes.
- **Knowledge Base:** built in the Sanity dashboard from the `guidance` and `dietRule` documents. Rebuild it after those documents change.
- **Embeddings:** not enabled on the dataset. Retrieval from the Knowledge Base is keyword (BM25) search.
- **The agent** (`web/src/lib/agent.ts`, `web/src/app/api/chat/route.ts`): connects to both endpoints with a read-only Context Viewer token, reads each endpoint's initial context into its prompt, and exposes their tools to the model. It cannot write anything. It never diagnoses, gives or changes a dose, or recommends starting or stopping anything. It cites the records it used and says when a record is single-source, conflicting, or missing.
- **Sources panel:** every answer lists each lookup, its query, and the records it returned, under the source chips.
- **Fallback:** if the Context endpoints are not configured or unreachable, the agent queries the same public dataset directly. This is deliberate, but it is never silent. The server logs a JSON `agent_fallback` line with the reason, and the answer shows a visible "Direct query, not Sanity Context" notice.
- **Cost protection:** per-visitor and site-wide daily question limits (`web/src/lib/limits.ts`), counted in Upstash Redis. Set the model provider's workspace spend limit as well.

## What can write to the dataset

Nothing public. The web app has no mutations. The only POST route, `/api/chat`, writes rate-limit counters to Redis, not to the dataset. It stores no conversations. The Context endpoints are read-only. Writes happen only through `scripts/load_dataset.py` with an editor token.

## Run it

```bash
# 1. Environment: copy the template and fill in real values (never commit them)
cp .env.example .env.local
ln -s ../.env.local web/.env.local

# 2. The web app
cd web
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npx eslint .         # lint

# 3. The Studio (optional)
cd ../studio
npm install
npm run dev
```

Without `ANTHROPIC_API_KEY` the Ask page reports that the assistant is not switched on. Without the Context URLs and token it runs in direct-query fallback mode, and says so on every answer. All the other pages work with just the two public `NEXT_PUBLIC_*` variables.

### Loading the dataset

`scripts/build_dataset.py` builds the de-identified dataset from private source records, which are not in this repository, so the build cannot be rerun from a clone. `scripts/load_dataset.py` writes the built file to Sanity (`--dry-run` first). Judges do not need either: the dataset is public and live at the project ID above.

## Privacy

The dataset is de-identified: first name and birth year only, no clinic, clinician, owner, address, phone, email, or account details, and free text written in our own words. Raw source records and anything derived from them before review are gitignored.

## Not medical advice

Steadywag tracks and prepares. It never diagnoses, doses, or changes a plan. None of the guidance entries has been reviewed by a veterinarian yet.
