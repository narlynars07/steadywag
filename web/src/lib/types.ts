export type Confidence = "confirmed" | "single-source" | "conflicting";

export interface SourceNote {
  documentType?: string;
  documentDate?: string;
  confidence?: Confidence;
  note?: string;
}

export interface Dog {
  name: string;
  breed: string;
  sex: string;
  neutered: boolean;
  birthYear: number;
  about: string;
  conditions: { _id: string; title: string; status: string; summary: string; vetPlan: string }[];
}

export interface Medication {
  _id: string;
  name: string;
  genericName?: string;
  dose?: string;
  frequency?: string;
  days?: string[];
  timeOfDay?: string;
  purpose?: string;
  status: "active" | "stopped" | "listed-not-given";
  startDate?: string;
  endDate?: string;
  lastConfirmedOn?: string;
  /** The specialist's own wording (how many, how often) from the latest written instructions. */
  writtenInstruction?: string;
  writtenInstructionOn?: string;
  /** Timing or food guidance that appears in a vet document or clinic note. Times the family uses are in CareRoutine. */
  timingNote?: string;
  notes?: string;
  source?: SourceNote;
}

export interface RoutineItem {
  medicationId: string;
  note?: string;
}

/** The family's own daily routine (their sitter schedule). It supplies times only where his vet's instructions give none. */
export interface CareRoutine {
  _id: string;
  title: string;
  kind: "meal" | "medication" | "bedtime" | "note";
  sortOrder: number;
  timeLabel?: string;
  detail?: string;
  items?: RoutineItem[];
  source?: SourceNote;
}

export interface LabPoint {
  date: string;
  value: number;
  qualifier?: "exact" | "gt" | "lt";
  flag?: "normal" | "high" | "low";
  refLow?: number | null;
  refHigh?: number | null;
  unit?: string;
  note?: string;
  confidence?: Confidence;
}

export interface LabTestSummary {
  code: string;
  name: string;
  category: string;
  unit?: string;
  whatItMeasures?: string;
  count: number;
  latest?: LabPoint;
}

export interface WeightPoint {
  date: string;
  weightKg: number;
  bodyConditionScore?: number | null;
  note?: string;
  confidence?: Confidence;
}

export interface Visit {
  _id: string;
  date: string;
  visitType: string;
  specialty?: string;
  summary: string;
  diagnoses?: string[];
  medicationChanges?: string;
  recommendations?: string[];
  nextRecheck?: string;
  source?: SourceNote;
}

export interface Imaging {
  _id: string;
  date: string;
  modality: string;
  headline?: string;
  comparison?: string;
  findings?: string;
  conclusion?: string;
  source?: SourceNote;
}

export interface Flare {
  _id: string;
  startDate: string;
  /** True when the records give only a month or a rough time, so the site shows "about" before the date. */
  dateApproximate?: boolean | null;
  endDate?: string;
  severity?: string;
  levelOfCare?: string;
  signs?: string[];
  supportiveCare?: string;
  suspectedCause?: string;
  outcome?: string;
  source?: SourceNote;
}

export interface Gap {
  _id: string;
  title: string;
  kind: string;
  why: string;
  whereToLook?: string[];
  status: string;
  ownerNote?: string;
  condition?: string;
}

export interface Question {
  _id: string;
  question: string;
  why?: string;
  status: string;
  condition?: string;
  guidance?: { title: string; sourceUrl: string; sourceTitle: string } | null;
}

export interface Food {
  _id: string;
  name: string;
  category?: string;
  role?: "recipe-ingredient" | "approved-treat" | "avoid" | "conflict";
  kcalPer100g?: number;
  proteinGPer100g?: number;
  fatGPer100g?: number;
  carbGPer100g?: number;
  copperMgPer100g?: number;
  servingDescription?: string;
  servingKcal?: number;
  avoidReason?: string;
  note?: string;
  dataSource?: string;
}

export interface DietHistoryEntry {
  _id: string;
  order: number;
  section: "adult" | "treat" | "chew" | "puppy" | "supplement";
  dietType?: string;
  brand?: string;
  formula?: string;
  startedOn?: string;
  endedOn?: string;
  /** "family-recall" is what the family remembers. "medical-record" is stated by a document. */
  origin: "family-recall" | "medical-record";
  beforeDiagnosis?: boolean;
  source?: SourceNote;
}

export interface DietRule {
  _id: string;
  title: string;
  kind?: string;
  nutrient?: string;
  rule: string;
  rationale?: string;
  setBy?: string;
  source?: SourceNote;
}

export interface Guidance {
  _id: string;
  title: string;
  topic?: string;
  summary: string;
  keyPoints?: string[];
  applicability?: string;
  sourceTitle: string;
  sourceUrl: string;
  publisher?: string;
  year?: number;
  evidenceType?: string;
  reviewStatus?: string;
}

/** A record a history chapter or pattern rests on. Enough to name it and link to the page that shows it. */
export interface HistorySource {
  _id: string;
  _type: string;
  date?: string;
  name?: string;
  code?: string;
  value?: number;
}

export interface HistorySummary { _id: string; title: string; body: string; sources?: HistorySource[] }

export interface HistoryChapter {
  _id: string;
  order: number;
  title: string;
  dates?: string;
  startDate: string;
  endDate?: string;
  summary: string;
  keyNumbers?: string[];
  notInRecords?: string[];
  sources?: HistorySource[];
}

export interface HistoryPattern { _id: string; order: number; title: string; body: string; timingOnly?: boolean; sources?: HistorySource[] }

/** Something one family has noticed while caring for him. An observation, never advice. */
export interface FamilyNote { _id: string; order: number; title: string; body: string; directedBy?: "family" | "vet"; askYourVet?: string }
