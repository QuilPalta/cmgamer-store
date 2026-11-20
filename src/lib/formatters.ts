import {
  BuildTier,
  ComponentCategory,
  ComponentCondition,
  DeliveryMethod,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PcBuild,
  ServiceCategory,
  StoreSettings,
  TechService,
} from '@/types/store';

export function formatClp(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
}

export function cleanWhatsAppPhone(phone: string): string {
  return (phone || '').replace(/[^0-9]/g, '');
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateOrderCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CMG-${yy}${mm}-${rand}`;
}

export const BUILD_TIER_META: Record<
  BuildTier,
  { label: string; shortLabel: string; badgeClass: string }
> = {
  ENTRADA: {
    label: 'Gama Entrada',
    shortLabel: 'Entrada',
    badgeClass: 'bg-zinc-800 text-zinc-200 border-zinc-700',
  },
  MEDIA: {
    label: 'Gama Media',
    shortLabel: 'Media',
    badgeClass: 'bg-zinc-800 text-white border-zinc-600',
  },
  ALTA: {
    label: 'Gama Alta',
    shortLabel: 'Alta',
    badgeClass: 'bg-red-950/80 text-red-300 border-red-700/60',
  },
  ENTUSIASTA: {
    label: 'Gama Entusiasta',
    shortLabel: 'Entusiasta',
    badgeClass: 'bg-red-600/20 text-red-400 border-red-500/60',
  },
};

export const COMPONENT_CATEGORY_META: Record<
  ComponentCategory,
  { label: string; shortLabel: string }
> = {
  CPU: { label: 'Procesador (CPU)', shortLabel: 'CPU' },
  GPU: { label: 'Tarjeta de Video (GPU)', shortLabel: 'GPU' },
  MOTHERBOARD: { label: 'Placa Madre', shortLabel: 'Placa Madre' },
  RAM: { label: 'Memoria RAM', shortLabel: 'RAM' },
  STORAGE: { label: 'Almacenamiento (SSD/HDD)', shortLabel: 'SSD/HDD' },
  PSU: { label: 'Fuente de Poder (PSU)', shortLabel: 'Fuente' },
  CASE: { label: 'Gabinete', shortLabel: 'Gabinete' },
  COOLING: { label: 'Refrigeración', shortLabel: 'Cooler' },
  OTHER: { label: 'Otros / Accesorios', shortLabel: 'Otros' },
};

export const COMPONENT_CONDITION_META: Record<
  ComponentCondition,
  { label: string; badgeClass: string }
> = {
  NEW: {
    label: 'Nuevo',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  OPEN_BOX: {
    label: 'Open Box',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  USED: {
    label: 'Usado',
    badgeClass: 'bg-zinc-700/60 text-zinc-200 border-zinc-600',
  },
};

export const SERVICE_CATEGORY_META: Record<
  ServiceCategory,
  { label: string; badgeClass: string }
> = {
  MANTENCION: {
    label: 'Mantención',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
  OPTIMIZACION: {
    label: 'Optimización',
    badgeClass: 'bg-zinc-800 text-zinc-200 border-zinc-600',
  },
  ARMADO: {
    label: 'Armado',
    badgeClass: 'bg-zinc-800 text-white border-zinc-500',
  },
  DIAGNOSTICO: {
    label: 'Diagnóstico',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
};

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  STORE_PICKUP: 'Retiro Presencial en Taller',
  SHIPPING_COD: 'Envío por Pagar (Starken / Chilexpress)',
  FLAT_RATE_SHIPPING: 'Envío Tarifa Plana',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Transferencia Bancaria',
  CASH_ON_PICKUP: 'Efectivo al Retirar',
};

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; shortLabel: string; badgeClass: string; step: number }
> = {
  PENDING_VERIFICATION: {
    step: 1,
    label: '1. Por Confirmar Stock / Solicitud',
    shortLabel: 'Por Confirmar',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  },
  AWAITING_PAYMENT: {
    step: 2,
    label: '2. Confirmado · Esperando Transferencia',
    shortLabel: 'Esperando Pago',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  },
  PAID_READY: {
    step: 3,
    label: '3. Pagado · En Preparación / Listo para Entrega',
    shortLabel: 'Pagado / Listo',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  COMPLETED: {
    step: 4,
    label: '4. Entregado (Stock Descontado)',
    shortLabel: 'Entregado',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  },
  CANCELLED: {
    step: 0,
    label: 'Cancelado (Stock Liberado)',
    shortLabel: 'Cancelado',
    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  },
};

export function buildBuyerInquiryWhatsAppUrl(
  settings: StoreSettings,
  build: PcBuild
): string {
  const phone = cleanWhatsAppPhone(settings.whatsapp_number);
  const msg = [
    `Hola *${settings.store_name}*, me interesa la build *${build.name}* (${formatClp(
      build.price_clp
    )}).`,
    `• CPU: ${build.specs.cpu}`,
    `• GPU: ${build.specs.gpu}`,
    `• RAM: ${build.specs.ram}`,
    `• SSD: ${build.specs.storage}`,
    '',
    '¿Me confirmas disponibilidad para coordinar?',
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function buildServiceWhatsAppUrl(
  settings: StoreSettings,
  service: TechService
): string {
  const phone = cleanWhatsAppPhone(settings.whatsapp_number);
  const priceText =
    service.price_clp !== null
      ? formatClp(service.price_clp)
      : service.price_label || 'A cotizar';
  const msg = [
    `Hola *${settings.store_name}*, quiero agendar el servicio de *${service.name}* (${priceText}).`,
    '¿Qué horarios tienen disponibles esta semana?',
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function buildBuyerOrderWhatsAppUrl(
  settings: StoreSettings,
  order: OrderRecord
): string {
  const phone = cleanWhatsAppPhone(settings.whatsapp_number);
  const lines = order.items.map(
    (i) =>
      `• ${i.quantity}x *${i.item_name}* — ${formatClp(
        i.quantity * i.unit_price_clp
      )}`
  );
  const msg = [
    `Hola *${settings.store_name}*, acabo de generar el pedido *${order.order_code}* desde la web:`,
    '',
    ...lines,
    '',
    `*Total:* ${formatClp(order.total_clp)}`,
    `*Entrega:* ${DELIVERY_METHOD_LABELS[order.delivery_method]}`,
    `*Pago:* ${PAYMENT_METHOD_LABELS[order.payment_method]}`,
    `*Nombre:* ${order.customer_name}`,
    '',
    'Quedo atento a la confirmación y los datos para coordinar.',
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function buildSellerToCustomerWhatsAppUrl(
  settings: StoreSettings,
  order: OrderRecord
): string {
  const cleanPhone = cleanWhatsAppPhone(order.customer_contact);
  const b = settings.bank_details;
  const itemLines = order.items.map(
    (i) =>
      `• ${i.quantity}x *${i.item_name}* — ${formatClp(
        i.quantity * i.unit_price_clp
      )}`
  );

  const msg = [
    `Hola *${order.customer_name}*, te escribimos de *${settings.store_name}*.`,
    `Ya confirmamos disponibilidad para tu pedido *${order.order_code}*:`,
    '',
    ...itemLines,
    ...(order.shipping_cost_clp > 0
      ? [`• Envío: ${formatClp(order.shipping_cost_clp)}`]
      : []),
    '',
    `*Total a Transferir:* *${formatClp(order.total_clp)}*`,
    '',
    '*Datos de Transferencia:*',
    `• Titular: ${b.holder_name}`,
    `• RUT: ${b.rut}`,
    `• Banco: ${b.bank_name}`,
    `• Tipo: ${b.account_type}`,
    `• N° Cuenta: ${b.account_number}`,
    `• Correo: ${b.notification_email}`,
    '',
    `Una vez realizada la transferencia, envíanos el comprobante por este mismo chat indicando el código *${order.order_code}* para coordinar tu entrega.`,
  ].join('\n');

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
}
