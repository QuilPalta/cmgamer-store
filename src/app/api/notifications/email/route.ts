import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { OrderRecord, SmtpConfig, StoreSettings } from '@/types/store';

export type OrderEmailEvent =
  | 'ORDER_RECEIVED'
  | 'STOCK_CONFIRMED_AWAITING_PAYMENT'
  | 'PAID_READY_FOR_DELIVERY'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'TEST_EMAIL';

interface EmailRequestBody {
  event: OrderEmailEvent;
  order?: OrderRecord;
  settings: StoreSettings;
  testRecipient?: string;
}

function formatClpServer(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function resolveSmtpCredentials(runtimeConfig?: SmtpConfig) {
  const envHost = process.env.SMTP_HOST || '';
  const envUser = process.env.SMTP_USER || '';
  const envPass = process.env.SMTP_PASS || '';
  const envPort = parseInt(process.env.SMTP_PORT || '465', 10) || 465;
  const envSecure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : envPort === 465;
  const envFrom = process.env.SMTP_FROM || '';
  const envAdminCopy = process.env.SMTP_ADMIN_COPY_EMAIL || '';

  const useRuntime = Boolean(
    runtimeConfig?.enabled &&
      runtimeConfig.host?.trim() &&
      runtimeConfig.user?.trim() &&
      runtimeConfig.pass?.trim()
  );

  if (useRuntime && runtimeConfig) {
    const fromEmail =
      runtimeConfig.from_email?.trim() || runtimeConfig.user.trim();
    const fromName = runtimeConfig.from_name?.trim() || 'CM GAMER';
    return {
      host: runtimeConfig.host.trim(),
      port: Number(runtimeConfig.port) || 465,
      secure: Boolean(runtimeConfig.secure),
      user: runtimeConfig.user.trim(),
      pass: runtimeConfig.pass.trim(),
      from: `"${fromName}" <${fromEmail}>`,
      adminCopyEmail: runtimeConfig.admin_copy_email?.trim() || fromEmail,
    };
  }

  if (envHost && envUser && envPass) {
    return {
      host: envHost.trim(),
      port: envPort,
      secure: envSecure,
      user: envUser.trim(),
      pass: envPass.trim(),
      from: envFrom.trim() || `"CM GAMER" <${envUser.trim()}>`,
      adminCopyEmail: envAdminCopy.trim() || envUser.trim(),
    };
  }

  return null;
}

function buildItemsTableHtml(order: OrderRecord): string {
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #27272a;color:#fafafa;font-weight:600;">
          ${i.quantity}x ${i.item_name}
          ${
            i.item_summary
              ? `<div style="font-size:11px;color:#a1a1aa;font-weight:400;margin-top:2px;">${i.item_summary}</div>`
              : ''
          }
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #27272a;text-align:right;color:#ef4444;font-weight:700;white-space:nowrap;">
          ${formatClpServer(i.quantity * i.unit_price_clp)}
        </td>
      </tr>`
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#09090b;">
          <th align="left" style="padding:10px 8px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Detalle</th>
          <th align="right" style="padding:10px 8px;font-size:11px;text-transform:uppercase;color:#a1a1aa;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function buildEmailContent(
  event: OrderEmailEvent,
  settings: StoreSettings,
  order?: OrderRecord
): { subject: string; html: string } {
  const storeName = settings.store_name || 'CM GAMER';

  if (event === 'TEST_EMAIL') {
    return {
      subject: `Correo de Prueba — SMTP de ${storeName} conectado`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e4e4e7;padding:28px;border-radius:16px;border:1px solid #27272a;">
          <h2 style="color:#ef4444;margin-top:0;">SMTP de ${storeName} funcionando</h2>
          <p style="font-size:14px;line-height:1.6;">
            Este es un correo de prueba enviado desde el panel de administración de <strong>${storeName}</strong>.
          </p>
          <p style="font-size:13px;color:#a1a1aa;line-height:1.6;">
            Tus clientes recibirán notificaciones automáticas al ingresar un pedido, cuando confirmes stock y envíes datos de transferencia, cuando confirmes el pago y cuando marques la entrega.
          </p>
        </div>
      `,
    };
  }

  if (!order) {
    throw new Error('Se requiere el objeto order para este evento de correo.');
  }

  const itemsHtml = buildItemsTableHtml(order);
  const b = settings.bank_details;

  const bankBoxHtml = `
    <div style="background:#18181b;border:1px solid #dc2626;border-radius:12px;padding:16px;margin:18px 0;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">
        Datos para Transferencia Bancaria
      </div>
      <div style="font-size:14px;color:#ffffff;margin-bottom:10px;">
        Monto exacto a transferir: <strong style="color:#ef4444;font-size:18px;">${formatClpServer(
          order.total_clp
        )}</strong>
      </div>
      <div style="font-size:13px;color:#d4d4d8;line-height:1.7;">
        <strong>Titular:</strong> ${b.holder_name}<br/>
        <strong>RUT:</strong> ${b.rut}<br/>
        <strong>Banco:</strong> ${b.bank_name} (${b.account_type})<br/>
        <strong>N° Cuenta:</strong> ${b.account_number}<br/>
        <strong>Correo:</strong> ${b.notification_email}
      </div>
    </div>
  `;

  const wrapper = (title: string, intro: string, extra = '') => `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e4e4e7;padding:28px;border-radius:16px;border:1px solid #27272a;">
      <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#ef4444;text-transform:uppercase;">${storeName}</div>
      <h2 style="color:#ffffff;margin:6px 0 12px;">${title}</h2>
      <p style="font-size:14px;line-height:1.6;color:#d4d4d8;">${intro}</p>
      ${itemsHtml}
      <div style="font-size:14px;color:#ffffff;text-align:right;margin-bottom:12px;">
        ${
          order.shipping_cost_clp > 0
            ? `<div style="font-size:12px;color:#a1a1aa;">Envío: ${formatClpServer(
                order.shipping_cost_clp
              )}</div>`
            : ''
        }
        <strong>Total: ${formatClpServer(order.total_clp)}</strong>
      </div>
      ${extra}
      <p style="font-size:12px;color:#71717a;margin-top:20px;border-top:1px solid #27272a;padding-top:14px;">
        Pedido <strong>${order.order_code}</strong> · Contacto WhatsApp: ${settings.whatsapp_number}
      </p>
    </div>
  `;

  switch (event) {
    case 'ORDER_RECEIVED':
      return {
        subject: `[${storeName}] Recibimos tu pedido ${order.order_code}`,
        html: wrapper(
          `¡Recibimos tu solicitud ${order.order_code}!`,
          `Hola <strong>${order.customer_name}</strong>, recibimos tu pedido correctamente. Revisaremos disponibilidad y te escribiremos por WhatsApp con los pasos para coordinar.`
        ),
      };
    case 'STOCK_CONFIRMED_AWAITING_PAYMENT':
      return {
        subject: `[${storeName}] Stock confirmado — Datos de transferencia (${order.order_code})`,
        html: wrapper(
          `Stock confirmado para tu pedido ${order.order_code}`,
          `Hola <strong>${order.customer_name}</strong>, ya confirmamos disponibilidad y reservamos tu equipo/servicio. Para avanzar, realiza la transferencia y envíanos el comprobante por WhatsApp.`,
          bankBoxHtml
        ),
      };
    case 'PAID_READY_FOR_DELIVERY':
      return {
        subject: `[${storeName}] Pago confirmado — Tu pedido ${order.order_code} está en marcha`,
        html: wrapper(
          `¡Pago confirmado! (${order.order_code})`,
          `Hola <strong>${order.customer_name}</strong>, confirmamos tu transferencia. Tu pedido ya está listo/en preparación para entrega.${
            order.tracking_code
              ? `<br/><br/><strong>Código de seguimiento:</strong> ${order.tracking_code}`
              : ''
          }`,
          `<div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:12px;font-size:13px;color:#d4d4d8;">${settings.pickup_instructions}</div>`
        ),
      };
    case 'ORDER_COMPLETED':
      return {
        subject: `[${storeName}] Pedido entregado ${order.order_code} — ¡Gracias por tu compra!`,
        html: wrapper(
          `¡Gracias por confiar en ${storeName}!`,
          `Hola <strong>${order.customer_name}</strong>, tu pedido <strong>${order.order_code}</strong> fue marcado como entregado. ¡A disfrutar tu PC!`
        ),
      };
    case 'ORDER_CANCELLED':
      return {
        subject: `[${storeName}] Pedido cancelado ${order.order_code}`,
        html: wrapper(
          `Pedido ${order.order_code} cancelado`,
          `Hola <strong>${order.customer_name}</strong>, te informamos que el pedido <strong>${order.order_code}</strong> fue cancelado y su reserva fue liberada. Si deseas retomar, escríbenos por WhatsApp.`
        ),
      };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EmailRequestBody;
    const creds = resolveSmtpCredentials(body.settings?.smtp_config);

    if (!creds) {
      return NextResponse.json({
        sent: false,
        skipped: true,
        reason: 'SMTP no configurado o desactivado.',
      });
    }

    const toEmail =
      body.event === 'TEST_EMAIL'
        ? body.testRecipient?.trim() || creds.adminCopyEmail
        : body.order?.customer_email?.trim() || '';

    if (!toEmail) {
      return NextResponse.json({
        sent: false,
        skipped: true,
        reason: 'El cliente no ingresó correo electrónico.',
      });
    }

    const { subject, html } = buildEmailContent(
      body.event,
      body.settings,
      body.order
    );

    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      auth: {
        user: creds.user,
        pass: creds.pass,
      },
    });

    await transporter.sendMail({
      from: creds.from,
      to: toEmail,
      bcc:
        body.event !== 'TEST_EMAIL' &&
        creds.adminCopyEmail &&
        creds.adminCopyEmail !== toEmail
          ? creds.adminCopyEmail
          : undefined,
      subject,
      html,
    });

    return NextResponse.json({ sent: true, to: toEmail });
  } catch (err) {
    return NextResponse.json(
      {
        sent: false,
        error:
          err instanceof Error
            ? err.message
            : 'Error al enviar correo electrónico.',
      },
      { status: 500 }
    );
  }
}
