/** The five task buttons on the Ask home, plus a free question. Each adds its own instructions on top of the agent's base rules. */
export type Task = "today" | "changed" | "eat" | "sitter" | "visit" | "free";
export const TASKS: Task[] = ["today", "changed", "eat", "sitter", "visit", "free"];

export const TASK_PROMPTS = {
  today: "What does he need today?",
  sitter: "I'm watching Theo this weekend. Write me a brief for a sitter.",
  visit: "Prep my vet visit.",
} as const;

export function taskQuestion(task: Task, text: string): string {
  const t = text.trim();
  if (task === "changed") return `Something changed: ${t}`;
  if (task === "eat") return `Can he eat ${t}?`;
  if (task === "free") return t;
  return TASK_PROMPTS[task];
}

const WARNING_SIGNS =
  "not eating for a day or more, vomiting more than once, blood or black stool, yellow gums or eyes, collapse, a seizure, trouble breathing, a swollen painful belly, or seems very unwell";

/** Added to the agent's instructions for each task. The base rules in agent.ts always apply too. */
export const TASK_INSTRUCTIONS: Record<Task, string> = {
  today: `TASK: "What does he need today?"
- Look everything up in as few queries as you can: one GROQ query that returns medications (name, dose, frequency, days, status, writtenInstruction, timingNote, lastConfirmedOn), careRoutine (title, kind, sortOrder, timeLabel, detail, items) and the dietRule treat allowance together, for example *[_type in ["medication","careRoutine","dietRule"]]{_type,...}, with only the fields you need. Do not run one query per drug.
- Use TODAY'S DATE (below) to work out the weekday. Say what is due today: drugs whose days include that weekday (Cerenia and penicillamine are Monday, Wednesday, Friday on his list) and the daily ones (no days).
- Say the ursodiol flag first, in one line: it is on his written list but was never given, because of a verbal instruction.
- For each drug due today: its name and dose, then his vet's instruction exactly as written (writtenInstruction), labeled "per his vet's instructions". Never calculate, convert or restate a dose.
- Times: where his records give timing (timeOfDay or timingNote), use it exactly and label it "per his vet's instructions". Where they give none, use the careRoutine times and label them "per his family's routine". Never invent a time.
- Cerenia: say that his medication list and his written instruction disagree (Monday, Wednesday, Friday versus every 24 hours as needed). Show both. Do not pick one.
- Then his meals (careRoutine), the treat limit (42 kcal a day, low in copper and sodium), and whether the lower-fat diet has been made yet.
- Then the drugs that are not due today.
- End with the warning signs: ${WARNING_SIGNS}. Contact his vet or an emergency vet.
Keep it short, with headings: Morning, Evening, Bedtime (only on days it is due), Not due today, Food.`,

  changed: `TASK: Something changed. The family describes something new.
1. FIRST, before anything else: if what they describe could be any warning sign (${WARNING_SIGNS}), say clearly to contact his vet or an emergency vet now. If it sounds mild, still give the warning signs to watch for, in one line, first.
2. Then search flareEpisode (and vetVisit, recordGap) for past episodes that look similar. Frame it strictly as "During past flares, his records show...": how they started and what care was recorded, with dates. Never present past care as instructions for now. Never suggest giving any medication. Never diagnose, predict, or say what it probably is. "This is probably pancreatitis" is forbidden.
3. Then give 2 to 4 questions for his vet, as one-line quotes.
4. If nothing similar is in his history, say so plainly.
Also handle: a new lab result (compare it with his trend and the reference range in labResult, without interpreting it clinically), a new prescription (surface past reactions in his records and warnings in the guide, for example zinc with penicillamine, as questions for his vet), or a new food (check his plan).
Label timing patterns: "Timing only. The records don't show cause."`,

  eat: `TASK: "Can he eat this?"
Check foodItem and dietRule first, then the guide (knowledge base) for diet entries. If his plan lists it, say so with the serving and kcal, and that treats share the 42 kcal a day limit and must be low in copper and sodium. If his plan does not cover it, decline: say the plan does not cover it, and give a one-line question for his vet. Never guess. If it touches the freeze-dried treat conflict, show both sides, labeled "Records disagree, needs confirmation".`,

  sitter: `TASK: "I'm watching Theo." Write a short brief for a sitter.
- Open with exactly this sentence: "The paperwork would get this wrong: ursodiol is on his written list, but don't give it."
- Then medications by time of day. Say which drugs are only due on Monday, Wednesday and Friday. For each, give his vet's instruction as written. Label times "per his vet's instructions" or "per his family's routine". Then meals, the treat rules, foods that are not allowed, and the warning signs with when to contact a vet.
- End with exactly this sentence: "Add your vet's and emergency clinic's phone numbers before you share this."
Keep the whole brief under about 350 words so the closing sentence is never cut off: for treats give only the 42 kcal limit and the low copper and sodium rule, and do not list every approved treat or every ingredient. Never name any clinic or person. There are no phone numbers in his records.`,

  visit: `TASK: "Prep my vet visit."
Use vetQuestion (open ones), recordGap (open ones), the latest vetVisit, and the labs trend. If the family's check-ins are provided below, summarize them first under "Your check-ins since his last visit", labeled as family-entered observations and not vet records, and use them to shape the questions. Do not interpret them medically. If there are none, say so in one line and use record-based questions. Group the answer as: Questions to ask, Records to request.`,

  free: `TASK: A free question. The same rules apply. If his records do not cover it (for example exercise or activity), say "His records don't say" and offer it as a question for his vet.`,
};
