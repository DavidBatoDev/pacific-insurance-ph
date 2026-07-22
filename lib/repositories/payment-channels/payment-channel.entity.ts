/**
 * Official Payment Channels (Settings → Payment Channels; settings-page.md).
 * Business GCash / company bank accounts that collections route through —
 * never personal accounts. Backs the Send Payment Links payee picker.
 */

export const CHANNEL_TYPES = ["GCash for Business", "Company Bank"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export interface PaymentChannel {
  id: string;
  label: string;
  channelType: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewPaymentChannel {
  label: string;
  channelType: string;
  accountName: string;
  accountNumber: string;
  isDefault?: boolean;
  active?: boolean;
}

export type PaymentChannelUpdate = Partial<NewPaymentChannel>;
