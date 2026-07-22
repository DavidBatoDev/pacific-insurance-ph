import type {
  NewPaymentChannel,
  PaymentChannel,
  PaymentChannelUpdate,
} from "./payment-channel.entity";

/** The Payment Channels repository port (same shape as ClientsRepository). */
export interface PaymentChannelsRepository {
  /** All channels, default first then by label. */
  list(): Promise<PaymentChannel[]>;
  create(input: NewPaymentChannel): Promise<PaymentChannel>;
  update(id: string, input: PaymentChannelUpdate): Promise<PaymentChannel>;
  delete(id: string): Promise<void>;
}
