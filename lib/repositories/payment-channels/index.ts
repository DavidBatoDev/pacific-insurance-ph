import type { PaymentChannelsRepository } from "./payment-channels.repository";
import { SupabasePaymentChannelsRepository } from "./payment-channels.repository.supabase";

let instance: PaymentChannelsRepository | null = null;

/** Resolve the Payment Channels repository (see clients/index.ts for the pattern). */
export function getPaymentChannelsRepository(): PaymentChannelsRepository {
  if (!instance) {
    instance = new SupabasePaymentChannelsRepository();
  }
  return instance;
}

export type { PaymentChannelsRepository } from "./payment-channels.repository";
export type {
  PaymentChannel,
  NewPaymentChannel,
  PaymentChannelUpdate,
} from "./payment-channel.entity";
