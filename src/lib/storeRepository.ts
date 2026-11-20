import {
  ComponentInventoryItem,
  DeliveryMethod,
  OrderItemRecord,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PcBuild,
  StoreSettings,
  StoreSnapshot,
  TechService,
} from '@/types/store';
import {
  DEFAULT_STORE_SETTINGS,
  SEED_COMPONENT_INVENTORY,
  SEED_ORDERS,
  SEED_PC_BUILDS,
  SEED_TECH_SERVICES,
} from './seedData';
import { getSupabaseBrowserClient } from './supabaseClient';
import { generateOrderCode, slugify } from './formatters';

const LS_KEY = 'cmgamer_store_local_snapshot_v1';

interface LocalStoreData {
  settings: StoreSettings;
  builds: PcBuild[];
  components: ComponentInventoryItem[];
  services: TechService[];
  orders: OrderRecord[];
}

function readLocalData(): LocalStoreData {
  if (typeof window === 'undefined') {
    return {
      settings: DEFAULT_STORE_SETTINGS,
      builds: SEED_PC_BUILDS,
      components: SEED_COMPONENT_INVENTORY,
      services: SEED_TECH_SERVICES,
      orders: SEED_ORDERS,
    };
  }

  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) {
      const initial: LocalStoreData = {
        settings: DEFAULT_STORE_SETTINGS,
        builds: SEED_PC_BUILDS,
        components: SEED_COMPONENT_INVENTORY,
        services: SEED_TECH_SERVICES,
        orders: SEED_ORDERS,
      };
      window.localStorage.setItem(LS_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<LocalStoreData>;
    return {
      settings: {
        ...DEFAULT_STORE_SETTINGS,
        ...(parsed.settings || {}),
        bank_details: {
          ...DEFAULT_STORE_SETTINGS.bank_details,
          ...(parsed.settings?.bank_details || {}),
        },
        banners:
          parsed.settings?.banners && parsed.settings.banners.length > 0
            ? parsed.settings.banners
            : DEFAULT_STORE_SETTINGS.banners,
      },
      builds: parsed.builds || SEED_PC_BUILDS,
      components: parsed.components || SEED_COMPONENT_INVENTORY,
      services: parsed.services || SEED_TECH_SERVICES,
      orders: parsed.orders || [],
    };
  } catch {
    return {
      settings: DEFAULT_STORE_SETTINGS,
      builds: SEED_PC_BUILDS,
      components: SEED_COMPONENT_INVENTORY,
      services: SEED_TECH_SERVICES,
      orders: SEED_ORDERS,
    };
  }
}

function writeLocalData(data: LocalStoreData): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function loadStoreSnapshot(): Promise<StoreSnapshot> {
  const sb = getSupabaseBrowserClient();
  if (!sb) {
    const local = readLocalData();
    return { ...local, backend: 'LOCAL' };
  }

  try {
    const [settingsRes, buildsRes, componentsRes, servicesRes, ordersRes, orderItemsRes] =
      await Promise.all([
        sb.from('store_settings').select('*').eq('id', 1).maybeSingle(),
        sb.from('pc_builds').select('*').order('created_at', { ascending: false }),
        sb
          .from('component_inventory')
          .select('*')
          .order('category', { ascending: true })
          .order('model', { ascending: true }),
        sb
          .from('tech_services')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        sb.from('orders').select('*').order('created_at', { ascending: false }),
        sb.from('order_items').select('*'),
      ]);

    const firstError =
      settingsRes.error ||
      buildsRes.error ||
      componentsRes.error ||
      servicesRes.error ||
      ordersRes.error ||
      orderItemsRes.error;

    if (firstError) {
      const local = readLocalData();
      return {
        ...local,
        backend: 'LOCAL',
        supabaseError: firstError.message,
      };
    }

    const rawSettings = settingsRes.data as Partial<StoreSettings> | null;
    const settings: StoreSettings = {
      ...DEFAULT_STORE_SETTINGS,
      ...(rawSettings || {}),
      bank_details: {
        ...DEFAULT_STORE_SETTINGS.bank_details,
        ...(rawSettings?.bank_details || {}),
      },
      banners:
        Array.isArray(rawSettings?.banners) && rawSettings.banners.length > 0
          ? rawSettings.banners
          : DEFAULT_STORE_SETTINGS.banners,
      smtp_config: {
        ...DEFAULT_STORE_SETTINGS.smtp_config!,
        ...(rawSettings?.smtp_config || {}),
      },
    };

    const itemsByOrder = new Map<string, OrderItemRecord[]>();
    for (const item of (orderItemsRes.data || []) as OrderItemRecord[]) {
      const list = itemsByOrder.get(item.order_id) || [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    const orders: OrderRecord[] = ((ordersRes.data || []) as Omit<OrderRecord, 'items'>[]).map(
      (o) => ({
        ...o,
        items: itemsByOrder.get(o.id) || [],
      })
    );

    return {
      settings,
      builds: (buildsRes.data || []) as PcBuild[],
      components: (componentsRes.data || []) as ComponentInventoryItem[],
      services: (servicesRes.data || []) as TechService[],
      orders,
      backend: 'SUPABASE',
    };
  } catch (err) {
    const local = readLocalData();
    return {
      ...local,
      backend: 'LOCAL',
      supabaseError:
        err instanceof Error ? err.message : 'Error al conectar con Supabase',
    };
  }
}

export async function saveStoreSettings(settings: StoreSettings): Promise<void> {
  const sb = getSupabaseBrowserClient();
  const payload = {
    id: 1,
    store_name: settings.store_name,
    hero_announcement: settings.hero_announcement,
    whatsapp_number: settings.whatsapp_number,
    pickup_instructions: settings.pickup_instructions,
    flat_shipping_cost_clp: settings.flat_shipping_cost_clp,
    bank_details: settings.bank_details,
    banners: settings.banners,
    smtp_config: settings.smtp_config || DEFAULT_STORE_SETTINGS.smtp_config,
    updated_at: new Date().toISOString(),
  };

  if (sb) {
    const { error } = await sb.from('store_settings').upsert(payload, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }

  const local = readLocalData();
  local.settings = { ...settings, updated_at: payload.updated_at };
  writeLocalData(local);
}

export async function upsertPcBuild(
  input: Omit<PcBuild, 'id' | 'slug' | 'reserved_quantity'> & {
    id?: string;
    slug?: string;
    reserved_quantity?: number;
  }
): Promise<PcBuild> {
  const now = new Date().toISOString();
  const id = input.id || makeUuid();
  const slug = input.slug?.trim() || `${slugify(input.name)}-${id.slice(0, 4)}`;

  const record: PcBuild = {
    ...input,
    id,
    slug,
    reserved_quantity: input.reserved_quantity ?? 0,
    updated_at: now,
    created_at: input.created_at || now,
  };

  const sb = getSupabaseBrowserClient();
  if (sb) {
    const { data, error } = await sb
      .from('pc_builds')
      .upsert(record, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as PcBuild;
  }

  const local = readLocalData();
  const idx = local.builds.findIndex((b) => b.id === id);
  if (idx >= 0) {
    local.builds[idx] = {
      ...local.builds[idx],
      ...record,
      reserved_quantity: local.builds[idx].reserved_quantity,
    };
  } else {
    local.builds.unshift(record);
  }
  writeLocalData(local);
  return record;
}

export async function deletePcBuild(id: string): Promise<void> {
  const sb = getSupabaseBrowserClient();
  if (sb) {
    const { error } = await sb.from('pc_builds').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const local = readLocalData();
  local.builds = local.builds.filter((b) => b.id !== id);
  writeLocalData(local);
}

export async function upsertComponentItem(
  input: Omit<ComponentInventoryItem, 'id'> & { id?: string }
): Promise<ComponentInventoryItem> {
  const now = new Date().toISOString();
  const id = input.id || makeUuid();
  const record: ComponentInventoryItem = {
    ...input,
    id,
    updated_at: now,
    created_at: input.created_at || now,
  };

  const sb = getSupabaseBrowserClient();
  if (sb) {
    const { data, error } = await sb
      .from('component_inventory')
      .upsert(record, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as ComponentInventoryItem;
  }

  const local = readLocalData();
  const idx = local.components.findIndex((c) => c.id === id);
  if (idx >= 0) {
    local.components[idx] = record;
  } else {
    local.components.unshift(record);
  }
  writeLocalData(local);
  return record;
}

export async function deleteComponentItem(id: string): Promise<void> {
  const sb = getSupabaseBrowserClient();
  if (sb) {
    const { error } = await sb.from('component_inventory').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const local = readLocalData();
  local.components = local.components.filter((c) => c.id !== id);
  writeLocalData(local);
}

export async function upsertTechService(
  input: Omit<TechService, 'id'> & { id?: string }
): Promise<TechService> {
  const now = new Date().toISOString();
  const id = input.id || makeUuid();
  const record: TechService = {
    ...input,
    id,
    updated_at: now,
    created_at: input.created_at || now,
  };

  const sb = getSupabaseBrowserClient();
  if (sb) {
    const { data, error } = await sb
      .from('tech_services')
      .upsert(record, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as TechService;
  }

  const local = readLocalData();
  const idx = local.services.findIndex((s) => s.id === id);
  if (idx >= 0) {
    local.services[idx] = record;
  } else {
    local.services.push(record);
  }
  writeLocalData(local);
  return record;
}

export async function deleteTechService(id: string): Promise<void> {
  const sb = getSupabaseBrowserClient();
  if (sb) {
    const { error } = await sb.from('tech_services').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const local = readLocalData();
  local.services = local.services.filter((s) => s.id !== id);
  writeLocalData(local);
}

export interface CreateOrderInput {
  customerName: string;
  customerContact: string;
  customerEmail?: string;
  deliveryMethod: DeliveryMethod;
  shippingAddress?: string;
  shippingCostClp: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  items: Array<{
    item_type: 'BUILD' | 'SERVICE';
    build_id?: string | null;
    service_id?: string | null;
    item_name: string;
    item_summary: string;
    quantity: number;
    unit_price_clp: number;
  }>;
}

export async function createOrderWithReservation(
  input: CreateOrderInput
): Promise<OrderRecord> {
  const orderCode = generateOrderCode();
  const sb = getSupabaseBrowserClient();

  if (sb) {
    const { data: orderId, error } = await sb.rpc('create_cm_order_with_reservation', {
      p_order_code: orderCode,
      p_customer_name: input.customerName.trim(),
      p_customer_contact: input.customerContact.trim(),
      p_customer_email: (input.customerEmail || '').trim(),
      p_delivery_method: input.deliveryMethod,
      p_shipping_address: (input.shippingAddress || '').trim(),
      p_shipping_cost_clp: Math.max(0, Math.round(input.shippingCostClp || 0)),
      p_payment_method: input.paymentMethod,
      p_notes: (input.notes || '').trim(),
      p_items: input.items,
    });

    if (error) throw new Error(error.message);

    const [orderRes, itemsRes] = await Promise.all([
      sb.from('orders').select('*').eq('id', orderId).single(),
      sb.from('order_items').select('*').eq('order_id', orderId),
    ]);

    if (orderRes.error) throw new Error(orderRes.error.message);
    return {
      ...(orderRes.data as Omit<OrderRecord, 'items'>),
      items: (itemsRes.data || []) as OrderItemRecord[],
    };
  }

  // Local fallback with transactional-like validation
  const local = readLocalData();
  if (input.items.length === 0) {
    throw new Error('El pedido debe contener al menos una build o servicio.');
  }

  for (const reqItem of input.items) {
    if (reqItem.item_type === 'BUILD' && reqItem.build_id) {
      const b = local.builds.find((x) => x.id === reqItem.build_id);
      if (!b) throw new Error('Build no encontrada.');
      const avail = b.stock_quantity - b.reserved_quantity;
      if (avail < reqItem.quantity) {
        throw new Error(
          `Stock insuficiente para ${b.name} (disponible: ${avail}, solicitado: ${reqItem.quantity}).`
        );
      }
    }
  }

  const orderId = makeUuid();
  let subtotal = 0;
  let hasBuild = false;
  let hasService = false;

  const orderItems: OrderItemRecord[] = input.items.map((reqItem) => {
    if (reqItem.item_type === 'BUILD' && reqItem.build_id) {
      hasBuild = true;
      const b = local.builds.find((x) => x.id === reqItem.build_id);
      if (b) b.reserved_quantity += reqItem.quantity;
    } else {
      hasService = true;
    }
    subtotal += reqItem.quantity * reqItem.unit_price_clp;
    return {
      id: makeUuid(),
      order_id: orderId,
      item_type: reqItem.item_type,
      build_id: reqItem.build_id || null,
      service_id: reqItem.service_id || null,
      item_name: reqItem.item_name,
      item_summary: reqItem.item_summary,
      quantity: reqItem.quantity,
      unit_price_clp: reqItem.unit_price_clp,
    };
  });

  const shippingCost = Math.max(0, Math.round(input.shippingCostClp || 0));
  const order: OrderRecord = {
    id: orderId,
    order_code: orderCode,
    order_type: hasBuild && hasService ? 'MIXED' : hasService ? 'SERVICE' : 'BUILD',
    customer_name: input.customerName.trim(),
    customer_contact: input.customerContact.trim(),
    customer_email: (input.customerEmail || '').trim(),
    delivery_method: input.deliveryMethod,
    shipping_address: (input.shippingAddress || '').trim(),
    shipping_cost_clp: shippingCost,
    payment_method: input.paymentMethod,
    status: 'PENDING_VERIFICATION',
    subtotal_clp: subtotal,
    total_clp: subtotal + shippingCost,
    tracking_code: '',
    notes: (input.notes || '').trim(),
    created_at: new Date().toISOString(),
    items: orderItems,
  };

  local.orders.unshift(order);
  writeLocalData(local);
  return order;
}

export async function updateOrderWorkflow(
  orderId: string,
  patch: {
    status?: OrderStatus;
    tracking_code?: string;
    notes?: string;
  }
): Promise<void> {
  const sb = getSupabaseBrowserClient();

  if (patch.status === 'COMPLETED') {
    if (sb) {
      const { error } = await sb.rpc('complete_cm_order', { p_order_id: orderId });
      if (error) throw new Error(error.message);
      return;
    }
    const local = readLocalData();
    const order = local.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Pedido no encontrado.');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new Error('El pedido ya está cerrado.');
    }
    for (const item of order.items) {
      if (item.item_type === 'BUILD' && item.build_id) {
        const b = local.builds.find((x) => x.id === item.build_id);
        if (b) {
          b.stock_quantity = Math.max(0, b.stock_quantity - item.quantity);
          b.reserved_quantity = Math.max(0, b.reserved_quantity - item.quantity);
        }
      }
    }
    order.status = 'COMPLETED';
    order.closed_at = new Date().toISOString();
    writeLocalData(local);
    return;
  }

  if (patch.status === 'CANCELLED') {
    if (sb) {
      const { error } = await sb.rpc('cancel_cm_order', { p_order_id: orderId });
      if (error) throw new Error(error.message);
      return;
    }
    const local = readLocalData();
    const order = local.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Pedido no encontrado.');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new Error('El pedido ya está cerrado.');
    }
    for (const item of order.items) {
      if (item.item_type === 'BUILD' && item.build_id) {
        const b = local.builds.find((x) => x.id === item.build_id);
        if (b) {
          b.reserved_quantity = Math.max(0, b.reserved_quantity - item.quantity);
        }
      }
    }
    order.status = 'CANCELLED';
    order.closed_at = new Date().toISOString();
    writeLocalData(local);
    return;
  }

  const now = new Date().toISOString();
  const dbPatch: Record<string, unknown> = {};
  if (patch.status) {
    dbPatch.status = patch.status;
    if (patch.status === 'AWAITING_PAYMENT') dbPatch.stock_verified_at = now;
    if (patch.status === 'PAID_READY') dbPatch.paid_at = now;
  }
  if (patch.tracking_code !== undefined) dbPatch.tracking_code = patch.tracking_code;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;

  if (sb) {
    const { error } = await sb.from('orders').update(dbPatch).eq('id', orderId);
    if (error) throw new Error(error.message);
    return;
  }

  const local = readLocalData();
  const order = local.orders.find((o) => o.id === orderId);
  if (!order) throw new Error('Pedido no encontrado.');
  if (patch.status) {
    order.status = patch.status;
    if (patch.status === 'AWAITING_PAYMENT') order.stock_verified_at = now;
    if (patch.status === 'PAID_READY') order.paid_at = now;
  }
  if (patch.tracking_code !== undefined) order.tracking_code = patch.tracking_code;
  if (patch.notes !== undefined) order.notes = patch.notes;
  writeLocalData(local);
}

export async function syncLocalDataToSupabase(): Promise<number> {
  const sb = getSupabaseBrowserClient();
  if (!sb) {
    throw new Error('No hay credenciales de Supabase configuradas.');
  }

  const local = readLocalData();
  let count = 0;

  await saveStoreSettings(local.settings);

  if (local.builds.length > 0) {
    const { error } = await sb.from('pc_builds').upsert(local.builds, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    count += local.builds.length;
  }

  if (local.components.length > 0) {
    const { error } = await sb
      .from('component_inventory')
      .upsert(local.components, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    count += local.components.length;
  }

  if (local.services.length > 0) {
    const { error } = await sb
      .from('tech_services')
      .upsert(local.services, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    count += local.services.length;
  }

  return count;
}
