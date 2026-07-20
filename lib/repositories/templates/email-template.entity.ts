/**
 * Domain types for an Email Template — the single source of outbound copy
 * consumed by every composer (Engage, wizard, campaigns, payment links).
 */

export interface EmailTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fields accepted when creating a template. */
export interface NewEmailTemplate {
  name: string;
  channel?: string;
  subject?: string;
  body?: string;
  active?: boolean;
}

/** Fields accepted when updating a template (all optional). */
export interface EmailTemplateUpdate {
  name?: string;
  channel?: string;
  subject?: string;
  body?: string;
  active?: boolean;
}
