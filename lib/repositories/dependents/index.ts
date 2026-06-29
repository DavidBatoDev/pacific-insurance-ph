import type { DependentsRepository } from "./dependents.repository";
import { SupabaseDependentsRepository } from "./dependents.repository.supabase";

let instance: DependentsRepository | null = null;

/** Resolve the Dependents repository (swappable behind the interface). */
export function getDependentsRepository(): DependentsRepository {
  if (!instance) {
    instance = new SupabaseDependentsRepository();
  }
  return instance;
}

export type { DependentsRepository } from "./dependents.repository";
export type { Dependent, NewDependent, DependentUpdate } from "./dependent.entity";
