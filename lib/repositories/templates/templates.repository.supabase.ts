import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type {
  EmailTemplate,
  EmailTemplateUpdate,
  NewEmailTemplate,
} from "./email-template.entity";
import type { TemplatesRepository } from "./templates.repository";

type TemplateRow = Database["public"]["Tables"]["email_templates"]["Row"];
type TemplatePatch = Database["public"]["Tables"]["email_templates"]["Update"];

function toDomain(row: TemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.template_name,
    channel: row.channel,
    subject: row.subject ?? "",
    body: row.body ?? "",
    active: row.status === "Active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link TemplatesRepository}. */
export class SupabaseTemplatesRepository implements TemplatesRepository {
  async findById(id: string): Promise<EmailTemplate | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError("TemplatesRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async findByName(name: string): Promise<EmailTemplate | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("email_templates")
      .select("*")
      .eq("template_name", name)
      .maybeSingle();

    if (error) throw toRepositoryError("TemplatesRepository.findByName", error);
    return data ? toDomain(data) : null;
  }

  async list(activeOnly = false): Promise<EmailTemplate[]> {
    let query = getSupabaseAdmin()
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: true });
    if (activeOnly) query = query.eq("status", "Active");

    const { data, error } = await query;
    if (error) throw toRepositoryError("TemplatesRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewEmailTemplate): Promise<EmailTemplate> {
    const { data, error } = await getSupabaseAdmin()
      .from("email_templates")
      .insert({
        template_name: input.name,
        channel: input.channel ?? "Email",
        subject: input.subject ?? "",
        body: input.body ?? "",
        status: input.active === false ? "Inactive" : "Active",
      })
      .select("*")
      .single();

    if (error) throw toRepositoryError("TemplatesRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: EmailTemplateUpdate): Promise<EmailTemplate> {
    const patch: TemplatePatch = {};
    if (input.name !== undefined) patch.template_name = input.name;
    if (input.channel !== undefined) patch.channel = input.channel;
    if (input.subject !== undefined) patch.subject = input.subject;
    if (input.body !== undefined) patch.body = input.body;
    if (input.active !== undefined) patch.status = input.active ? "Active" : "Inactive";

    const { data, error } = await getSupabaseAdmin()
      .from("email_templates")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw toRepositoryError("TemplatesRepository.update", error);
    return toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("email_templates")
      .delete()
      .eq("id", id);

    if (error) throw toRepositoryError("TemplatesRepository.delete", error);
  }
}
