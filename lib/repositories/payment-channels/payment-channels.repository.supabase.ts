import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type {
  NewPaymentChannel,
  PaymentChannel,
  PaymentChannelUpdate,
} from "./payment-channel.entity";
import type { PaymentChannelsRepository } from "./payment-channels.repository";

type ChannelRow = Database["public"]["Tables"]["payment_channels"]["Row"];

function toDomain(row: ChannelRow): PaymentChannel {
  return {
    id: row.id,
    label: row.label,
    channelType: row.channel_type,
    accountName: row.account_name,
    accountNumber: row.account_number,
    isDefault: row.is_default,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link PaymentChannelsRepository}. */
export class SupabasePaymentChannelsRepository implements PaymentChannelsRepository {
  async list(): Promise<PaymentChannel[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("payment_channels")
      .select("*")
      .order("is_default", { ascending: false })
      .order("label", { ascending: true });
    if (error) throw toRepositoryError("PaymentChannelsRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewPaymentChannel): Promise<PaymentChannel> {
    const { data, error } = await getSupabaseAdmin()
      .from("payment_channels")
      .insert({
        label: input.label,
        channel_type: input.channelType,
        account_name: input.accountName,
        account_number: input.accountNumber,
        ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      })
      .select("*")
      .single();
    if (error) throw toRepositoryError("PaymentChannelsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: PaymentChannelUpdate): Promise<PaymentChannel> {
    const patch: Database["public"]["Tables"]["payment_channels"]["Update"] = {};
    if (input.label !== undefined) patch.label = input.label;
    if (input.channelType !== undefined) patch.channel_type = input.channelType;
    if (input.accountName !== undefined) patch.account_name = input.accountName;
    if (input.accountNumber !== undefined) patch.account_number = input.accountNumber;
    if (input.isDefault !== undefined) patch.is_default = input.isDefault;
    if (input.active !== undefined) patch.active = input.active;

    const { data, error } = await getSupabaseAdmin()
      .from("payment_channels")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw toRepositoryError("PaymentChannelsRepository.update", error);
    return toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("payment_channels").delete().eq("id", id);
    if (error) throw toRepositoryError("PaymentChannelsRepository.delete", error);
  }
}
