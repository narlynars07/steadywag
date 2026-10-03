import { sanityFetch } from "./sanity";
import type {
  Dog, DietHistoryEntry, DietRule, Flare, Food, Gap, Guidance, Imaging, LabPoint, LabTestSummary, Medication, Question, Visit, WeightPoint,
} from "./types";

export const getDog = () =>
  sanityFetch<Dog>(`*[_type == "dog"][0]{
    name, breed, sex, neutered, birthYear, about,
    "conditions": conditions[]->{_id, title, status, summary, vetPlan}
  }`);

export const getMedications = () =>
  sanityFetch<Medication[]>(`*[_type == "medication"] | order(startDate asc){
    _id, name, genericName, dose, frequency, days, timeOfDay, purpose, status, startDate, endDate, lastConfirmedOn, notes,
    "source": source{documentType, documentDate, confidence, note}
  }`);

export const getWeights = () =>
  sanityFetch<WeightPoint[]>(`*[_type == "weightEntry"] | order(date asc){
    date, weightKg, bodyConditionScore, note, "confidence": source.confidence
  }`);

export const getVisits = () =>
  sanityFetch<Visit[]>(`*[_type == "vetVisit"] | order(date desc){
    _id, date, visitType, specialty, summary, diagnoses, medicationChanges, recommendations, nextRecheck,
    "source": source{documentType, documentDate, confidence, note}
  }`);

export const getImaging = () =>
  sanityFetch<Imaging[]>(`*[_type == "imagingStudy"] | order(date desc){
    _id, date, modality, headline, comparison, findings, conclusion,
    "source": source{documentType, documentDate, confidence, note}
  }`);

export const getFlares = () =>
  sanityFetch<Flare[]>(`*[_type == "flareEpisode"] | order(startDate desc){
    _id, startDate, dateApproximate, endDate, severity, levelOfCare, signs, supportiveCare, suspectedCause, outcome,
    "source": source{documentType, documentDate, confidence, note}
  }`);

export const getGaps = () =>
  sanityFetch<Gap[]>(`*[_type == "recordGap" && status == "open"] | order(title asc){
    _id, title, kind, why, whereToLook, status, ownerNote, "condition": condition->title
  }`);

export const getQuestions = () =>
  sanityFetch<Question[]>(`*[_type == "vetQuestion" && status == "open"] | order(question asc){
    _id, question, why, status, "condition": condition->title,
    "guidance": guidance->{title, sourceUrl, sourceTitle}
  }`);

export const getFoods = () =>
  sanityFetch<Food[]>(`*[_type == "foodItem"] | order(role asc, name asc){
    _id, name, category, role, kcalPer100g, proteinGPer100g, fatGPer100g, carbGPer100g, copperMgPer100g,
    servingDescription, servingKcal, avoidReason, note, dataSource
  }`);

export const getDietRules = () =>
  sanityFetch<DietRule[]>(`*[_type == "dietRule"] | order(title asc){
    _id, title, kind, nutrient, rule, rationale, setBy,
    "source": source{documentType, documentDate, confidence, note}
  }`);

export const getDietHistory = () =>
  sanityFetch<DietHistoryEntry[]>(`*[_type == "dietHistoryEntry"] | order(order asc){
    _id, order, section, dietType, brand, formula, startedOn, endedOn, origin, beforeDiagnosis,
    "source": source{documentType, documentDate, confidence, note}
  }`);

export const getGuidance = () =>
  sanityFetch<Guidance[]>(`*[_type == "guidance"] | order(title asc){
    _id, title, topic, summary, keyPoints, applicability, sourceTitle, sourceUrl, publisher, year, evidenceType, reviewStatus
  }`);

/** Every lab test that has results, with its latest value. */
export const getLabTests = () =>
  sanityFetch<LabTestSummary[]>(`*[_type == "labTest"]{
    code, name, category, unit, whatItMeasures,
    "count": count(*[_type == "labResult" && references(^._id)]),
    "latest": *[_type == "labResult" && references(^._id)] | order(date desc)[0]{
      date, value, qualifier, flag, refLow, refHigh, unit
    }
  }[count > 0] | order(category asc, code asc)`);

/** All lab results in one request, tagged with the test code, so the explorer can switch tests instantly. */
export const getAllLabResults = () =>
  sanityFetch<(LabPoint & { code: string })[]>(`*[_type == "labResult"] | order(date asc){
    "code": test->code, date, value, qualifier, flag, refLow, refHigh, unit,
    "note": source.note, "confidence": source.confidence
  }`);

export const getLabSeries = (code: string) =>
  sanityFetch<LabPoint[]>(
    `*[_type == "labResult" && test->code == $code] | order(date asc){
      date, value, qualifier, flag, refLow, refHigh, unit, "note": source.note, "confidence": source.confidence
    }`,
    { code },
  );
