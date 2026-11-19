import { requirementLabel } from "./requirement-sections";

/**
 * What staff should attach for a known requirement document, shown in the attachment picker.
 * Keyed by the stored document name; unknown names (carrier-defined or custom) have no hint.
 */
const HINTS: Record<string, string> = {
  "Valid government-issued ID": "A clear copy of an unexpired government-issued ID with the person's name, photo and signature, such as a passport, driver's license, UMID, PhilSys National ID or PRC ID.",
  "Passport copy": "The photo and details page of the traveler's passport, fully readable.",
  "Completed Travel application form": "The Travel application form, filled in and signed by the client.",
  "Completed regular application form": "The carrier's application form, filled in and signed by the person named.",
  "Completed age 71–100 application form": "The age 71–100 application form, filled in and signed by the person named.",
  "Attestation letter with specimen signatures": "The signed attestation letter showing the person's specimen signatures.",
  "Advisor's Declaration": "The advisor's signed declaration for a remote or online sale.",
  "Payment proof": "The official receipt, deposit slip or transfer confirmation for the client's payment.",
  "Issued Travel policy": "The policy document issued from the carrier portal.",
  "Senior medical examination / physician statement": "The medical examination results or a physician's statement for the person named.",
  "Medical questionnaire or supporting records": "The completed medical questionnaire, or medical records for the declared condition.",
  "Medical questionnaire or supporting medical records": "The completed medical questionnaire, or medical records for the declared condition.",
  "Chest X-ray taken within the last 6 months": "The chest X-ray result, dated within the last 6 months.",
  "Lipid Profile, HbA1c, Creatinine, BUN, Uric Acid, SGOT, SGPT and GGT": "Laboratory results covering every test listed.",
  "ECG": "The ECG result with the physician's reading.",
  "TMST (treadmill stress test)": "The treadmill stress test result with the physician's reading.",
  "Schedule of Benefits of the first-layer HMO": "The client's Schedule of Benefits from their first-layer HMO.",
  "Certificate of Coverage of the first-layer HMO (full maximum benefit limit and expiry date)": "The first-layer HMO certificate showing the full maximum benefit limit and the expiry date.",
  "Treatment Area Limitation (TAL) conforme": "The signed TAL conforme, once underwriting asks for it.",
  "Client Application for Coverage (CAC)": "The signed Client Application for Coverage, once underwriting asks for it.",
};

export function requirementHint(documentName: string): string | null {
  const { title } = requirementLabel({ documentName });
  return Object.hasOwn(HINTS, title) ? HINTS[title] : null;
}
