import type {
  EmailTemplate,
  EmailTemplateUpdate,
  NewEmailTemplate,
} from "./email-template.entity";

/** The Email Templates repository port (same shape as ClientsRepository). */
export interface TemplatesRepository {
  findById(id: string): Promise<EmailTemplate | null>;
  /** Composers look templates up by their exact display name. */
  findByName(name: string): Promise<EmailTemplate | null>;
  list(activeOnly?: boolean): Promise<EmailTemplate[]>;
  create(input: NewEmailTemplate): Promise<EmailTemplate>;
  update(id: string, input: EmailTemplateUpdate): Promise<EmailTemplate>;
  delete(id: string): Promise<void>;
}
