import type { TemplatesRepository } from "./templates.repository";
import { SupabaseTemplatesRepository } from "./templates.repository.supabase";

let instance: TemplatesRepository | null = null;

/** Resolve the Email Templates repository (see clients/index.ts for the pattern). */
export function getTemplatesRepository(): TemplatesRepository {
  if (!instance) {
    instance = new SupabaseTemplatesRepository();
  }
  return instance;
}

export type { TemplatesRepository } from "./templates.repository";
export type {
  EmailTemplate,
  NewEmailTemplate,
  EmailTemplateUpdate,
} from "./email-template.entity";
