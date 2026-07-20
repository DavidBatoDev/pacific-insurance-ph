import type { Application, NewApplication, ApplicationUpdate } from "./application.entity";

/** The Applications repository port (same shape as ClientsRepository). */
export interface ApplicationsRepository {
  findById(id: string): Promise<Application | null>;
  /** All applications, joined with client + product names; newest first. */
  list(): Promise<Application[]>;
  /** Applications belonging to one client; newest first. */
  listByClient(clientId: string): Promise<Application[]>;
  create(input: NewApplication): Promise<Application>;
  update(id: string, input: ApplicationUpdate): Promise<Application>;
}
