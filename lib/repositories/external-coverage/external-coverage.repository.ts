import type { ExternalCoverage, ExternalCoverageUpdate, NewExternalCoverage } from "./external-coverage.entity";

export interface ExternalCoverageRepository {
  listByClient(clientId: string): Promise<ExternalCoverage[]>;
  getById(id: string): Promise<ExternalCoverage | null>;
  create(input: NewExternalCoverage): Promise<ExternalCoverage>;
  update(id: string, patch: ExternalCoverageUpdate): Promise<ExternalCoverage>;
}
