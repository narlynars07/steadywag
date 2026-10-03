#!/usr/bin/env python3
"""Build Steadywag's de-identified dataset from Theo's records.

Usage: build_dataset.py <scratch-dir>

<scratch-dir> holds history.txt (pdftotext of the 182-page history) and rec/
(pdftotext of the discharge reports). Output goes to data/private/ only.
Nothing here uploads anything. Loading into Sanity is a separate, approved step.

De-identification rules: first name only, birth year only, no clinic or doctor
names, no owner details, no client or patient IDs. Free text is written in our
own words. Facts that records disagree on carry confidence "conflicting".
"""
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "private"
SCRATCH = Path(sys.argv[1])
HISTORY = SCRATCH / "history.txt"
REC = SCRATCH / "rec"

docs = []
_keys = Counter()


def key(prefix):
    _keys[prefix] += 1
    return f"{prefix}{_keys[prefix]}"


def safe_id(doc_id):
    # A period in a document ID makes the document private to anonymous readers, even in a
    # public dataset. Use dashes so the published data is actually public.
    return doc_id.replace(".", "-")


def ref(doc_id):
    return {"_type": "reference", "_ref": safe_id(doc_id)}


def src(doc_type, date=None, confidence="single-source", note=None):
    s = {"_type": "sourceNote", "documentType": doc_type, "confidence": confidence}
    if date:
        s["documentDate"] = date
    if note:
        s["note"] = note
    return s


def strs(items):
    return list(items)


def refs(ids):
    return [{**ref(i), "_key": key("r")} for i in ids]


def add(doc_type, doc_id, **fields):
    doc_id = safe_id(doc_id)
    d = {"_type": doc_type, "_id": doc_id}
    d.update({k: v for k, v in fields.items() if v is not None})
    docs.append(d)
    return doc_id


def iso(d):
    return datetime.strptime(d, "%m/%d/%Y").strftime("%Y-%m-%d")


# ---------------------------------------------------------------- conditions
COPPER, PANC, TRIG, BILIARY = (
    "condition.copper-hepatopathy",
    "condition.pancreatitis",
    "condition.hypertriglyceridemia",
    "condition.biliary-duct-dilation",
)

# ---------------------------------------------------------------- lab tests
# code -> (name, category, unit, plain-language meaning, conditions)
TESTS = {
    "ALT": ("Alanine aminotransferase", "liver", "U/L", "A liver enzyme that rises when liver cells are damaged or inflamed. The main number followed for copper-related liver disease.", [COPPER]),
    "ALKP": ("Alkaline phosphatase", "liver", "U/L", "An enzyme tied to the bile ducts. It can rise with bile duct problems, pancreatitis, or some medications.", [COPPER, PANC, BILIARY]),
    "GGT": ("Gamma-glutamyl transferase", "liver", "U/L", "Another bile duct enzyme, usually read alongside ALKP.", [BILIARY]),
    "TBIL": ("Total bilirubin", "liver", "mg/dL", "A pigment the liver clears. High levels can show yellowing and bile flow problems.", [COPPER, BILIARY]),
    "ALB": ("Albumin", "chemistry", "g/dL", "A protein made by the liver. Low levels can reflect reduced liver function or protein loss.", [COPPER]),
    "GLOB": ("Globulin", "chemistry", "g/dL", "Proteins that include antibodies. Can rise with inflammation.", []),
    "TP": ("Total protein", "chemistry", "g/dL", "Albumin plus globulin together.", []),
    "BUN/UREA": ("Blood urea nitrogen", "kidney", "mg/dL", "A waste product cleared by the kidneys. Also reflects liver function and protein intake.", [COPPER]),
    "CREA": ("Creatinine", "kidney", "mg/dL", "A waste product used to check kidney function.", []),
    "GLU": ("Glucose", "chemistry", "mg/dL", "Blood sugar.", []),
    "CHOL": ("Cholesterol", "lipids", "mg/dL", "A blood fat. Reported alongside triglycerides.", [TRIG]),
    "TRIG": ("Triglycerides", "lipids", "mg/dL", "A blood fat. Very high levels can contribute to pancreatitis. Checked after fasting.", [TRIG, PANC]),
    "LIPA": ("Lipase", "pancreas", "U/L", "A digestive enzyme. The routine panel value is less specific for pancreatitis than the pancreatic lipase test.", [PANC]),
    "AMYL": ("Amylase", "pancreas", "U/L", "A digestive enzyme, less specific for pancreatitis than the pancreatic lipase test.", [PANC]),
    "CPL": ("Canine pancreatic lipase", "pancreas", "ug/L", "A pancreas-specific blood test used to support a diagnosis of pancreatitis.", [PANC]),
    "Ca": ("Calcium", "chemistry", "mg/dL", "Mineral level.", []),
    "PHOS": ("Phosphorus", "chemistry", "mg/dL", "Mineral level, also reflects kidney function.", []),
    "Sodium": ("Sodium", "chemistry", "mmol/L", "Electrolyte.", []),
    "Potassium": ("Potassium", "chemistry", "mmol/L", "Electrolyte.", []),
    "Chloride": ("Chloride", "chemistry", "mmol/L", "Electrolyte.", []),
    "AST": ("Aspartate aminotransferase", "liver", "U/L", "A liver and muscle enzyme, read alongside ALT.", [COPPER]),
    "BA-PRE": ("Bile acids, before eating", "liver", "", "Measures how well the liver clears bile acids from the blood. Raised values suggest reduced liver function or abnormal blood flow.", [COPPER]),
    "BA-POST": ("Bile acids, after eating", "liver", "", "The same test two hours after a meal, when the liver is working harder.", [COPPER]),
    "HCT": ("Hematocrit", "blood-count", "%", "The share of blood made up of red cells. Low values suggest anemia.", [COPPER]),
    "HGB": ("Hemoglobin", "blood-count", "g/dL", "The oxygen-carrying protein in red cells.", []),
    "RBC": ("Red blood cells", "blood-count", "M/uL", "Red cell count.", []),
    "WBC": ("White blood cells", "blood-count", "K/uL", "Total white cell count, a marker of immune activity.", []),
    "NEUT": ("Neutrophils", "blood-count", "K/uL", "The main infection-fighting white cell. Watched closely on immune-suppressing medication.", []),
    "LYMPHS": ("Lymphocytes", "blood-count", "K/uL", "A white cell type involved in immune responses.", []),
    "PLT": ("Platelets", "blood-count", "K/uL", "Cells that help blood clot.", []),
}
CHEM_SKIP = {"OSM calc", "ALB/GLOB", "BUN/CREA", "Na/K"}
HEMA_KEEP = {"HCT", "HGB", "RBC", "WBC", "NEUT", "LYMPHS", "PLT"}
CHEM_CODES = {"ALB", "ALKP", "ALT", "AMYL", "BUN/UREA", "Ca", "Chloride", "CHOL", "CREA", "GGT", "GLU", "LIPA", "PHOS", "Potassium", "TBIL", "TP", "Sodium", "GLOB"}


def code_id(code):
    return code.replace("/", "-").lower()


def test_id(code):
    return f"labTest.{code_id(code)}"


# ---------------------------------------------------------------- lab results
VISIT_DATES = set()  # filled later; used to link results to visits
results = []  # (date, code, value, qualifier, unit, flag, lo, hi, panel, source_type)

HIST_HDR = re.compile(r"^\s*(\d{1,2}/\d{1,2}/\d{4})\s+(L|C|TC)\s+\S+\s+(.*)$")
HIST_TEST = re.compile(
    r"^\s+(?P<name>[A-Za-z0-9/%\.\-\(\) ]{1,24}?)\s*=\s*(?P<val>[<>]?\s*[\d,]*\.?\d+)\s*"
    r"(?P<unit>[^\s\d][^\s]*)?\s*(?P<flag>H\*?|L\*?)?\s*(?P<lo>-?\d*\.?\d+)?\s*(?:-\s*(?P<hi>\d*\.?\d+))?\s*$"
)


def norm_flag(f):
    f = (f or "").strip("()* ")
    return {"H": "high", "L": "low"}.get(f, "normal")


def num(s):
    return float(s) if s not in (None, "") else None


def parse_history():
    cur = None
    for ln in HISTORY.read_text(encoding="utf8").split("\n"):
        h = HIST_HDR.match(ln)
        if h:
            cur = {"date": iso(h.group(1)), "panel": "Lab"} if h.group(2) == "L" else None
            if cur:
                p = re.search(r"(Chemistry|Hematology)", h.group(3))
                cur["panel"] = p.group(1) if p else "Lab"
            continue
        if not cur:
            continue
        m = HIST_TEST.match(ln)
        if not m:
            continue
        code = m.group("name").strip()
        if code in CHEM_SKIP:
            continue
        keep = (cur["panel"] == "Chemistry" and code in CHEM_CODES) or (cur["panel"] == "Hematology" and code in HEMA_KEEP)
        if not keep:
            continue
        val = m.group("val").replace(" ", "").replace(",", "")
        q = "exact"
        if val[0] in "<>":
            q = "gt" if val[0] == ">" else "lt"
            val = val[1:]
        results.append((cur["date"], code, float(val), q, (m.group("unit") or "").strip(), norm_flag(m.group("flag")),
                        num(m.group("lo")), num(m.group("hi")), cur["panel"], "lab-report"))


DIS_LINE = re.compile(r"^\s*(?P<name>[A-Za-z0-9/%\.\- ]{1,20}?)\s+=\s+(?P<val>[<>]?[\d\.]+)\s+(?P<unit>\S+)\s*(?P<flag>\([HL]\))?\s*(?P<lo>[\d\.]+)?\s*(?:-\s*(?P<hi>[\d\.]+))?\s*$")


def parse_discharge_labs(fname, date):
    text = (REC / fname).read_text(encoding="utf8")
    block = re.search(r"DIAGNOSTICS:(.*?)(PENDING DIAGNOSTICS|ASSESSMENT)", text, re.S)
    if not block:
        return 0
    n = 0
    for ln in block.group(1).split("\n"):
        m = DIS_LINE.match(ln)
        if not m:
            continue
        code = m.group("name").strip()
        if code in CHEM_SKIP or code not in TESTS:
            continue
        panel = "Hematology" if code in HEMA_KEEP else "Chemistry"
        results.append((date, code, float(m.group("val").lstrip("<>")), "exact", m.group("unit"), norm_flag(m.group("flag")),
                        num(m.group("lo")), num(m.group("hi")), panel, "discharge-report"))
        n += 1
    return n


parse_history()
dis_counts = {
    "2025-05-14": parse_discharge_labs("Theodore-331101-1.pdf.txt", "2025-05-14"),
    "2026-03-03": parse_discharge_labs("Theodore-331101-1__1_.pdf.txt", "2026-03-03"),
    "2026-08-25": parse_discharge_labs("Theodore-0825.pdf.txt", "2026-08-25"),
}

# Results stated in the narrative of the reports rather than in a table.
MANUAL = [
    # date, code, value, qualifier, unit, note, confidence, doc type
    ("2025-06-30", "CPL", 2000, "exact", "ug/L", "Reported as 'abnormal Spec cPL 2000' for the June 2025 episode. Approximate date: the exact collection day is not in the records, so it sits at the episode's approximate date.", "single-source", "discharge-report"),
    ("2026-01-28", "CPL", 726.2, "exact", "ug/L", "Emergency visit. Reported as consistent with pancreatitis.", "single-source", "discharge-report"),
    ("2026-03-06", "CPL", 1039, "exact", "ug/L", "Recheck during the fasted blood draw. Still elevated.", "single-source", "discharge-report"),
    ("2026-03-06", "TRIG", 1000, "gt", "mg/dL", "Fasted. Reported as greater than 1000, which is very high.", "single-source", "discharge-report"),
    ("2026-03-31", "TRIG", 144, "exact", "mg/dL", "Recheck about three weeks after starting fenofibrate.", "single-source", "discharge-report"),
    ("2026-03-31", "CPL", 80, "exact", "ug/L", "Listed as 'recheck cPL 80' without a date. Dated to the 3/31 recheck as the most likely draw; confirm.", "conflicting", "discharge-report"),
]

# ---------------------------------------------------------------- visits
VISITS = [
    dict(date="2023-02-17", type="specialist-recheck", summary="Liver enzymes had risen again despite no outward signs. The team planned a liver biopsy if the pancreatic lipase recheck was not explanatory, and continued the liver supplement and weekly vitamin B12 injections.", dx=["Elevated ALT, cause not yet known", "Low vitamin B12", "High cholesterol"], changes="No new medications.", recs=["Keep weekly technician visits for B12 injections", "Liver biopsy is the likely next step"], next="Weekly B12 visits", src=("discharge-report", "confirmed", None)),
    dict(date="2023-06-02", type="specialist-recheck", summary="Copper storage disease had been confirmed by biopsy. Penicillamine was causing vomiting after the morning dose, and he had lost about 1 kg. ALT was still high. The team pushed for the nutrition consult and moved the main anti-nausea medication to Cerenia.", dx=["Copper storage hepatopathy", "New weight loss"], changes="Cerenia preferred over ondansetron. Vitamin B12 and folate started.", recs=["Get the veterinary nutrition consult as soon as possible", "Recheck in 4 to 6 weeks"], next="4 to 6 weeks", src=("discharge-report", "confirmed", None)),
    dict(date="2023-06-30", type="specialist-recheck", summary="Weight was recovering, but liver values were still high. The team listed possible reasons: ongoing inflammation, dietary copper, a supplement interfering with the chelation drug, or an effect of penicillamine itself. Penicillamine was stopped while the diet plan was pending, with zinc therapy mentioned as a later option.", dx=["Copper storage hepatopathy", "Weight loss, improving"], changes="Penicillamine discontinued. Cerenia as needed.", recs=["Contact the team once the nutrition recipe arrives so a baseline can be drawn before switching diets"], next="After the new diet plan", src=("discharge-report", "confirmed", None)),
    dict(date="2025-05-14", type="specialist-recheck", summary="Liver values were still normal after another four months on cyclosporine and prednisone. No concerns at home, normal appetite and energy, stools around score 3. The team kept therapy unchanged.", dx=["Copper storage hepatopathy, ALT normal"], changes="No changes. Penicillamine three times weekly, Cerenia as needed, prednisone, cyclosporine.", recs=["Recheck in 3 to 4 months", "Full bloodwork every year"], next="3 to 4 months", src=("discharge-report", "confirmed", None)),
    dict(date="2026-01-28", type="emergency", summary="Emergency visit after 24 hours without appetite, nausea with one vomit, and dehydration. The pancreatic lipase test supported pancreatitis and X-rays showed gastrointestinal changes. He was treated with fluids and medication and recovered at home.", dx=["Presumptive acute pancreatitis"], changes=None, recs=[], next=None, src=("discharge-report", "single-source", "Described in the March 2026 report, not from the emergency visit's own paperwork.")),
    dict(date="2026-03-03", type="specialist-recheck", summary="Two more flares since the emergency visit. ALKP was newly high while ALT stayed normal. The blood sample looked milky (lipemic), pointing to high blood fats. The team asked for a fasted triglyceride and pancreatic lipase draw and an abdominal ultrasound.", dx=["Copper storage hepatopathy, ALT normal", "New ALKP elevation", "Recurrent presumptive pancreatitis"], changes="No changes.", recs=["Fasted (12 to 15 hour) triglycerides and pancreatic lipase before morning medications", "Drop-off abdominal ultrasound", "Recheck in 4 to 6 months"], next="4 to 6 months", src=("discharge-report", "confirmed", None)),
    dict(date="2026-03-10", type="diagnostics", summary="Results of the fasted draw: pancreatic lipase still elevated at 1039 and triglycerides above 1000. The team felt the high fats could be driving the repeated pancreatitis, and recommended fenofibrate and a low-fat reformulation of the diet.", dx=["Severe hypertriglyceridemia"], changes="Fenofibrate 67 mg once daily prescribed (started 2026-03-11).", recs=["Reformulate the home-cooked diet as low fat with the university nutrition service", "Recheck fasted triglycerides and pancreatic lipase in 6 weeks"], next="6 weeks", src=("lab-report", "confirmed", None)),
    dict(date="2026-04-22", type="imaging", summary="Focused ultrasound and recheck. The cystic liver structure first seen on 3/31 had shrunk dramatically without treatment, which made abscess or tumor very unlikely. The team's working explanation: bile duct widening caused by pancreatitis partly or fully blocking the common bile duct. Ursodiol was prescribed, to be stopped at once if pancreatitis signs returned.", dx=["Cystic liver structure, improving", "Copper storage hepatopathy", "Hypertriglyceridemia, well controlled", "ALKP elevation", "Episodes of pancreatitis"], changes="Ursodiol 80 mg once daily added.", recs=["Recheck focused ultrasound in 4 to 6 weeks", "Pursue the diet reformulation"], next="4 to 6 weeks", src=("discharge-report", "conflicting", "The discharge is dated 4/22 and the radiology report is dated 4/22, but the narrative says he was seen 4/7. Treated as 4/22.")),
    dict(date="2026-06-03", type="imaging", summary="Focused ultrasound showed the suspected bile duct obstruction had resolved, with mild widening remaining where the ducts meet. The pancreas looked small with scarring. The team noted pancreatitis returning could cause another obstruction, and moved back to occasional monitoring with fasted bloodwork.", dx=["Presumed extrahepatic bile duct obstruction, resolved", "Copper storage hepatopathy", "Hypertriglyceridemia"], changes="Fenofibrate, penicillamine and Cerenia continued. Ursodiol still listed.", recs=["Recheck in 2 to 3 months, fasted, with complete bloodwork", "Return to rechecks every 4 to 6 months", "Pursue the diet reformulation"], next="2 to 3 months", src=("discharge-report", "confirmed", None)),
    dict(date="2026-08-25", type="specialist-recheck", summary="Doing very well, with no pancreatitis signs since the triglycerides were controlled. Routine bloodwork looked good after a 15-hour fast. The triglyceride recheck was pending. The team noted the lower-fat diet reformulation had still not been done, and said it could become the main long-term treatment for the triglycerides.", dx=["Copper storage hepatopathy", "Hypertriglyceridemia, well controlled", "ALKP elevation, resolved April 2026", "Pancreatitis episodes and bile duct obstruction, resolved"], changes="No changes.", recs=["Recheck in 4 months, fasted", "Pursue the diet reformulation"], next="4 months", src=("discharge-report", "confirmed", None)),
]
# Second pass: visits found in the full history file and the later email and note entries.
VISITS += [
    dict(date="2022-11-10", type="primary-care", specialty="Primary care", summary="Bloodwork before a planned dental cleaning found a high ALT (366). The family skipped the dental and started liver support with Denamarin. A recheck a month later showed ALT 863, and then above 1000 in January.", dx=["Elevated ALT"], changes="Denamarin 225 mg daily started.", recs=["Recheck bloodwork in a month"], next=None, src=("lab-report", "single-source", "Dates and values come from the history in the first specialist consult.")),
    dict(date="2023-01-20", type="specialist-consult", summary="First internal medicine consult for rising liver enzymes (ALT 366 in November, 863 in December, above 1000 on 1/13). Bile acids were mildly raised and a quick ultrasound at the family vet had shown a small but normal-looking liver. He had no symptoms. The team started a work-up: advanced abdominal imaging, infectious disease tests, and liver aspirates. Possible causes listed: chronic hepatitis, copper storage disease, infectious hepatitis, or pancreatitis. A biopsy was the next step if nothing explained it.", dx=["Elevated ALT, cause not yet known", "Intermittent GI upset and picky appetite (historical)"], changes="No new medications.", recs=["Wait for the pending diagnostics", "Liver biopsy if the work-up does not explain the ALT"], next="Results by phone", src=("discharge-report", "confirmed", None)),
    dict(date="2023-03-10", type="procedure", summary="Laparoscopic liver biopsy under anesthesia, with samples sent for tissue examination, culture and copper measurement. A short course of tramadol was sent home for pain. The results, reported later in March, showed mild chronic lymphocytic hepatitis with copper accumulating inside liver cells (959 micrograms per gram, dry weight): copper storage disease.", dx=["Copper storage hepatopathy, confirmed on biopsy"], changes="Tramadol for pain, short course.", recs=["Exercise restriction while recovering"], next=None, src=("discharge-report", "single-source", "The biopsy result itself comes from the nutrition consult letter and later reports.")),
    dict(date="2023-09-29", type="specialist-recheck", summary="ALT was still high (1407). Penicillamine had been paused while the nutrition service built a diet, and he had been on the new diet for six weeks, with some evening pickiness and not tolerating the eggs. The team laid out options: stop the zinc in the diet, switch to zinc alone, add an immune-suppressing drug, or re-biopsy. The family chose to stop the zinc, restart penicillamine, and ask the nutrition service to reformulate the diet to avoid eggs.", dx=["Copper storage hepatopathy", "Weight loss, improving"], changes="Zinc removed from the diet. Penicillamine restarted. Cerenia as needed.", recs=["Recheck liver values in about 4 weeks", "Send the new recipe to the team once received"], next="4 weeks", src=("discharge-report", "confirmed", None)),
    dict(date="2023-12-08", type="specialist-recheck", summary="ALT 2431, the highest on record, despite zinc being out of the diet and penicillamine restarted about six weeks earlier. The team chose to start prednisone 10 mg daily, picking a steroid so the diet would not need to change, with a possible switch to a different immune-suppressing drug later.", dx=["Copper storage hepatopathy", "Weight loss, resolved"], changes="Prednisone 10 mg daily started.", recs=["Recheck liver values in 4 to 6 weeks"], next="4 to 6 weeks", src=("discharge-report", "confirmed", None)),
    dict(date="2024-01-10", type="technician-visit", summary="Technician bloodwork recheck about a month into prednisone. ALT fell from 2431 to 424. Weight 9.5 kg.", dx=["Copper storage hepatopathy"], changes=None, recs=[], next=None, src=("lab-report", "single-source", "From the ALT trend listed in later reports and a technician note.")),
    dict(date="2024-02-08", type="specialist-recheck", summary="ALT was flat at 425 on prednisone 1 mg per kg. His appetite was up from the steroid. The team doubled prednisone to 20 mg daily (2 mg per kg) and planned a recheck in 2 months, with a second immune-suppressing drug or a repeat biopsy as later options.", dx=["Copper storage hepatopathy"], changes="Prednisone increased from 10 mg to 20 mg daily.", recs=["Recheck liver values in 2 months"], next="2 months", src=("discharge-report", "confirmed", None)),
    dict(date="2024-04-10", type="specialist-recheck", summary="ALT improved a little to 322 on the higher steroid dose. He was hungrier but otherwise well. Options: more time on the current dose, add cyclosporine, or raise prednisone further. The family chose more time.", dx=["Copper storage hepatopathy"], changes="No changes.", recs=["Recheck liver values in 2 months"], next="2 months", src=("discharge-report", "confirmed", None)),
    dict(date="2024-06-13", type="specialist-recheck", summary="ALT dropped to 159. Steroid side effects appeared: thinning hair on the tail, longer urination, and weight gain (10.5 kg, body condition 7 of 9). The team kept the dose, advised cutting his food by 25 percent, and planned to start tapering once ALT was normal.", dx=["Copper storage hepatopathy", "Steroid side effects: tail hair thinning, weight gain"], changes="No medication changes. Food amount reduced by 25 percent.", recs=["Recheck ALT in 2 months", "Reduce food amount by 25 percent"], next="2 months", src=("discharge-report", "confirmed", None)),
    dict(date="2024-08-15", type="specialist-recheck", summary="ALT 132, improved but still not normal. Weight 9.8 kg after the portion change, and the diet was listed with adjusted amounts (1 egg and 75 g chicken). The team planned to start tapering prednisone at the next visit if ALT held steady.", dx=["Copper storage hepatopathy"], changes="No changes.", recs=["Recheck ALT in 2 months"], next="2 months", src=("discharge-report", "confirmed", None)),
    dict(date="2024-10-09", type="specialist-recheck", summary="ALT 139, flat on the long steroid course. The team offered tapering prednisone, or adding cyclosporine so he could eventually come off prednisone. A repeat biopsy was the alternative, because scar tissue can leave ALT mildly raised for life. The family chose cyclosporine, started at a low dose because of his sensitive stomach.", dx=["Copper storage hepatopathy"], changes="Cyclosporine 25 mg twice daily started.", recs=["Recheck bloodwork in 4 to 6 weeks"], next="4 to 6 weeks", src=("discharge-report", "confirmed", None)),
    dict(date="2024-10-16", type="emergency", summary="After a few days on cyclosporine he woke lethargic, refusing food and water, with yellow mucousy diarrhea. The emergency exam was otherwise normal (temperature 102.0, body condition 5 of 9, weight 9.3 kg). A reaction to cyclosporine was suspected. It was stopped, and Entyce and Proviable were prescribed. That night one stool had blood, and he improved the next day.", dx=["Suspected cyclosporine reaction"], changes="Cyclosporine stopped. Entyce and Proviable started.", recs=["Recheck if not eating the next day or if vomiting or diarrhea worsens"], next=None, src=("discharge-report", "confirmed", None)),
    dict(date="2024-12-05", type="specialist-recheck", summary="ALT 115, normal for the first time in this episode, on cyclosporine, restarted 10/29 without trouble, plus prednisone. The blood count showed unexpectedly low neutrophils, repeatable on the machine. The team suspected a machine error, stopped penicillamine and started an antibiotic while a pathologist reviewed the sample. The plan was to taper prednisone first, then cyclosporine, once the blood count was explained.", dx=["Copper storage hepatopathy, ALT normal", "Low neutrophils flagged, pending review"], changes="Penicillamine stopped. An antibiotic (Clavamox) started as a precaution.", recs=["Wait for the pathologist review"], next="Depends on the review", src=("discharge-report", "confirmed", None)),
    dict(date="2024-12-10", type="diagnostics", summary="Pathologist review: neutrophils were normal, with some early inflammation and a mild non-regenerative anemia attributed to his chronic liver disease. Urine had 1+ protein, likely from prednisone. The team stopped the antibiotic, restarted penicillamine at the maintenance schedule (90 mg Monday, Wednesday, Friday) and lowered prednisone to 10 mg daily.", dx=["Mild non-regenerative anemia, chronic disease", "Neutrophils normal on pathologist review"], changes="Antibiotic stopped. Penicillamine restarted three times weekly. Prednisone lowered to 10 mg daily.", recs=["Technician recheck in 4 weeks", "Taper off prednisone after that visit if doing well"], next="4 weeks", src=("lab-report", "confirmed", None)),
    dict(date="2025-01-07", type="technician-visit", summary="Technician recheck four weeks after the December changes. ALT 80 and ALKP 146, both in range, and the blood count was normal. One loose stool the day before. Appetite, water intake and energy normal. Weight 9.3 kg.", dx=["Copper storage hepatopathy, ALT normal"], changes=None, recs=[], next="About 4 months", src=("lab-report", "confirmed", None)),
    dict(date="2025-11-11", type="specialist-recheck", summary="A specialist recheck referred to by the March 2026 report, which says he was doing well at home afterward. No report from this visit is in the records.", dx=[], changes=None, recs=[], next=None, src=("discharge-report", "single-source", "Known only from the next report. The visit's own paperwork is missing.")),
]
for v in VISITS:
    VISIT_DATES.add(v["date"])

# ---------------------------------------------------------------- build
# Lab tests (only those with results)
# Results from before the referral (family vet), stated in the first consult and the February 2023 report.
OUTSIDE_LABS = [
    # date, code, value, qualifier, unit, note, confidence
    ("2022-11-10", "ALT", 366, "exact", "U/L", "Pre-anesthetic bloodwork before a planned dental cleaning at the family vet. This first raised ALT led to the work-up.", "single-source"),
    ("2022-12-07", "ALT", 863, "exact", "U/L", "Family vet recheck about a month after starting liver support.", "single-source"),
    ("2022-12-08", "ALT", 804, "exact", "U/L", "Family vet.", "single-source"),
    ("2022-12-08", "AST", 199, "exact", "U/L", "Family vet.", "single-source"),
    ("2022-12-08", "BA-PRE", 7.4, "exact", "", "Bile acids before eating. Described as mildly raised. Unit not stated in the report; date approximate (the day after the December recheck).", "single-source"),
    ("2022-12-08", "BA-POST", 31.5, "exact", "", "Bile acids after eating. Unit not stated in the report; date approximate.", "single-source"),
    ("2023-01-13", "ALT", 1000, "gt", "U/L", "Reported as greater than 1000. This prompted the referral to the internal medicine specialist.", "single-source"),
]
used_codes = {r[1] for r in results} | {m[1] for m in MANUAL} | {o[1] for o in OUTSIDE_LABS}
for code in sorted(used_codes):
    name, cat, unit, meaning, conds = TESTS[code]
    add("labTest", test_id(code), code=code, name=name, category=cat, unit=unit or None, whatItMeasures=meaning, relevantConditions=refs(conds) if conds else None)

seen_runs = Counter()
for (date, code, value, q, unit, flag, lo, hi, panel, stype) in results:
    seen_runs[(date, code)] += 1
    run = seen_runs[(date, code)]
    rid = f"labResult.{code_id(code)}.{date}" + (f".run{run}" if run > 1 else "")
    note = "A second draw was run on the same day, so two values exist for this test." if run > 1 else None
    add("labResult", rid, date=date, test=ref(test_id(code)), value=value, qualifier=q, unit=unit or None, flag=flag,
        refLow=lo, refHigh=hi, panel=panel, visit=ref(f"vetVisit.{date}") if date in VISIT_DATES else None,
        source=src(stype, date, "confirmed" if stype != "owner-notes" else "single-source", note))

# Results the records themselves call abnormal, elevated or "very elevated", but print without a reference range.
# Flagged high so the site can say "Above range (no range reported)" instead of "No flag".
STATED_HIGH = {("CPL", "2025-06-30"), ("CPL", "2026-01-28"), ("CPL", "2026-03-06"), ("TRIG", "2026-03-06"),
               ("ALT", "2022-11-10"), ("ALT", "2022-12-07"), ("ALT", "2022-12-08"), ("ALT", "2023-01-13"),
               ("BA-PRE", "2022-12-08"), ("BA-POST", "2022-12-08")}

for (date, code, value, q, unit, note, conf, stype) in MANUAL:
    add("labResult", f"labResult.{code_id(code)}.{date}", date=date, test=ref(test_id(code)), value=float(value), qualifier=q, unit=unit,
        flag="high" if (code, date) in STATED_HIGH else None,
        panel="Pancreas / lipids", visit=ref(f"vetVisit.{date}") if date in VISIT_DATES else None, source=src(stype, date, conf, note))

# Weights: (date, kg, bcs, confidence, note)
WEIGHTS = [
    ("2023-01-20", 9.0, 5, "confirmed", None), ("2023-02-17", 8.8, 5, "confirmed", None),
    ("2023-03-30", 8.9, None, "single-source", "From the nutrition consult letter."),
    ("2023-06-02", 8.0, 4, "confirmed", "About 10 percent below the March weight."),
    ("2023-06-30", 8.6, 4, "confirmed", None), ("2023-09-29", 8.6, 4, "confirmed", None),
    ("2023-12-08", 9.0, 4, "confirmed", None), ("2024-02-08", 9.4, 4, "confirmed", None),
    ("2024-04-10", 9.6, 4, "confirmed", None), ("2024-06-13", 10.5, 7, "confirmed", "Highest weight on record."),
    ("2024-08-15", 9.8, 6, "confirmed", None), ("2024-10-09", 9.3, 6, "confirmed", None),
    ("2024-12-05", 9.4, 6, "confirmed", None), ("2025-05-14", 9.2, 6, "confirmed", None),
    ("2026-03-03", 9.5, 6, "confirmed", None), ("2026-04-22", 9.0, 5, "confirmed", "Down 0.4 kg from early April per the report."),
    ("2026-06-03", 9.7, 5, "confirmed", None),
    ("2026-08-25", 10.0, 5, "confirmed", "The August report prints this weight with a 6/3/2026 date label. The owner confirms 10.0 kg is correct, so it is filed under the August visit."),
]
for (date, kg, bcs, conf, note) in WEIGHTS:
    add("weightEntry", f"weightEntry.{date}", date=date, weightKg=kg, bodyConditionScore=bcs, note=note, source=src("discharge-report", date, conf))

# Visits
for v in VISITS:
    st, conf, note = v["src"]
    add("vetVisit", f"vetVisit.{v['date']}", date=v["date"], visitType=v["type"], specialty=v.get("specialty") or ("Internal medicine" if v["type"] != "emergency" else "Emergency"),
        summary=v["summary"], diagnoses=strs(v["dx"]), medicationChanges=v["changes"], recommendations=strs(v["recs"]) or None,
        nextRecheck=v["next"], source=src(st, v["date"], conf, note))

# Imaging
add("imagingStudy", "imagingStudy.2026-03-31", date="2026-03-31", modality="ultrasound", headline="Ultrasound: fluid-filled liver structure and widened bile ducts", comparison="First study of this series",
    findings="A fluid-filled structure in the right lower part of the liver, with tortuous bile ducts beside it, a mildly widened common bile duct, and a twisted, folded section of the small intestine. Signs of active pancreatitis. Chronic-looking changes in the liver and kidneys and a mildly uneven prostate were also noted.",
    conclusion="Concern raised for a focally dilated bile duct versus an abscess, cyst, or poorly formed tumor. Reported through the 4/22 discharge and the CT history.",
    source=src("radiology-report", "2026-03-31", "single-source", "Described in later reports. The original ultrasound report is not in the records."))
add("imagingStudy", "imagingStudy.2026-04-14", date="2026-04-14", modality="ct", headline="CT: widened bile ducts, suspected cholangitis", comparison="Recent abdominal ultrasound",
    findings="Gallbladder moderately to markedly distended. Common bile duct mildly to moderately widened, joined to a saccular widening of bile ducts near the liver's entry point. Separate fluid-filled areas in the liver that do not connect to each other. Right part of the pancreas small with uneven enhancement. Breathing motion limited the view of the upper abdomen.",
    conclusion="Suspected cholangitis. Bile duct widening could come from inflammation or a past common bile duct obstruction. Abscess or tumor judged much less likely. Rounded liver margins suggest chronic hepatitis, consistent with copper storage disease. Suspected chronic pancreatitis in the right limb.",
    source=src("radiology-report", "2026-04-14", "confirmed", "The signed radiology report is dated 4/14/26. The owner's own summary says 4/8; the report takes precedence."))
add("imagingStudy", "imagingStudy.2026-04-22", date="2026-04-22", modality="ultrasound", headline="Ultrasound: liver structure much smaller", comparison="Complete ultrasound of 2026-03-31 and CT of 2026-04-14",
    findings="The large fluid-filled liver structure had shrunk dramatically (from about 4.1 by 2.5 by 2.2 cm to about 2.5 by 0.7 cm). The twisting bile ducts inside the liver were no longer seen and the second structure was gone. Widened bile ducts remained near the liver's entry point. The common bile duct measured about 5 mm near the intestine, down from 6.5 mm. The pancreas looked small and uneven.",
    conclusion="Marked improvement of the liver changes. Working explanation: bile duct widening caused by pancreatitis partly blocking bile flow.",
    source=src("radiology-report", "2026-04-22", "confirmed"))
add("imagingStudy", "imagingStudy.2026-06-03", date="2026-06-03", modality="ultrasound", headline="Ultrasound: suspected bile duct blockage resolved", comparison="Prior focused ultrasound",
    findings="Mild widening where the cystic duct and common bile duct meet, but the rest of the bile tract looked much improved and the duodenal papilla was no longer thickened. Pancreas on the small side with scarring around the body and pancreatic duct.",
    conclusion="Presumed extrahepatic bile duct obstruction resolved. Pancreatitis returning could cause another obstruction.",
    source=src("discharge-report", "2026-06-03", "single-source", "Summarized from the discharge report. The full radiology report is not in the records."))

# Flares
FLARES = [
    ("2025-06-30", None, "moderate", "vet-guidance", ["Vomiting", "Soft stools", "No appetite", "Loose stool with mucus, photographed 6/30/2025"], None, "Presumptive acute pancreatitis", "About 48 hours, resolved with supportive care. Pancreatic lipase test reported abnormal (2000).", "single-source", "Approximate date. The report says only June 2025. Three stool photos taken the morning of 6/30/2025 fall inside the episode and were emailed to the specialist's team on 7/1/2025 for reference, so it is placed at about 6/30/2025. Exact start and end dates are still not in the records."),
    ("2026-01-28", None, "severe", "emergency", ["24 hours without appetite", "Nausea and one vomit", "Dehydration"], "Fluids under the skin and medication.", "Presumptive acute pancreatitis", "Recovered at home. Pancreatic lipase 726.2.", "single-source", None),
    ("2026-02-21", "2026-02-23", "mild", "vet-guidance", ["Refused dinner", "Tired in the evening", "Drank less", "Tacky gums"], "Anti-nausea medication at night, appetite stimulant the next morning, small amounts of diluted electrolyte fluid and broth.", "Presumptive pancreatitis flare", "Appetite returned the next day and he ate small bowls of his home-cooked diet. No vomiting or diarrhea at any point.", "confirmed", None),
    ("2026-02-28", None, "mild", "home", ["Playful in the morning, then tired and not eating in the evening"], "Anti-nausea medication at night, appetite stimulant in the morning.", "Presumptive pancreatitis flare", "Perked up by the afternoon.", "single-source", "The report says 'early March', the weekend after the 2/21 flare. Start date approximated."),
]
APPROX_FLARE_START = {"2025-06-30", "2026-02-28"}  # the records give only a month or a rough time for these
for (s, e, sev, care, signs, supp, cause, outcome, conf, note) in FLARES:
    add("flareEpisode", f"flareEpisode.{s}", startDate=s, endDate=e, dateApproximate=(s in APPROX_FLARE_START), severity=sev, levelOfCare=care, signs=strs(signs), supportiveCare=supp,
        suspectedCause=cause, outcome=outcome, conditions=refs([PANC]), source=src("discharge-report" if conf != "confirmed" else "owner-notes", s, conf, note))

# Medications: (id, name, generic, dose, freq, days, time, purpose, status, start, end, conds, notes, conf, source note)
MEDS = [
    ("denamarin", "Denamarin", "silybin and SAMe", "225 mg", "q24", None, None, "Liver support", "stopped", "2022-11-10", None, [COPPER], "Start date from the owner's summary. Not on the medication list after early 2023.", "single-source"),
    ("cobalamin", "Vitamin B12 (cobalamin)", "cobalamin", "Weekly injection, then 250 mcg by mouth", "weekly, then q24", None, None, "Low B12", "stopped", "2023-01-01", None, [COPPER], "Injection series early 2023, then daily by mouth with folate (200 mcg) by June 2023. Not listed after 2023.", "single-source"),
    ("penicillamine-1", "Penicillamine", "D-penicillamine", "90 mg", "q24, then q12", None, "morning", "Binds copper so the body can clear it", "stopped", "2023-04-16", "2023-06-30", [COPPER], "Started once daily, moved to twice daily on 2023-04-30. Caused vomiting after morning doses. Stopped 6/30/2023.", "confirmed"),
    ("penicillamine-2", "Penicillamine", "D-penicillamine", "90 mg", "q12", None, "morning", "Binds copper so the body can clear it", "stopped", "2023-10-01", "2024-12-05", [COPPER], "Restart date is approximate: the December 2023 report says restarted about six weeks earlier. Stopped 12/5/2024 when a low neutrophil count was found.", "single-source"),
    ("penicillamine-3", "Penicillamine", "D-penicillamine", "90 mg", "x3 weekly", ["mon", "wed", "fri"], None, "Binds copper so the body can clear it", "active", "2024-12-10", None, [COPPER], "Restarted at a lower maintenance schedule on 12/10/2024.", "confirmed"),
    ("ondansetron", "Zofran", "ondansetron", "4 mg", "q24", None, None, "Nausea from penicillamine", "stopped", "2023-05-01", "2023-06-02", [COPPER], "Replaced by Cerenia, which worked better.", "single-source"),
    ("cerenia", "Cerenia", "maropitant", "16 mg", "x3 weekly, plus as needed", ["mon", "wed", "fri"], None, "Prevents nausea and vomiting", "active", "2023-04-30", None, [COPPER, PANC], "Given with penicillamine days and as needed for nausea or poor appetite. Daily during the February 2026 flares.", "confirmed"),
    ("prednisone-1", "Prednisone", "prednisone", "10 mg", "q24", None, "morning", "Calms liver inflammation", "stopped", "2023-12-08", "2024-02-08", [COPPER], "Reports say started December 2023. Exact day approximated to the 12/8 visit.", "single-source"),
    ("prednisone-2", "Prednisone", "prednisone", "20 mg", "q24", None, "morning", "Calms liver inflammation", "stopped", "2024-02-08", "2024-12-10", [COPPER], "Raised February 2024. Day approximated to the 2/8 visit.", "single-source"),
    ("prednisone-3", "Prednisone", "prednisone", "10 mg", "q24", None, "morning", "Calms liver inflammation", "active", "2024-12-10", None, [COPPER], "Lowered on 12/10/2024. A taper was planned once the low neutrophil count was explained.", "confirmed"),
    # Every written report gives Atopica as 25 mg q12 (every 12 hours, twice a day). No time of day is set: the
    # reports do not say which hours, and "morning" alone made the schedule read as once a day.
    ("cyclosporine", "Atopica (cyclosporine)", "cyclosporine", "25 mg", "q12", None, None, "Immune-modulating therapy for chronic hepatitis", "stopped", "2024-10-11", "2024-10-16", [COPPER], "First period.", "confirmed"),
    ("cyclosporine-2", "Atopica (cyclosporine)", "cyclosporine", "25 mg", "q12", None, None, "Immune-modulating therapy for chronic hepatitis", "active", "2024-10-29", None, [COPPER], "Second period.", "confirmed"),
    ("clavamox", "Clavamox", "amoxicillin-clavulanate", "short course", "-", None, None, "Precaution while a low neutrophil count was checked", "stopped", "2024-12-05", "2024-12-10", [], "Stopped 12/10/2024.", "single-source"),
    ("proviable", "Proviable", "probiotic", "1 capsule", "q24", None, "evening", "Gut support", "stopped", "2024-10-01", None, [], "On the May 2025 list. Not on 2026 lists.", "single-source"),
    ("fenofibrate", "Fenofibrate", "fenofibrate", "67 mg", "q24", None, None, "Lowers triglycerides", "active", "2026-03-11", None, [TRIG, PANC], "Prescribed 3/10/2026 after triglycerides above 1000.", "confirmed"),
    ("ursodiol", "Ursodiol", "ursodiol", "80 mg", "q24", None, None, "Bile flow support", "listed-not-given", "2026-04-22", None, [BILIARY], "Prescribed 4/22/2026 with instructions to stop at the first sign of pancreatitis. It is still on the June and August written medication lists, but it was never given: the caregiver at the visit was told verbally not to give it, after the bile duct problem settled by itself. The written record and actual care do not match, and no one who missed the visit would know.", "conflicting"),
]
for (mid, name, generic, dose, freq, days, tod, purpose, status, start, end, conds, notes, conf) in MEDS:
    add("medication", f"medication.{mid}", name=name, genericName=generic, dose=dose, frequency=freq, days=days, timeOfDay=tod, purpose=purpose,
        status=status, startDate=start, endDate=end, conditions=refs(conds) if conds else None, notes=notes, source=src("discharge-report", start, conf))

# Conditions
add("condition", COPPER, title="Copper storage hepatopathy", slug={"_type": "slug", "current": "copper-storage-hepatopathy"}, status="monitoring",
    summary="Copper builds up inside liver cells and causes ongoing liver inflammation. Confirmed by liver biopsy in March 2023 (959 micrograms of copper per gram, dry weight).",
    diagnosedOn="2023-03-10",
    monitoredTests=refs([test_id("ALT"), test_id("ALKP"), test_id("ALB"), test_id("TBIL"), test_id("HCT")]),
    vetPlan="Penicillamine on Monday, Wednesday and Friday to remove copper; prednisone and cyclosporine to calm inflammation; a home-cooked low-copper diet from a veterinary nutritionist; complete bloodwork about every 4 to 6 months, fasted. ALT has been normal since December 2024.",
    source=src("discharge-report", "2026-08-25", "confirmed"))
add("condition", PANC, title="Recurrent pancreatitis", slug={"_type": "slug", "current": "recurrent-pancreatitis"}, status="monitoring",
    summary="Repeated episodes of presumed pancreatic inflammation causing nausea, poor appetite and tiredness. Episodes: June 2025, January 2026 (emergency visit), February 2026, and early March 2026. None reported since triglycerides were brought under control.",
    diagnosedOn="2025-06-30",
    monitoredTests=refs([test_id("CPL"), test_id("TRIG"), test_id("ALKP"), test_id("LIPA")]),
    vetPlan="Supportive care at home for flares (anti-nausea medication, small amounts of fluid and food), contact the team early, and control triglycerides. Stop ursodiol and call the team at the first sign of vomiting, lethargy or reduced appetite.",
    source=src("discharge-report", "2026-04-22", "confirmed"))
add("condition", TRIG, title="Hypertriglyceridemia", slug={"_type": "slug", "current": "hypertriglyceridemia"}, status="monitoring",
    summary="High blood fats that can contribute to pancreatitis. Triglycerides were above 1000 in March 2026 and measured 144 three weeks after starting fenofibrate.",
    diagnosedOn="2026-03-06",
    monitoredTests=refs([test_id("TRIG"), test_id("CHOL"), test_id("CPL")]),
    vetPlan="Fenofibrate 67 mg daily and a recommendation to reformulate the home-cooked diet as low fat with the veterinary nutrition service. Bloodwork must be fasted so triglycerides can be read. The August 2026 report says the diet change has not happened yet and may become the main long-term treatment.",
    source=src("discharge-report", "2026-08-25", "confirmed"))
add("condition", BILIARY, title="Bile duct widening and suspected obstruction", slug={"_type": "slug", "current": "bile-duct-widening"}, status="resolved",
    summary="Imaging in spring 2026 found fluid-filled areas in the liver and widened bile ducts, believed to come from pancreatitis partly blocking the common bile duct. Mostly resolved by June 2026.",
    diagnosedOn="2026-03-31", resolvedOn="2026-06-03",
    monitoredTests=refs([test_id("ALKP"), test_id("GGT"), test_id("TBIL")]),
    vetPlan="Recheck imaging until resolved. The June 2026 report warns that returning pancreatitis could cause another obstruction.",
    source=src("discharge-report", "2026-06-03", "confirmed"))

add("dog", "dog.theodore", name="Theodore", breed="Shih Tzu mix", sex="male", neutered=True, birthYear=2018,
    conditions=refs([COPPER, PANC, TRIG, BILIARY]),
    about="Neutered male Shih Tzu mix, about 8 years old and about 10 kg, managed by a veterinary internal medicine specialist. Eats a home-cooked diet formulated by a university veterinary nutrition service.")

# Diet rules, from the nutrition consult (August 2023) and later specialist reports
add("dietRule", "dietRule.copper", title="Keep dietary copper low", kind="limit", nutrient="copper", setBy="nutritionist",
    rule="The recipe is built to stay below the copper level of veterinary liver diets. Do not add copper-rich ingredients such as organ meats.",
    rationale="Copper restriction is used for primary copper storage disease so the body is not taking in more than it can clear.",
    conditions=refs([COPPER]), source=src("nutrition-consult", "2023-08-02", "confirmed"))
add("dietRule", "dietRule.supplements", title="Give the supplements his current recipe lists", kind="consistency", nutrient="other", setBy="nutritionist",
    rule="Supplements are not optional. They fill nutrient gaps the plain ingredients leave. Add them to the food just before serving and use the specified amounts.",
    rationale="The recipe is computer-balanced for this dog only and includes zinc, omega-3 fish oil, and either a mineral supplement or a vitamin and mineral set.",
    conditions=refs([COPPER]), source=src("nutrition-consult", "2023-08-02", "confirmed"))
add("dietRule", "dietRule.protein", title="Moderate protein, egg preferred", kind="limit", nutrient="protein", setBy="nutritionist",
    rule="The diet provides about 25 percent of calories from protein, mostly from chicken breast and egg.",
    rationale="Liver disease can make high-protein meat diets harder to tolerate. Egg, dairy and vegetable proteins tend to be tolerated better than meat protein.",
    conditions=refs([COPPER]), source=src("nutrition-consult", "2023-08-02", "confirmed"))
add("dietRule", "dietRule.purines", title="Avoid high-purine foods", kind="avoid", nutrient="purines", setBy="nutritionist",
    rule="Avoid organ meats and many seafoods. Most meats and some vegetables, including spinach and asparagus, are moderate. Grains, eggs, dairy and many fruits and vegetables are low.",
    rationale="A struggling liver can leave extra uric acid, which raises the risk of urate stones. Low-purine ingredients reduce that risk.",
    conditions=refs([COPPER]), source=src("nutrition-consult", "2023-08-02", "confirmed"))
add("dietRule", "dietRule.proportions", title="Keep ingredient proportions exact", kind="consistency", nutrient="calories", setBy="nutritionist",
    rule="Change only the total amount fed to keep body condition steady, never the ratios between ingredients. Weigh ingredients with a kitchen scale.",
    rationale="Changing the ratios changes the nutrient balance the recipe was calculated for.",
    conditions=refs([COPPER]), source=src("nutrition-consult", "2023-08-02", "confirmed"))
add("dietRule", "dietRule.plain-chicken", title="Use plain home-cooked chicken", kind="avoid", nutrient="fat", setBy="nutritionist",
    rule="Cook skinless, boneless chicken breast at home. Do not use precooked, deli, canned or marinated chicken.",
    rationale="Those products can be much higher in fat and sodium.",
    conditions=refs([TRIG, PANC]), source=src("nutrition-consult", "2023-08-02", "confirmed"))
add("dietRule", "dietRule.watch-cbc", title="Watch the blood count for signs of copper deficiency", kind="consistency", nutrient="copper", setBy="nutritionist",
    rule="Check the blood count periodically for anemia or other effects of too little copper, especially while a copper-binding drug is combined with a low-copper diet.",
    rationale="Copper deficiency in dogs is rare, but it can happen with chronically low intake.",
    conditions=refs([COPPER]), source=src("nutrition-consult", "2023-08-02", "confirmed"))
add("dietRule", "dietRule.low-fat", title="Reformulate the diet as low fat", kind="limit", nutrient="fat", setBy="specialist",
    rule="The specialist recommended a low-fat reformulation of the recipe with the university nutrition service. Raised on March 10, April 22, June 3 and August 25, 2026, and still not done as of August 2026.",
    rationale="Very high triglycerides can contribute to repeated pancreatitis. The August 2026 report says a lower-fat diet may become the main long-term treatment.",
    conditions=refs([TRIG, PANC]), source=src("discharge-report", "2026-08-25", "confirmed"))

# More diet rules from the August 2023 recipe document
NC = ("nutrition-consult", "2023-08-02", "confirmed")
add("dietRule", "dietRule.recipe", title="The recipe as documented", kind="consistency", nutrient="calories", setBy="nutritionist",
    rule="Original recipe (August 2023, 491 kcal a day): 2 whole eggs (100 g), 50 g raw skinless chicken breast, 70 g dry white rice, half a teaspoon of fish oil, plus the supplement set. Current recipe, as listed in specialist reports since August 2024: 1 large egg, 75 g chicken breast, 70 g white rice, half a teaspoon of fish oil, with salt and a multivitamin.",
    rationale="In September 2023 he was not tolerating the eggs and the family asked the nutrition service to reformulate. Reports through June 2024 list 2 eggs and 50 g chicken. From August 2024 they list 1 egg and 75 g chicken, noting the previous amounts 'before adjusting'. The revised written recipe itself is not in these records.",
    conditions=refs([COPPER, TRIG]), source=src("discharge-report", "2024-08-15", "single-source", "Change documented in specialist reports. The updated recipe document is not in the records."))
add("dietRule", "dietRule.lifelong", title="Stay on the formulated diet and supplements for life", kind="consistency", nutrient="copper", setBy="specialist",
    rule="The specialist's team confirmed in August 2024 that he stays on the nutrition-service diet and supplements for life, as long as he is doing well.",
    rationale="Because of his copper storage disease. The family had asked whether the diet could ever be relaxed once liver values normalized.",
    conditions=refs([COPPER]), source=src("owner-notes", "2024-08-07", "confirmed", "Written reply from the specialist's team to the owner's email."))
add("dietRule", "dietRule.treat-allowance", title="Treats: 42 kcal a day at most", kind="limit", nutrient="calories", setBy="nutritionist",
    rule="Treats should not exceed 42 kcal a day, about 10 percent of daily energy. Keep them low in copper and sodium. Introduce them only after the diet is well tolerated.",
    rationale="More treats than this unbalances the formulated recipe.",
    conditions=refs([COPPER]), source=src(*NC))
add("dietRule", "dietRule.no-other-supplements", title="No other supplements unless the specialist directs", kind="avoid", nutrient="other", setBy="nutritionist",
    rule="Give only the supplements in the recipe. Do not add other dietary supplements unless the specialist directs it.",
    rationale="Avoids nutrient excesses, interactions between nutrients, and possible allergens.",
    conditions=refs([COPPER]), source=src(*NC))
add("dietRule", "dietRule.no-raw-or-jerky", title="No raw animal products and no jerky-style treats", kind="avoid", nutrient="other", setBy="nutritionist",
    rule="Avoid raw animal products, for example freeze-dried raw chicken. Avoid jerky-type treats, including dried sweet potato.",
    rationale="Raw products carry a significant risk of disease-causing bacteria. Jerky-type treats have been associated with kidney injury in dogs.",
    conditions=refs([COPPER]), source=src(*NC))
add("dietRule", "dietRule.toxic-foods", title="Never feed foods that are harmful to dogs", kind="avoid", nutrient="other", setBy="nutritionist",
    rule="Avoid anything with xylitol, chocolate, macadamia nuts, garlic, onions, grapes and raisins.",
    rationale="Each is harmful to dogs.", conditions=refs([COPPER]), source=src(*NC))
add("dietRule", "dietRule.prep-and-storage", title="Preparation and storage", kind="consistency", nutrient="other", setBy="nutritionist",
    rule="Cook ingredients plain, with no oil or seasoning, and keep the cooking liquid for the meals. Mix well so nothing is picked out. Batches without supplements keep 2 to 3 days in the fridge or up to 2 weeks frozen. Add supplements and fish oil just before serving and do not thaw or reheat them.",
    rationale="Reheating can destroy some nutrients. The diet has no preservatives, so check for spoilage.",
    conditions=refs([COPPER]), source=src(*NC))
add("dietRule", "dietRule.fish-oil", title="Fish oil brands are not interchangeable", kind="consistency", nutrient="other", setBy="nutritionist",
    rule="Use the specified fish oil. Another product must be checked for contaminants such as mercury and pesticides, and potency differs widely between brands.",
    rationale="The recipe's omega-3 amount is calculated for the specified product.",
    conditions=refs([TRIG]), source=src(*NC))

# Foods. Nutrient values are per 100 g from USDA FoodData Central (SR Legacy). Treat servings
# and kcal come from the recipe document. Avoid items carry the recipe's reason, no nutrients.
USDA = "USDA FoodData Central (SR Legacy), fdcId {}"
FOODS = [
    # slug, name, category, role, (kcal, protein, fat, carb, copper), fdcId, serving, servingKcal, inPlan, note
    ("egg", "Egg, whole, hard-boiled", "protein", "recipe-ingredient", (155, 12.6, 10.6, 1.12, 0.013), 173424, None, None, True, "Recipe ingredient. Chosen partly because egg protein is tolerated better than meat protein in liver disease."),
    ("chicken-breast", "Chicken breast, roasted, meat only", "protein", "recipe-ingredient", (165, 31.0, 3.57, 0.0, 0.049), 171477, None, None, True, "Recipe ingredient. Cooked at home, plain, never precooked, deli, canned or marinated."),
    ("white-rice", "White rice, long-grain, cooked", "carbohydrate", "recipe-ingredient", (130, 2.69, 0.28, 28.2, 0.069), 168878, None, None, True, "The recipe measures rice dry (70 g). These values are for cooked rice."),
    ("honey", "Honey", "treat", "approved-treat", (304, 0.3, 0.0, 82.4, 0.036), 169640, "1 teaspoon", 20, False, None),
    ("applesauce", "Applesauce, unsweetened", "treat", "approved-treat", (42, 0.17, 0.1, 11.3, 0.027), 167772, "1 tablespoon", 6, False, None),
    ("cottage-cheese", "Cottage cheese, lowfat 2%", "dairy", "approved-treat", (81, 10.4, 2.27, 4.76, 0.033), 172182, "1 tablespoon", 11, False, None),
    ("blueberries", "Blueberries, raw", "treat", "approved-treat", (57, 0.74, 0.33, 14.5, 0.057), 171711, "25 g", 16, False, None),
    ("raspberries", "Raspberries, raw", "treat", "approved-treat", (52, 1.2, 0.65, 11.9, 0.09), 167755, "25 g", 15, False, None),
    ("broccoli", "Broccoli, boiled, no salt", "vegetable", "approved-treat", (35, 2.38, 0.41, 7.18, 0.061), 169967, "30 g", 12, False, None),
    ("zucchini", "Zucchini, raw", "vegetable", "approved-treat", (17, 1.21, 0.32, 3.11, 0.053), 169291, "45 g (about 1/4 cup sliced)", 7, False, None),
]
# Where each food gets its place in his plan: the August 2, 2023 nutrition consult. Nutrient numbers are USDA (dataSource);
# the plan membership is the consult (source). The two are different facts and are recorded separately.
TREAT_SRC = ("The August 2, 2023 nutrition consult lists this in its table of acceptable treats ({serving} provides {kcal} kcal). "
             "The consult says treats can be used once he tolerates the new diet, should be low in copper and sodium, and should not exceed 42 kcal a day.")
RECIPE_SRC = "An ingredient of the formulated recipe in the August 2, 2023 nutrition consult."
for (slug, name, cat, role, (kc, pr, fa, ca, cu), fdc, serving, skcal, inplan, note) in FOODS:
    fsrc = src("nutrition-consult", "2023-08-02", "confirmed", TREAT_SRC.format(serving=serving, kcal=skcal) if role == "approved-treat" else RECIPE_SRC)
    add("foodItem", f"foodItem.{slug}", name=name, category=cat, role=role, kcalPer100g=kc, proteinGPer100g=pr, fatGPer100g=fa,
        carbGPer100g=ca, copperMgPer100g=cu, servingDescription=serving, servingKcal=skcal, inCurrentPlan=(inplan or role == "approved-treat"),
        dataSource=USDA.format(fdc), verified=True, note=note, source=fsrc)
AVOID = [
    ("raw-freeze-dried", "Freeze-dried raw animal-product treats", "Raw animal products carry a significant risk of disease-causing bacteria. The consult named freeze-dried raw chicken as an example."),
    ("jerky-treats", "Jerky-style treats, including dried sweet potato", "Jerky-type treats have been associated with kidney injury in dogs."),
    ("xylitol", "Anything containing xylitol", "Harmful to dogs."),
    ("chocolate", "Chocolate", "Harmful to dogs."),
    ("macadamia", "Macadamia nuts", "Harmful to dogs."),
    ("garlic-onions", "Garlic and onions", "Harmful to dogs."),
    ("grapes-raisins", "Grapes and raisins", "Harmful to dogs."),
]
for (slug, name, reason) in AVOID:
    add("foodItem", f"foodItem.{slug}", name=name, category="other", role="avoid", avoidReason=reason, inCurrentPlan=False,
        dataSource="Nutrition consult, August 2023", verified=True,
        source=src("nutrition-consult", "2023-08-02", "confirmed", "On the avoid list in the August 2, 2023 nutrition consult."))

# Records disagree: the 2026 specialist reports list these treats, and the nutrition plan advises against
# freeze-dried raw products. Neither side is picked. The records do not name the product, say whether it
# is raw, or give its calories.
add("foodItem", "foodItem.freeze-dried-chicken-salmon-treats", name="Freeze-dried chicken and salmon treats", category="treat", role="conflict",
    inCurrentPlan=False, verified=False,
    dataSource="Specialist reports, March to August 2026, and the nutrition consult, August 2023",
    source=src("discharge-report", "2026-08-25", "conflicting", "The 2026 specialist reports list these treats. The August 2023 nutrition consult advises avoiding freeze-dried raw animal products."),
    note=("Records disagree, needs confirmation. The 2026 specialist reports (March through August) list freeze-dried chicken and salmon treats. "
          "The August 2023 nutrition plan advises avoiding freeze-dried raw animal products, keeping treats low in copper and sodium and at or "
          "under 42 kcal a day, and notes that many seafoods are high in purines. The records do not say which products these are, whether "
          "they are raw, or how many calories they add."))

# Diet history: what he ate, from when to when. Kept separate from his current plan (dietRule, foodItem). The earlier diets
# below were told to the nutrition service by the family and written into the August 2, 2023 consult, so they are family
# recall recorded in a document, not a medical finding, and nothing checked them against receipts or labels. The recipe the
# nutrition service then formulated is a record. Anything the family adds later is recall too (documentType owner-notes).
RECALL_NOTE = ("Family recall. This is the diet history the family gave the nutrition service, written into the August 2, 2023 consult. "
               "It is not a medical finding and was not checked against receipts or labels.")
DIET_HISTORY = [
    # order, section, type, brand, formula, started, ended, origin, beforeDx, source
    (1, "adult", "Prepared formulas (type not stated in his records)", "The Farmer's Dog, plus Solid Gold SeaMeal Kelp-Based Daily Supplement",
     "Beef, Chicken and Pork recipes", "June 2021", "November 2022", "family-recall", True, src("family-recall", "2023-08-02", "single-source", RECALL_NOTE)),
    (2, "adult", "Home-cooked, batch-prepared by the family", "The Farmer's Dog Do-It-Yourself Nutrient Mix for Dogs (1 packet per batch)",
     "Boiled chicken breast, rotated every 3 days with sauteed 93% lean ground turkey (turkey since March 2023); 12 oz cooked vegetable mix of white rice, sweet potato, kale, spinach, green beans and/or zucchini",
     "November 2022", "August 2023, when the nutrition service recipe replaced it", "family-recall", True,
     src("family-recall", "2023-08-02", "single-source", RECALL_NOTE + " It began before the March 2023 diagnosis and continued to August 2023.")),
    (3, "adult", "Home-cooked", "Recipe from a university veterinary nutrition service", "Chicken breast, egg, white rice, fish oil, multivitamin",
     "August 2023", "Current", "medical-record", False,
     src("nutrition-consult", "2023-08-02", "confirmed", "The formulated recipe in the August 2, 2023 nutrition consult. Specialist reports since August 2024 list the current version. The revised written recipe is not on file.")),
]
for (order, section, dtype, brand, formula, started, ended, origin, before, dsrc) in DIET_HISTORY:
    add("dietHistoryEntry", f"dietHistoryEntry.{order:02d}", order=order, section=section, dietType=dtype, brand=brand, formula=formula,
        startedOn=started, endedOn=ended, origin=origin, beforeDiagnosis=before, source=dsrc)

# Treats and human foods from the same consult (family recall, written into the consult), and the supplements he has had.
TREATS = [
    # order, name, formula, started, ended
    (10, "Freeze-dried chicken treats (Simply Nourish Source High Protein Grain Free Freeze Dried 100% Real Chicken)", "3 treats every 2 to 3 days", "December 2022",
     "Not recorded. The consult classed it as a raw animal product and advised avoiding it."),
    (11, "Low-fat cheese stick (brand unknown)", None, "January 2020", "December 2022"),
    (12, "Eggs", None, "December 2022", "March 2023, the end of the period the consult covers"),
    (13, "Cottage cheese, 2% milk fat", None, "December 2022", "March 2023, the end of the period the consult covers"),
    (14, "Various other human foods (not listed)", None, "January 2020", "March 2023"),
]
for (order, name, formula, started, ended) in TREATS:
    add("dietHistoryEntry", f"dietHistoryEntry.{order:02d}", order=order, section="treat", dietType="Treat or human food", brand=name, formula=formula,
        startedOn=started, endedOn=ended, origin="family-recall", beforeDiagnosis=True, source=src("family-recall", "2023-08-02", "single-source", RECALL_NOTE))
SUPPS = [
    (20, "Denamarin (liver support)", "November 2022", "Not on his list after early 2023", "single-source", "discharge-report", "2023-01-20", "From the history in the first specialist consult."),
    (21, "Vitamin B12 (cobalamin)", "January 2023", "Injections in early 2023, then daily by mouth. Not listed after 2023", "single-source", "discharge-report", "2023-02-17", "From the February 2023 report and later notes."),
    (22, "Zinc (part of the original home-cooked recipe)", "August 2023", "September 29, 2023. Stopped on the specialist's advice", "confirmed", "discharge-report", "2023-09-29", "Zinc was removed from his diet on the specialist's advice while he takes penicillamine."),
    (23, "Multivitamin and fish oil (part of the home-cooked recipe)", "August 2023", "Current", "confirmed", "nutrition-consult", "2023-08-02", "From the nutrition service recipe."),
]
for (order, name, started, ended, conf, dtype, ddate, note) in SUPPS:
    add("dietHistoryEntry", f"dietHistoryEntry.{order:02d}", order=order, section="supplement", dietType="Supplement", brand=name,
        startedOn=started, endedOn=ended, origin="medical-record", beforeDiagnosis=(order == 20), source=src(dtype, ddate, conf, note))

# Open questions for the vet (grounded in the records)
QUESTIONS = [
    ("q-diet", "Has the low-fat diet reformulation been scheduled with the nutrition service?", "Four reports in a row (March, April, June, August 2026) recommend it, and the August report says it still has not been done. It may become the main long-term treatment for the triglycerides.", TRIG),
    ("q-trig", "What did the 8/25 fasting triglyceride recheck show, and does the plan change?", "The August report says the recheck was pending. The result is not in these records.", TRIG),
    ("q-taper", "Is there a plan to taper prednisone and cyclosporine to the lowest effective doses?", "A December 2024 note planned to taper prednisone and then cyclosporine once the low neutrophil count was explained. He is still on both in 2026.", COPPER),
    ("q-biopsy", "Is a repeat liver biopsy or copper measurement due, or is the ALT trend enough?", "ALT has been normal since December 2024, but these records show no copper measurement since the original biopsy in 2023. Consensus guidance describes repeat biopsy as the best check of treatment response and serial ALT as a useful stand-in.", COPPER),
    ("q-treats", "Are the freeze-dried chicken and salmon treats consistent with the diet plan?", "The 2026 specialist reports (March through August) list freeze-dried chicken and salmon treats. The August 2023 nutrition consult advised avoiding raw animal products such as freeze-dried raw chicken, keeping treats low in copper and sodium and at or under 42 kcal a day, and noted that many seafoods are high in purines. The records do not say which products these are, whether they are raw, or how many calories they add.", COPPER),
    ("q-penicillamine-duration", "A practice article in the guide says penicillamine usually runs 6 to 9 months. He has taken it, with breaks, since 2023. Is long-term maintenance the plan?", "The practice article says penicillamine is usually given for six to nine months alongside a copper-restricted diet. The consensus statement also describes a lower maintenance schedule, once a day, two to three times a week. His records show penicillamine starting in April 2023, with breaks, and a Monday, Wednesday, Friday schedule now. They do not say how long the plan is to continue it.", COPPER),
    ("q-recipe", "Is there an updated written recipe on file from the nutrition service?", "Only the August 2023 recipe (2 eggs, 50 g chicken) is in these records. Reports since August 2024 list an adjusted version (1 egg, 75 g chicken). Anyone covering his meals would need the current written version, and the low-fat reformulation is still pending.", TRIG),
    ("q-ursodiol", "Can the written medication list be corrected so ursodiol is no longer listed?", "It is on the June and August written lists, but it was never given because of a verbal instruction at a visit. Anyone covering his care from the written record would think it is current.", BILIARY),
    ("q-longterm-meds", "How do the long-term risks of prednisone and cyclosporine weigh against what they do for his liver, and what are you watching for?", "He has been on prednisone since December 2023 and cyclosporine since October 2024, and is still on both in 2026. The records on file include his bloodwork but no discussion of long-term effects.", COPPER),
    ("q-meds-bile", "Could any of his medications have contributed to the bile duct or pancreas problems?", "The April 2026 report explains the bile duct widening as pancreatitis partly blocking the duct, and does not say whether medications were considered. Pancreatitis flares are recorded in June 2025 and in January and February 2026. Fenofibrate started March 11, 2026, after those flares, and the duct finding came on March 31, 2026.", BILIARY),
    ("q-liver-pancreas", "Does his liver disease change his risk of pancreatitis?", "The reports connect the spring 2026 bile duct problem to pancreatitis. They do not say whether his copper storage disease makes pancreatitis more likely.", PANC),
]
for (qid, q, why, cond) in QUESTIONS:
    add("vetQuestion", f"vetQuestion.{qid}", question=q, why=why, status="open", condition=ref(cond))

# ---------------------------------------------------------------- second pass
def amend(doc_id, **fields):
    """Correct a document built above, with the reason recorded in its source or note."""
    for d in docs:
        if d["_id"] == safe_id(doc_id):
            d.update(fields)
            return
    raise KeyError(doc_id)


# Results from before the referral
for (date, code, value, q, unit, note, conf) in OUTSIDE_LABS:
    add("labResult", f"labResult.{code_id(code)}.{date}", date=date, test=ref(test_id(code)), value=float(value), qualifier=q, unit=unit or None,
        flag="high" if (code, date) in STATED_HIGH else None,
        panel="Liver (family vet)", visit=ref(f"vetVisit.{date}") if date in VISIT_DATES else None, source=src("lab-report", date, conf, note))

# Early imaging
add("imagingStudy", "imagingStudy.2022-12-08", date="2022-12-08", modality="ultrasound", headline="Quick ultrasound: liver looked normal but small", comparison=None,
    findings="A quick (fast-scan) ultrasound at the family vet, done around the time of the bile acid test. The liver looked within normal limits but very small, with normal blood vessels and liver capsule.",
    conclusion="No explanation yet for the raised liver enzymes.",
    source=src("discharge-report", "2022-12-08", "single-source", "Described in the history of the first consult. Date approximate."))
add("imagingStudy", "imagingStudy.2023-01-20", date="2023-01-20", modality="ct", headline="CT and liver aspirates normal", comparison=None,
    findings="CT of the abdomen and liver aspirates were reported normal. A lymph node near the liver was mildly enlarged. No sign of a liver shunt. Infectious disease testing was all negative.",
    conclusion="Nothing on the CT or the aspirates explained the raised liver enzymes. Pancreatitis was strongly suspected at that point. A repeat check in 3 to 4 weeks was planned, with a liver biopsy if enzymes stayed high. A biopsy followed on 3/10/2023.",
    source=src("radiology-report", "2023-01-20", "single-source", "From the team's 2/1/2023 phone note and the 2/17/2023 report. The original radiology report is an attachment that is not in the records."))

# Weights from technician notes and visits not covered above
for (date, kg, bcs, note) in [
    ("2023-02-03", 8.9, None, None), ("2023-02-10", 8.8, None, None), ("2023-03-03", 9.0, None, None), ("2023-03-10", 8.9, None, "Day of the liver biopsy."),
    ("2023-04-21", 8.5, None, None), ("2024-01-10", 9.5, None, None), ("2024-10-16", 9.3, 5, "Emergency visit."), ("2025-01-07", 9.3, None, "Technician visit."),
]:
    add("weightEntry", f"weightEntry.{date}", date=date, weightKg=kg, bodyConditionScore=bcs, note=note, source=src("discharge-report", date, "single-source", "From a technician or emergency note."))

# The cyclosporine reaction as a timeline episode
add("flareEpisode", "flareEpisode.2024-10-16", startDate="2024-10-16", endDate="2024-10-17", severity="moderate", levelOfCare="emergency",
    signs=["Lethargy", "Refused food and water", "Yellow mucousy diarrhea", "One stool with blood that night"],
    supportiveCare="Cyclosporine stopped. Entyce (appetite stimulant) and Proviable (probiotic) prescribed.",
    suspectedCause="Suspected reaction to cyclosporine", outcome="Improved by the next day, more hungry and alert. Cyclosporine was restarted on 10/29/2024 with the capsules stored in the freezer, and he has tolerated it since.",
    conditions=refs([COPPER]), source=src("discharge-report", "2024-10-16", "confirmed"))

# New medications
add("medication", "medication.entyce", name="Entyce", genericName="capromorelin", dose="oral liquid", frequency="as needed", purpose="Appetite stimulant",
    status="stopped", startDate="2024-10-16", conditions=refs([PANC]), notes="First prescribed at the 10/16/2024 emergency visit and used during the February and March 2026 flares. Not on the regular medication list.",
    source=src("discharge-report", "2024-10-16", "confirmed"))
add("medication", "medication.tramadol", name="Tramadol", genericName="tramadol", dose="25 mg (half of a 50 mg tablet)", frequency="every 8 to 12 hours as needed", purpose="Pain after the liver biopsy",
    status="stopped", startDate="2023-03-10", endDate="2023-03-17", conditions=refs([COPPER]), notes="Short course after the biopsy. End date approximate.",
    source=src("discharge-report", "2023-03-10", "single-source"))

# Corrections to medications built earlier
amend("medication.prednisone-1", startDate="2023-12-08", notes="Started at the 12/8/2023 visit. A steroid was chosen over the other options so the diet would not need to change.", source=src("discharge-report", "2023-12-08", "confirmed"))
amend("medication.prednisone-2", startDate="2024-02-08", notes="Doubled to 2 mg per kg at the 2/8/2024 visit. Side effects over this period: tail hair thinning, longer urination and weight gain.", source=src("discharge-report", "2024-02-08", "confirmed"))
amend("medication.penicillamine-2", startDate="2023-10-24",
      notes="The specialist asked for a restart on 9/29/2023. The 12/8/2023 report says it restarted about six weeks earlier, so about 10/24. Stopped 12/5/2024 while a pathologist reviewed a low neutrophil count. The review found the neutrophils normal, and it was restarted 12/10/2024.",
      source=src("discharge-report", "2023-10-24", "single-source", "Restart date approximate."))
amend("medication.clavamox", notes="An antibiotic started 12/5/2024 as a precaution while the low neutrophil count was reviewed. Stopped 12/10/2024 once the pathologist found the neutrophils normal.")
amend("medication.cyclosporine", notes="Started 10/11/2024 at a low dose because of his sensitive stomach. Stopped 10/16/2024 after a suspected reaction: lethargy, refusing food and water, and loose yellow stool. It restarted 10/29/2024 (second period below).")
amend("medication.cyclosporine-2", notes="Restarted 10/29/2024 after his team and the family agreed the reaction may have been coincidental timing. No recurrence since. The capsules are kept in the freezer to help limit side effects. Same dose as before: 25 mg every 12 hours.")
amend("medication.proviable", startDate="2024-10-16", notes="Started at the 10/16/2024 emergency visit for gut support and continued by the family after cyclosporine was restarted. On the May 2025 list, not on 2026 lists.")

# Corrections to diet rules built earlier
amend("dietRule.supplements", title="Give the supplements his current recipe lists",
      rule="His specialist's reports list added salt and a multivitamin once a day, plus fish oil in the recipe. Give them in the specified amounts, added to the food just before serving. They are not optional, because they fill nutrient gaps the plain ingredients leave. Zinc was part of the August 2023 recipe but was removed on September 29, 2023 on the specialist's advice while he takes penicillamine.",
      rationale="The recipe is computer-balanced for this dog only. The August 2023 recipe included zinc, but the specialist team chose to stop zinc while penicillamine is in use. The current listed diet has fish oil, added salt and a multivitamin.",
      source=src("discharge-report", "2023-09-29", "confirmed", "Recipe document versus the September 29, 2023 specialist decision."))
amend("dietRule.recipe", rationale="In September 2023 he was not tolerating the eggs and the family asked the nutrition service to reformulate. Reports through June 2024 list 2 eggs and 50 g chicken. On June 13, 2024 the specialist advised cutting the portion by 25 percent for weight gain. From August 15, 2024 the reports list 1 egg and 75 g chicken, noting the previous amounts 'before adjusting'. The records do not say whether the nutrition service or the family made that specific change, and the revised recipe document is not in these records.")

# Condition summaries, now that the full timeline is known
amend(COPPER, summary="Copper builds up inside liver cells and causes ongoing liver inflammation. Confirmed by laparoscopic liver biopsy on 3/10/2023: mild chronic lymphocytic hepatitis with copper accumulation (959 micrograms per gram, dry weight). ALT peaked at 2431 in December 2023, fell on prednisone and then cyclosporine, and has been normal since December 2024.")
amend(TRIG, summary="High blood fats that can contribute to pancreatitis. Triglycerides were reported normal in January 2023, above 1000 in March 2026, and 144 three weeks after starting fenofibrate.")
amend(PANC, summary="Repeated episodes of presumed pancreatic inflammation causing nausea, poor appetite and tiredness. Pancreatitis was also suspected in early 2023, before the liver biopsy found copper storage disease. Episodes since: June 2025, January 2026 (emergency visit), February 2026, and early March 2026. None reported since triglycerides were brought under control.")

# The 182-page history on file was itself a hospital export requested in January 2025, so asking for an
# updated one is the most efficient way to close several gaps at once.
UPDATED_EXPORT = "Ask the hospital's records team for an updated patient history report covering everything since January 2025. The 182-page history on file was produced the same way."

# Record gaps: what the chart does not know, found while reconstructing the history.
GAPS = [
    ("nov-2025-visit", "missing-document", "No report for the November 11, 2025 specialist visit",
     "The March 2026 report refers to this visit and says he was doing well afterward, but nothing from the visit itself is on file. It sits between a May 2025 recheck and the first pancreatitis flares of 2026, so it may hold the last baseline before the problems began.",
     ["The specialist's after-visit email, around mid-November 2025", UPDATED_EXPORT, "The hospital's client portal", "The family vet's records, if copies were sent"], COPPER, None),
    ("jan-2026-er", "missing-document", "No paperwork from the January 28, 2026 emergency visit",
     "This was the first emergency visit for pancreatitis. Only the summary in the March 2026 report is on file: pancreatic lipase 726.2 and X-ray changes. The emergency team's own discharge and any medication instructions are missing.",
     ["Emails from the hospital around 1/28 to 2/5/2026", UPDATED_EXPORT, "The hospital's client portal", "The family vet, who may have received a copy"], PANC, None),
    ("aug-2026-triglycerides", "missing-result", "The August 25, 2026 triglyceride result was never recorded",
     "The specialist said the fasting recheck was pending and might change the plan, including whether to revisit a low-fat diet. The result is not in any record on file.",
     ["Email or portal message after 8/25/2026", "Call or message the specialist's team and ask for the 8/25 fasting triglyceride result", UPDATED_EXPORT], TRIG, None),
    ("ursodiol-instruction", "verbal-instruction", "Which visit told the family not to give ursodiol is not recorded",
     "A caregiver was told verbally not to give ursodiol, yet the June and August written medication lists still include it. No note says when or why, so a second caregiver covering his medications would reasonably think it is current.",
     ["Ask the specialist's team to confirm in writing and correct the medication list", "The visit notes from 6/3 and 8/25/2026"], BILIARY,
     "Does not remember which visit it was."),
    ("updated-recipe", "missing-document", "The current written diet recipe is not on file",
     "Only the August 2023 recipe is on file. Reports since August 2024 list a changed version (1 egg and 75 g of chicken breast), and the specialist has repeatedly recommended a new low-fat recipe that has not been made. Anyone covering his meals needs the current written version.",
     ["The nutrition service's emails after September 2023 and in 2024", "Ask the specialist's team which recipe version is current", "Contact the nutrition service directly, since only the 2023 version is on file"], TRIG, None),
    ("june-2025-photos", "missing-document", "No record of the specialist's reply to the June 30, 2025 stool photos",
     "Three photos of loose stool were taken on 6/30/2025, during the first pancreatitis episode, and emailed to the specialist's team on 7/1/2025 for reference. The photos and the email are not tied to any visit note, and nothing shows how the team responded or whether the advice changed. The episode's own exact dates are also missing.",
     ["The email thread around 7/1/2025, including any reply", UPDATED_EXPORT, "Ask the team whether the photos were added to the chart"], PANC,
     "Emailed the photos to the specialist's team on 7/1/2025 for reference, since he was having some issues."),
    ("original-attachments", "missing-document", "Original reports behind several summaries are missing",
     "The 2023 CT report, the tissue report with the copper result, and the outside lab panels (including January 2023 triglycerides) appear only as summaries inside later visit notes. The 959 microgram copper figure and the normal early triglycerides cannot be checked against the original documents.",
     ["Emails and portal attachments from January to March 2023", "The specialist's records department"], COPPER, None),
    ("pre-diagnosis-diet", "missing-document", "Pre-diagnosis diet history",
     "Researchers are studying whether dietary copper contributes to liver copper buildup, so what a dog ate before diagnosis matters most. What exists is family recall written into the August 2023 nutrition consult: the diets he ate from June 2021 on (see the diet history entries). It was not checked against receipts or labels. His puppy diet, his main diet before June 2021, his treats before the recipe, and any chews are not recorded anywhere.",
     ["Online and pet-store order histories", "Photos of old food bags, cans and treat packages", "The breeder or rescue, if there was one", "The family vet's records"], COPPER, None),
]
for (slug, kind, title, why, where, cond, owner_note) in GAPS:
    add("recordGap", f"recordGap.{slug}", title=title, kind=kind, why=why, whereToLook=strs(where), status="open", ownerNote=owner_note, condition=ref(cond))

# ---------------------------------------------------------------- guidance
# Cited veterinary guidance, summarized in our own words with a link to the source. These are the
# entries behind the Knowledge Base. None is veterinarian-reviewed yet. "checked" means the summary
# was compared against the source text; "draft" means it was not.
ACVIM = dict(sourceTitle="ACVIM consensus statement on the diagnosis and treatment of chronic hepatitis in dogs", publisher="Journal of Veterinary Internal Medicine (Webster and colleagues)",
             year=2019, sourceUrl="https://academic.oup.com/jvim/article/33/3/1173/8448093", evidenceType="consensus-statement")
ACVIM_WHO = ("Written by specialist veterinarians for dogs with chronic hepatitis. The evidence on copper-associated hepatitis comes mainly from Bedlington terriers, Labrador retrievers, Doberman pinschers, "
             "West Highland white terriers, Dalmatians and cocker and springer spaniels. Shih Tzus are not among the breeds with strong evidence, although copper-associated hepatitis can occur in other and mixed breeds.")
GUIDANCE = [
    ("acvim-diagnosis", "How copper-associated hepatitis is diagnosed", "diagnosis",
     "Diagnosis needs a liver biopsy that shows chronic hepatitis together with copper building up in liver cells, usually around the central veins of each liver lobe. The tissue is stained for copper and the copper is also measured. Measured levels above about 1000 micrograms per gram of dry liver are typical, and the statement describes a gray zone between 600 and 1000 where the picture is judged together with the tissue findings. Copper can vary from one lobe to another, which is why samples from several lobes are advised.",
     ["Diagnosis needs a liver biopsy with copper staining and a copper measurement", "Levels above about 1000 micrograms per gram dry weight are typical; 600 to 1000 is a gray zone", "Copper varies between lobes, so samples from several lobes are advised", "The statement advises checking every liver biopsy for copper, because it is common and treatable"],
     ACVIM_WHO, ACVIM, "checked"),
    ("acvim-penicillamine", "D-penicillamine: dosing, maintenance and side effects", "treatment",
     "D-penicillamine binds copper in the liver so that it leaves the body in urine. The statement lists a typical dose of 10 to 15 mg per kg twice daily, given 30 minutes before or 2 hours after a meal, and a lower maintenance schedule of once a day, two to three times a week, at about half the dose. Common side effects are nausea, vomiting, reduced appetite and skin reactions. Less common are protein in the urine and a raised ALP. Rare are immune reactions and bone marrow problems. Suggested ways to cope include raising the dose gradually, giving it with a small piece of meat, or adding an anti-nausea drug. The statement says that treating with penicillamine and zinc together is strictly contraindicated.",
     ["Typical dose 10 to 15 mg per kg twice daily, on an empty stomach", "Maintenance: once a day, two to three times a week, at about half the dose", "Common side effects: nausea, vomiting, reduced appetite, skin reactions", "Penicillamine and zinc together are described as strictly contraindicated"],
     ACVIM_WHO, ACVIM, "checked"),
    ("acvim-monitoring", "Monitoring treatment response: ALT and repeat copper measurement", "monitoring",
     "A return of ALT to normal is used as a stand-in for treatment success, but ALT is not sensitive enough to show leftover mild copper accumulation. The statement recommends continuing treatment for a month after ALT normalizes. It says treatment is best judged by measuring liver copper again. With penicillamine plus a copper-restricted diet, copper up to about 1500 micrograms per gram usually normalizes within six months, and higher levels within about nine months. It does not set a fixed re-biopsy schedule or discuss tracking scarring over time.",
     ["Normal ALT is a stand-in for success but can miss mild leftover copper", "Keep treating for a month after ALT normalizes", "Repeat measurement of liver copper is described as the best check of efficacy", "No fixed re-biopsy schedule is given"],
     ACVIM_WHO, ACVIM, "checked"),
    ("acvim-diet-zinc", "Copper-restricted diet for life, and zinc as maintenance", "nutrition",
     "The statement recommends a copper-restricted diet for life, at less than 0.12 mg of copper per 100 kcal, and limiting copper in drinking water (flushing copper pipes for a few minutes is suggested). It says most dogs do not need protein restricted. Zinc can be used as maintenance treatment because it makes the gut bind copper, but it works slowly and is not suited to removing copper. It is not used together with penicillamine.",
     ["Copper-restricted diet for life, below 0.12 mg per 100 kcal", "Limit copper in drinking water", "Zinc is a slow maintenance option, not a way to remove copper", "Do not combine zinc with penicillamine"],
     ACVIM_WHO + " A veterinary nutritionist tailors the plan to the individual dog.", ACVIM, "checked"),
    ("acvim-immunosuppression", "Immune-suppressing drugs in chronic hepatitis", "treatment",
     "Immune-mediated chronic hepatitis is presumed to occur in dogs, but there are no validated criteria or commercial tests to confirm it. The statement advises a careful search for an underlying cause, such as copper, before immune-suppressing treatment, and says such treatment should rest on tissue evidence of a suspected immune process. It does not give drug choices, doses or durations.",
     ["No validated test for immune-mediated hepatitis in dogs", "Look for a primary cause such as copper before immunosuppression", "Drug choices and durations are not covered"],
     ACVIM_WHO, ACVIM, "checked"),
    ("tvp-copper-overview", "Copper hepatopathy in dogs: a practical overview", "diagnosis",
     "A veterinary practice article by Tinoco-Najera and Lidbury (updated February 2023). It says copper accumulation comes from an inherited defect in how the liver handles copper, from too much copper in the diet, or both, and can occur in any breed or mixed breed. Biopsy with special copper stains is the only way to diagnose it. It gives normal liver copper as under 400 mg per kg dry weight and abnormal as over 600. Penicillamine is the usual chelator, typically for six to nine months, with a copper-restricted diet. It notes zinc takes at least three months to work and that its effectiveness is questionable. Progress is followed by ALT or repeat copper measurement.",
     ["Biopsy with copper stains is the only way to diagnose", "Can occur in any breed, including mixed breeds", "Penicillamine usually for 6 to 9 months, with a copper-restricted diet", "Progress followed by ALT or repeat copper measurement"],
     "A practice-oriented review for veterinarians. It states that copper-associated hepatitis can occur in dogs of other breeds or mixed breed, which is relevant to a Shih Tzu mix.",
     dict(sourceTitle="Copper Hepatopathy in Dogs", publisher="Today's Veterinary Practice (Tinoco-Najera and Lidbury)", year=2023, sourceUrl="https://todaysveterinarypractice.com/internal-medicine/copper-hepatopathy-in-dogs/", evidenceType="clinical-reference"), "checked"),
    ("xenoulis-tg-pancreatitis", "Triglycerides and pancreatitis: what one study found", "monitoring",
     "A 2020 study compared dogs with naturally occurring pancreatitis with healthy dogs. Most dogs with pancreatitis (over 70 percent) had triglycerides within the reference interval. About 18 percent had high triglycerides, compared with 7.5 percent of healthy dogs, a difference that was not statistically significant. Samples were taken after fasting for at least 12 hours. The study measured how common high triglycerides are in pancreatitis. It does not give advice on diet or drugs, and it does not say whether very high triglycerides can contribute to pancreatitis in an individual dog.",
     ["Most dogs with pancreatitis had normal triglycerides", "Blood is drawn after fasting for at least 12 hours", "The study does not cover treatment", "It does not rule in or out a contribution from very high triglycerides in one dog"],
     "General population of dogs with pancreatitis and healthy controls. The very high triglyceride level documented in the chart (above 1000 mg/dL) is far above the mild increases seen in this study, and the specialist's report states that high triglycerides can contribute to recurrent pancreatitis episodes.",
     dict(sourceTitle="Serum triglyceride and cholesterol concentrations and lipoprotein profiles in dogs with naturally occurring pancreatitis and healthy control dogs", publisher="Journal of Veterinary Internal Medicine (Xenoulis and colleagues)", year=2020, sourceUrl="https://pmc.ncbi.nlm.nih.gov/articles/PMC7097643", evidenceType="peer-reviewed-study"), "checked"),
    # Restored 2026-10-03: the daily check-in asks for a 1 to 7 stool score and shows these descriptions.
    ("purina-fecal-score", "The 1 to 7 fecal score chart", "monitoring",
     "A widely used chart for describing stool. Score 1 is very hard, dry pellets. Score 2 is ideal: firm but not hard, pliable and segmented. Score 3 is log-shaped and moist, leaving a little residue but holding its form. Score 4 is very moist and soggy and loses its form when picked up. Score 5 is very moist piles with a distinct shape. Score 6 has some texture but no defined shape, in piles or spots. Score 7 is watery with no texture, in flat puddles. The chart describes appearance and is not a diagnosis.",
     ["Score 2 is ideal; scores 3 and 4 are softer", "Scores 5 to 7 are progressively looser", "It describes appearance only"],
     "A general fecal scoring tool for dogs. A dog's own normal can sit a point or so away from the ideal, so his own baseline matters most.",
     dict(sourceTitle="Purina Fecal Scoring Chart", publisher="Purina", year=None, sourceUrl="https://vmc.vet.osu.edu/sites/default/files/documents/purina-fecal-score-chart.pdf", evidenceType="clinical-reference"), "checked"),
    # Both entries below were written from the FULL open-access text (Europe PMC), 2026-10-03, not from summaries.
    ("pancreatitis-bile-duct-obstruction", "When pancreatitis blocks the bile duct: what 46 dogs showed", "monitoring",
     "A 2020 records review from one university hospital looked at 46 dogs whose pancreatitis was linked to a blocked or narrowed common bile duct, the tube that carries bile from the liver to the intestine. A dog was counted if its bilirubin reached 2.0 mg/dL or more and an ultrasound showed the common bile duct wider than 3 mm. Dogs with primary liver disease, gallbladder mucocele, bile duct tumors or obstructive gallstones were left out on purpose. Most dogs got better with medical care alone: 33 of the 42 dogs with a known outcome (79 percent) survived to leave the hospital, and 31 of those 33 had no procedure to drain the bile system. Of the 4 dogs that did have a drainage procedure, 2 died. Recovery was slow. The median time from first signs to the first fall in bilirubin was 15 days. Fever, vomiting and poor appetite often eased before bilirubin peaked, and the authors suspect those signs come mostly from the pancreatitis itself rather than the blockage, so a dog can seem better while blood tests still show it. How wide the duct was and how high the bilirubin went did not predict who survived.",
     ["Pancreatitis is a recognized cause of bile duct blockage in dogs",
      "33 of 42 dogs with a known outcome (79 percent) survived, and 31 of the 33 survivors needed no drainage procedure",
      "Recovery was slow: about two weeks (median 15 days) from first signs to the first fall in bilirubin",
      "Vomiting, fever and poor appetite often eased before bilirubin peaked, so a dog can look better while the blockage still shows in blood tests",
      "Duct width and peak bilirubin did not predict survival",
      "Dogs with primary liver disease were excluded, so the study cannot say whether liver disease changes the risk"],
     "46 client-owned dogs seen at one university hospital between 1999 and 2017, median age 9 years, 18 breeds including 15 mixed-breed dogs and one Shih Tzu. It is a retrospective records review, so treatment varied and tests were not done on a fixed schedule. The authors could not tell acute from chronic pancreatitis without tissue samples. The study does not discuss diet, triglycerides, medications or copper, and it excluded dogs with primary liver disease.",
     dict(sourceTitle="Bile duct obstruction associated with pancreatitis in 46 dogs", publisher="Journal of Veterinary Internal Medicine (Wilkinson and colleagues)", year=2020,
          sourceUrl="https://doi.org/10.1111/jvim.15879", evidenceType="peer-reviewed-study"), "checked"),
    ("acvim-alt-early-detection", "Raised liver enzymes in a dog that looks well: why ALT matters", "diagnosis",
     "The ACVIM consensus statement calls ALT, a liver enzyme measured on routine blood work, the earliest indicator of chronic hepatitis in dogs and the best screening test, because early signs of the disease are vague and nonspecific and obvious illness usually means a later stage. Its key point says a persistent, unexplained ALT increase lasting more than 2 months, with or without other lab changes, is the best screening test currently available for early detection. It notes that up to 20 percent of dogs with chronic hepatitis have raised liver enzymes without any clinical illness, so a dog can look fine while the disease is active. It also says tissue changes of chronic hepatitis can be present even when liver enzymes are not raised, so a normal ALT does not fully rule it out. Bile acid tests are described as too insensitive in early disease to be the reason for deciding on a biopsy.",
     ["ALT is described as the earliest indicator and the best screening test for chronic hepatitis in dogs",
      "Key point: an unexplained ALT increase lasting more than 2 months is the best available early signal",
      "Up to 20 percent of dogs with chronic hepatitis have raised enzymes but no signs of illness",
      "Early signs are vague. Obvious illness usually means later-stage disease",
      "A normal ALT does not completely rule chronic hepatitis out",
      "Bile acid tests are too weak in early disease to decide whether to biopsy"],
     "Specialist consensus, based on expert opinion and published studies of dogs that have the disease. It is not a study that screened healthy dogs. It covers chronic hepatitis from any cause, not only copper. Whether and when to investigate a particular dog's liver enzymes is a decision for that dog's veterinarian.",
     ACVIM, "checked"),
]
# HELD BACK on purpose (decided 2026-10-03): not published, because the site should stay about Theo and a general
# owner resource, not a dog-food regulation debate. Move it back into GUIDANCE to publish. The 'regulator-statement'
# evidence type already exists in the Studio schema.
HELD_BACK_GUIDANCE = [
    # Written from AAFCO's own response (read in full). The JAVMA viewpoint it answers is paywalled and was NOT read,
    # so every claim about the viewpoint below is AAFCO's description of it, and the entry says so.
    ("aafco-copper-response", "Copper in commercial dog food: specialists asked for tighter limits, and the feed regulator declined", "nutrition",
     "In February 2021 a group of veterinary specialists published a viewpoint in the Journal of the American Veterinary Medical Association asking AAFCO, whose Dog Food Nutrient Profiles set recommended nutrient levels for dog food, to do three things: set a maximum for copper in dog food, narrow the recommended copper range to 0.9 to 1.1 mg per 1000 kcal, and allow only copper oxide as an added source of copper. Their concern was that the amount of copper measured in dogs' livers has been rising for decades. AAFCO convened an expert panel that met four times between May 2021 and July 2022, and then declined all three requests. AAFCO agrees that liver copper has risen. It says it is unclear whether the cause is dog food, a change in how copper is measured, the number of samples tested, or genetics in certain breeds. It also says no study since 2006 has established a safe upper limit for dietary copper in dogs, that the proposed range is below the National Academies' recommendation of 1.5 to 3.1 mg per 1000 kcal and would make deficiency likely in growing and nursing dogs, and that copper oxide is essentially not usable by the body. This is an open disagreement between experts, not a settled question.",
     ["The viewpoint asked for a copper maximum, a recommended range of 0.9 to 1.1 mg per 1000 kcal, and copper oxide as the only added source",
      "AAFCO's expert panel met four times from May 2021 to July 2022 and declined all three",
      "Both sides accept that liver copper in dogs has risen. They disagree about whether dog food is the cause",
      "AAFCO says no safe upper limit for dietary copper in dogs has been published since 2006",
      "This is a debate about commercial dog food in general. It is not treatment guidance for a dog that already has copper storage disease"],
     "A policy disagreement about commercial dog foods for dogs in general, not a study. This summary rests on AAFCO's written response, which describes the viewpoint, not on the full text of the viewpoint itself. It does not say how much copper a dog with copper storage disease should eat. That is covered by the specialist consensus entries and by his own veterinary nutrition plan.",
     dict(sourceTitle="Response from AAFCO to JAVMA Viewpoint Article of February 15, 2021", publisher="Association of American Feed Control Officials (AAFCO)", year=None,
          sourceUrl="https://www.aafco.org/wp-content/uploads/2023/03/Response-from-AAFCO-to-JAVMA-Viewpoint-Article-of-February-15-2021.pdf", evidenceType="regulator-statement"), "checked"),
]
for (slug, title, topic, summary, points, who, meta, status) in GUIDANCE:
    add("guidance", f"guidance.{slug}", title=title, topic=topic, summary=summary, keyPoints=strs(points), applicability=who,
        sourceTitle=meta["sourceTitle"], sourceUrl=meta["sourceUrl"], publisher=meta["publisher"], year=meta["year"], evidenceType=meta["evidenceType"],
        reviewStatus=status, conditions=refs([PANC] if "pancreatitis" in slug else ([COPPER, TRIG] if slug == "purina-fecal-score" else [COPPER])))

# The December 2024 analyzer count looked very low, but a pathologist's review found neutrophils normal.
for d in docs:
    if d["_type"] == "labResult" and d["_id"].startswith("labResult-neut-2024-12-05"):
        d["source"] = src("lab-report", "2024-12-05", "conflicting",
                          "Analyzer count flagged low. A pathologist's review of the same sample (reported 12/10/2024) found the neutrophil values normal, so this number is not a reliable low.")
# The most recent specialist report (8/25/2026) lists these as the current medications. Say so on each, so an
# answer about "the latest" does not stop at the date the dose last changed.
for d in docs:
    if d["_type"] == "medication" and d.get("status") == "active":
        d["lastConfirmedOn"] = "2026-08-25"
        d["notes"] = ((d.get("notes") or "").rstrip() + " Still listed as current in the August 25, 2026 specialist report, so no change since then.").strip()
    elif d["_type"] == "medication" and d.get("status") == "listed-not-given":
        d["lastConfirmedOn"] = "2026-08-25"  # still on the written list on that date, though never given
amend("guidance.xenoulis-tg-pancreatitis", conditions=refs([PANC, TRIG]))
amend("guidance.pancreatitis-bile-duct-obstruction", conditions=refs([PANC, BILIARY]))

# Tie questions to the guidance that backs them.
amend("vetQuestion.q-penicillamine-duration", guidance=ref("guidance.tvp-copper-overview"))
amend("vetQuestion.q-biopsy", guidance=ref("guidance.acvim-monitoring"),
      why="ALT has been normal since December 2024, but these records show no copper measurement since the original biopsy in 2023. The consensus statement describes normal ALT as a stand-in for success that can miss mild leftover copper, and says repeat measurement of liver copper is the best check of efficacy. It gives no fixed schedule.")

# ---------------------------------------------------------------- written instructions and family routine
# The vet's own wording from the August 25, 2026 discharge instructions, kept apart from the family's routine.
# Strengths stay in `dose`; these say only how many and how often, exactly as written.
WRITTEN_ON = "2026-08-25"


def written(mid, text, timing=None):
    fields = dict(writtenInstruction=text, writtenInstructionOn=WRITTEN_ON)
    if timing:
        fields["timingNote"] = timing
    amend(f"medication.{mid}", **fields)


written("fenofibrate", "Give 1 capsule by mouth every 24 hours until otherwise directed.")
written("penicillamine-3", "Give 1 tablet by mouth 3 times weekly (Monday, Wednesday, Friday).",
        "His August 2026 list and instruction give no timing. His 2024 instructions, when it was every 12 hours, said to give it 2 hours before or 2 hours after a meal.")
written("cerenia", "Give 1 tablet by mouth every 24 hours as needed for nausea or poor appetite. The medication list in the same report says Monday, Wednesday and Friday.")
written("prednisone-3", "Written as a 20 mg tablet: give 1/2 tablet by mouth every 24 hours until otherwise directed. The medication list in the same report says 10 mg every 24 hours, AM.",
        "His medication list says AM.")
written("cyclosporine-2", "Give 1 capsule by mouth every 12 hours until otherwise directed.",
        "His clinic's notes say to keep the capsules in the freezer to help limit side effects. His written instruction gives no time of day or food guidance.")
written("ursodiol", "Give 1 capsule by mouth every 24 hours until otherwise directed. It is on the written list but was never given.")
# Cerenia: the list and the instruction in the same report disagree. Flag it, do not pick one.
amend("medication.cerenia", source=src("discharge-report", "2026-08-25", "conflicting",
      "The August 25, 2026 medication list says 16 mg on Monday, Wednesday and Friday. The written instruction in the same report says every 24 hours as needed for nausea or poor appetite."))

add("recordGap", "recordGap.cerenia-schedule", title="Cerenia: his medication list and his written instruction disagree", kind="conflict",
    why="His August 25, 2026 medication list says 16 mg on Monday, Wednesday and Friday. The written instruction in the same report says give 1 tablet every 24 hours as needed for nausea or poor appetite. Earlier reports describe it as three times a week plus as needed, and daily during the February 2026 flares. Which schedule is current is not on file.",
    whereToLook=strs(["Ask the specialist's team which schedule is current, and to correct whichever of the two is out of date", "The after-visit instructions from August 25, 2026"]),
    status="open", condition=ref(PANC))
amend("recordGap.ursodiol-instruction", ownerNote="Does not remember which visit it was. The family's sitter routine (September 2026) does not include ursodiol either.")

# The family's own routine: times only, labeled as such. Where his records give timing, the records win.
FR = src("family-routine", "2026-09-01", "single-source",
         "The family's own sitter schedule (September 2026). It supplies times only where his vet's written instructions give none.")


def routine(slug, order, kind, title, time, detail=None, items=None, note=None):
    entries = [{"_type": "routineMedication", "_key": key("ri"), "medication": ref(m), "note": n} for (m, n) in (items or [])]
    add("careRoutine", f"careRoutine.{slug}", title=title, kind=kind, sortOrder=order, timeLabel=time or None, detail=detail,
        items=entries or None, source=note or FR)


routine("breakfast", 10, "meal", "Breakfast", "about 8:00 AM", "Home-cooked food from the bags. Move the bag from the freezer to the fridge ahead of each meal.")
routine("morning-meds", 20, "medication", "Morning medications", "about 8:30 AM, after breakfast",
        "The times are the family's. His vet's written instruction for each drug is shown with it.",
        [("medication.fenofibrate", None), ("medication.prednisone-3", "His medication list says AM"), ("medication.cyclosporine-2", "Capsules kept in the freezer"),
         ("medication.cerenia", "Monday, Wednesday, Friday per his list. His written instruction says as needed. Records disagree.")])
routine("lunch", 30, "meal", "Lunch", "about 2:00 PM", "Home-cooked food from the bags. Move the bag from the freezer to the fridge ahead of time.")
routine("dinner", 40, "meal", "Dinner", "about 8:00 PM", "A smaller portion than the other meals. Home-cooked food from the bags.")
routine("evening-meds", 50, "medication", "Evening medication", "about 8:30 PM", "Every 12 hours after the morning dose.", [("medication.cyclosporine-2", None)])
routine("bedtime-meds", 60, "medication", "Bedtime medication", "at bedtime, on Monday, Wednesday and Friday",
        "Given separately from dinner. His 2024 instruction was 2 hours before or 2 hours after a meal. His August 2026 instruction gives no timing.",
        [("medication.penicillamine-3", None)])
routine("dental-spray", 70, "bedtime", "Dental spray", "before bed", "3 sprays of dental spray. The family reports his vet approved it verbally. It is not in his records.",
        note=src("family-routine", "2026-09-01", "single-source", "Reported by the family as verbally approved by his vet. Nothing in his records says so."))
routine("ursodiol-not-given", 80, "note", "Ursodiol is not part of the routine", "", "The family does not give ursodiol. It is still on his written medication list.")

add("vetQuestion", "vetQuestion.q-dental-spray", question="The family reports his vet approved a dental spray before bed. Can the team note that approval in his chart?",
    why="A verbal approval is not in his records, the same way the ursodiol instruction was never written down. Anyone reading his chart would not know about it.", status="open", condition=ref(COPPER))
add("vetQuestion", "vetQuestion.q-cerenia", question="Which Cerenia schedule is current: Monday, Wednesday and Friday, or every 24 hours as needed?",
    why="His August 25, 2026 medication list says Monday, Wednesday and Friday. The written instruction in the same report says every 24 hours as needed for nausea or poor appetite.", status="open", condition=ref(PANC))

# ---------------------------------------------------------------- final pass
# ---- History page: summary, five chapters, four patterns (text approved 2026-10-03; every claim checked against the records)
HS = lambda note: src("discharge-report", "2026-08-25", "confirmed", note)


def hrefs(*ids):
    return refs(ids)


add("historySummary", "historySummary.theo", title="Theo in 60 seconds",
    body=("Theo's liver problem was found by accident, on bloodwork before a dental cleaning in November 2022. A biopsy in March 2023 showed his liver was storing too much copper. "
          "The first copper-binding drug, penicillamine, made him vomit, so treatment was built in stages: a home-cooked diet from a nutrition service, then prednisone, then Atopica (cyclosporine). "
          "His ALT first came back into the normal range in December 2024. Pancreatitis flares were then recorded between June 2025 and early 2026. "
          "In March 2026 his blood fats were above 1,000, and fenofibrate was started. At his August 25, 2026 visit he was doing very well. "
          "One step keeps being recommended and hasn't happened: a lower-fat diet."),
    sources=hrefs("vetVisit.2022-11-10", "vetVisit.2023-03-10", "medication.penicillamine-1", "medication.prednisone-1", "medication.cyclosporine-2", "labResult.alt-2024-12-05",
                  "flareEpisode.2025-06-30", "flareEpisode.2026-01-28", "labResult.trig-2026-03-06", "medication.fenofibrate", "vetVisit.2026-08-25"),
    source=HS("Written from his visit reports, labs and medication lists. Each claim points at the records listed with it."))

CH = [
    (1, "A surprise on routine bloodwork", "Nov 2022 to Mar 2023", "2022-11-10", "2023-03-31",
     "Bloodwork before a planned dental cleaning found a high ALT. It kept rising with no outward signs. A March 10, 2023 liver biopsy found mild chronic lymphocytic hepatitis, with copper building up in liver cells.",
     ["ALT 366, then 863, then over 1,000", "Liver copper 959 µg/g"], [],
     ["vetVisit.2022-11-10", "vetVisit.2023-01-20", "vetVisit.2023-02-17", "vetVisit.2023-03-10", "labResult.alt-2022-11-10", "labResult.alt-2022-12-07", "labResult.alt-2023-01-13"]),
    (2, "Finding a treatment he could tolerate", "Apr to Dec 2023", "2023-04-01", "2023-12-07",
     "Penicillamine made him vomit after morning doses, and it was stopped on June 30 while the nutrition service built a diet. In September 2023, zinc was taken out of the recipe and penicillamine was restarted. ALT still kept climbing.",
     ["Lost about 1 kg", "ALT peak 2,431 (Dec 8)"], [],
     ["medication.penicillamine-1", "medication.penicillamine-2", "vetVisit.2023-06-02", "vetVisit.2023-06-30", "vetVisit.2023-09-29", "vetVisit.2023-12-08", "labResult.alt-2023-12-08"]),
    (3, "Calming the liver", "Dec 2023 to Dec 2024", "2023-12-08", "2024-12-31",
     "Prednisone started at 10 mg, then was doubled in February 2024. Side effects were thinning tail hair, longer urination and weight gain. Atopica (cyclosporine) was started on October 11, stopped on October 16 after a suspected reaction, and restarted on October 29. His team and the family agreed the reaction may have been coincidental timing.",
     ["ALT 115 on Dec 5, 2024 (first normal)", "Weight up to 10.5 kg in June 2024"], [],
     ["medication.prednisone-1", "medication.prednisone-2", "medication.cyclosporine", "medication.cyclosporine-2", "vetVisit.2024-06-13", "vetVisit.2024-10-16", "vetVisit.2024-12-05", "flareEpisode.2024-10-16", "labResult.alt-2024-12-05"]),
    (4, "Stable liver, new problem", "2025 to early 2026", "2025-01-01", "2026-02-28",
     "His liver values stayed normal. Four presumed pancreatitis flares are on record: June 2025, January 28 (the emergency visit), February 21 and February 28, 2026.",
     ["ALT 80, 90, 88 (all normal)", "4 flares on record"],
     ["No report for the November 11, 2025 specialist visit is in the records", "No paperwork from the January 28, 2026 emergency visit is in the records"],
     ["labResult.alt-2025-01-07", "labResult.alt-2025-05-14", "labResult.alt-2026-03-03", "flareEpisode.2025-06-30", "flareEpisode.2026-01-28", "flareEpisode.2026-02-21", "flareEpisode.2026-02-28",
      "vetVisit.2025-11-11", "recordGap.nov-2025-visit", "recordGap.jan-2026-er"]),
    (5, "Getting it under control", "Mar 2026 to now", "2026-03-01", None,
     "In March his blood looked milky, and a fasted test found triglycerides above 1,000 and pancreatic lipase of 1,039. Fenofibrate started on March 11, and triglycerides were 144 on March 31. Imaging showed bile duct widening that his team linked to pancreatitis. By June the suspected blockage had resolved. In August he was doing very well. The lower-fat diet had still not been done.",
     ["ALT 59 (Aug 25)", "Triglycerides 144 (Mar 31)"],
     ["The August 25, 2026 triglyceride result was never recorded"],
     ["vetVisit.2026-03-03", "vetVisit.2026-03-10", "vetVisit.2026-04-22", "vetVisit.2026-06-03", "vetVisit.2026-08-25", "labResult.trig-2026-03-06", "labResult.cpl-2026-03-06", "labResult.trig-2026-03-31",
      "labResult.alt-2026-08-25", "medication.fenofibrate", "imagingStudy.2026-03-31", "imagingStudy.2026-04-22", "imagingStudy.2026-06-03", "recordGap.aug-2026-triglycerides"]),
]
for n, title, dates, start, end, summary, keys, missing, ids in CH:
    add("historyChapter", f"historyChapter.{n}", order=n, title=title, dates=dates, startDate=start, endDate=end, summary=summary, keyNumbers=strs(keys),
        notInRecords=strs(missing) or None, sources=hrefs(*ids), source=HS("Written from his visit reports, labs and medication lists. Each claim points at the records listed with it."))

PT = [
    (1, "Two of his flares began with a tired evening and refusing food",
     "This was true of the February 21 and February 28, 2026 flares. The others began differently: in June 2025 vomiting and soft stool came first, and in January 2026 it was 24 hours without appetite.", False,
     ["flareEpisode.2026-02-21", "flareEpisode.2026-02-28", "flareEpisode.2025-06-30", "flareEpisode.2026-01-28"]),
    (2, "Two medications were hard on his stomach",
     "Penicillamine caused vomiting in 2023. Atopica (cyclosporine) was stopped after a suspected reaction in October 2024, then restarted, and there has been no recurrence on the record. His team and the family thought the reaction may have been coincidence.", False,
     ["medication.penicillamine-1", "vetVisit.2023-06-02", "medication.cyclosporine", "medication.cyclosporine-2", "flareEpisode.2024-10-16"]),
    (3, "ALT fell after prednisone, and first reached the normal range after Atopica (cyclosporine) was added",
     "ALT fell from 2,431 to 424 in the 33 days after prednisone started. It first read normal (115) on December 5, 2024, after Atopica (cyclosporine) was restarted on October 29.", True,
     ["labResult.alt-2023-12-08", "labResult.alt-2024-01-10", "medication.prednisone-1", "medication.cyclosporine-2", "labResult.alt-2024-12-05"]),
    (4, "A lower-fat diet has been recommended four times",
     "The recommendations are dated March 10, April 22, June 3 and August 25, 2026. The August report notes it had still not been done.", False,
     ["vetVisit.2026-03-10", "vetVisit.2026-04-22", "vetVisit.2026-06-03", "vetVisit.2026-08-25"]),
]
for n, title, body, timing, ids in PT:
    add("historyPattern", f"historyPattern.{n}", order=n, title=title, body=body, timingOnly=timing, sources=hrefs(*ids),
        source=HS("Written from his visit reports, labs and medication lists. Each claim points at the records listed with it."))

# One name for the drug on every page: "Atopica (cyclosporine)". Applies to display text only, never to ids,
# references or the genericName field. Runs last so it covers everything added above.
_ATOPICA = "Atopica (cyclosporine)"
_KEEP = ("_id", "_type", "_ref", "genericName")


def _atopica(o):
    if isinstance(o, dict):
        return {k: (v if k in _KEEP else _atopica(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [_atopica(v) for v in o]
    if isinstance(o, str):
        s = o.replace(_ATOPICA, "\0")
        s = re.sub(r"\b[Cc]yclosporine\b", _ATOPICA, s)
        return s.replace("\0", _ATOPICA)
    return o


docs[:] = [_atopica(d) for d in docs]

# ---------------------------------------------------------------- write
OUT.mkdir(parents=True, exist_ok=True)
with open(OUT / "dataset.ndjson", "w", encoding="utf8") as f:
    for d in docs:
        f.write(json.dumps(d, ensure_ascii=False) + "\n")

by_type = Counter(d["_type"] for d in docs)
summary = {"total": len(docs), "byType": dict(by_type), "dischargeLabCounts": dis_counts}
json.dump(summary, open(OUT / "dataset-summary.json", "w"), indent=2)
print(json.dumps(summary, indent=2))
