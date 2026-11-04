import type { DocumentRecord } from "@/lib/repositories/documents";

export type RequirementKind = "application" | "claim" | "travel";
export interface RequirementTarget {
  kind: RequirementKind;
  recordId: string;
  requirementId: string;
}
export type AttachmentPickerScope =
  | { type: "requirement"; target: RequirementTarget }
  | { type: "client"; clientId: string };

export interface AttachmentRecordContext {
  kind: string;
  recordId: string;
  label: string;
  requirementId: string | null;
}
export interface RequirementEmailAttachment {
  messageId: string;
  partId: string;
  clientId: string;
  fileName: string;
  mimeType: string;
  size: number;
  subject: string;
  fromAddress: string;
  receivedAt: string;
  sourceRecord: AttachmentRecordContext;
  usages: AttachmentRecordContext[];
  stored: boolean;
  alreadyAttached: boolean;
}
export interface RequirementAttachmentPage {
  items: RequirementEmailAttachment[];
  nextOffset: number | null;
  canUseEmail: boolean;
}

/** Browser selections are staged, never interpreted as a receipt until the target exists. */
export type RequirementAttachmentSelection =
  | { type: "device"; file: File }
  | { type: "email"; attachment: RequirementEmailAttachment; confirmOtherRecord: boolean };

export type RequirementReceiptSource =
  | { type: "upload"; path: string; fileName: string; mimeType: string; size: number }
  | { type: "email"; messageId: string; partId: string; confirmOtherRecord: boolean };

export interface RequirementAttachmentReceipt {
  document: DocumentRecord;
  requirementStatus: "Pending" | "Received" | "Incomplete" | "Verified";
  alreadyAttached: boolean;
}
