import type { Dependent, DependentUpdate, NewDependent } from "./dependent.entity";

/** The Dependents repository port. Follows the canonical repository shape. */
export interface DependentsRepository {
  listByClient(clientId: string): Promise<Dependent[]>;
  findById(id: string): Promise<Dependent | null>;
  create(input: NewDependent): Promise<Dependent>;
  update(id: string, input: DependentUpdate): Promise<Dependent>;
  delete(id: string): Promise<void>;
}
