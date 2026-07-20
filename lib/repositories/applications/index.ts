import type { ApplicationsRepository } from "./applications.repository";
import { SupabaseApplicationsRepository } from "./applications.repository.supabase";

let instance: ApplicationsRepository | null = null;

/** Resolve the Applications repository (see clients/index.ts for the pattern). */
export function getApplicationsRepository(): ApplicationsRepository {
  if (!instance) {
    instance = new SupabaseApplicationsRepository();
  }
  return instance;
}

export type { ApplicationsRepository } from "./applications.repository";
export type { Application, NewApplication, ApplicationUpdate } from "./application.entity";
