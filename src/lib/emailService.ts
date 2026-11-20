import { OrderRecord, StoreSettings } from '@/types/store';
import type { OrderEmailEvent } from '@/app/api/notifications/email/route';

export interface SendEmailResult {
  sent: boolean;
  skipped?: boolean;
  to?: string;
  reason?: string;
  error?: string;
}

export async function triggerOrderEmailNotification(params: {
  event: OrderEmailEvent;
  order?: OrderRecord;
  settings: StoreSettings;
  testRecipient?: string;
}): Promise<SendEmailResult> {
  try {
    const res = await fetch('/api/notifications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as SendEmailResult;
    return data;
  } catch (err) {
    return {
      sent: false,
      error:
        err instanceof Error
          ? err.message
          : 'Error de conexión al intentar enviar correo SMTP',
    };
  }
}
