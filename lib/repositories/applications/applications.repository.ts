import type { ListOptions } from "../types";
import type { Application, NewApplication, ApplicationUpdate } from "./application.entity";

/** The Applications repository port (same shape as ClientsRepository). */
export interface ApplicationsRepository {
  findById(id: string): Promise<Application | null>;
  /** All applications, joined with client + product names; newest first. */
  list(opts?: ListOptions): Promise<Application[]>;
  /** Applications belonging to one client; newest first. */
  listByClient(clientId: string): Promise<Application[]>;
  create(input: NewApplication): Promise<Application>;
  update(id: string, input: ApplicationUpdate): Promise<Application>;
  /** Authoritative SQL eligibility, also enforced during outbound prepare and claim. */
  medicalReviewProblem(applicationId: string): Promise<string | null>;
  /** Explicit recovery for a historical Yes insured with no questionnaire checklist row. */
  addMedicalQuestionnaire(applicationId: string, input: { actorId: string; subjectKey: string }): Promise<Application>;
  clearMedicalReview(applicationId: string, input: {
    actorId: string;
    medicalClass: string;
    expectedUpdatedAt: string;
    questionnaireRequirements: Record<string, string>;
  }): Promise<Application>;
  /** Hard-delete an application (used when cleaning up a lead's unsubmitted draft). */
  delete(id: string): Promise<void>;
}
