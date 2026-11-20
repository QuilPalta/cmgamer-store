-- ============================================================================
-- CM GAMER Store: PC Builds, Technical Services, Warehouse & Orders Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Store Settings (Single row config for WhatsApp, Bank Transfer, Banners & SMTP)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name text NOT NULL DEFAULT 'CM GAMER',
  hero_announcement text NOT NULL DEFAULT 'PCs Gamer Armados y Probados · Retiro Presencial y Envíos a Todo Chile · Pago vía Transferencia',
  whatsapp_number text NOT NULL DEFAULT '+56912345678',
  pickup_instructions text NOT NULL DEFAULT 'Retiro presencial en taller a coordinar vía WhatsApp una vez confirmado el pago.',
  flat_shipping_cost_clp integer NOT NULL DEFAULT 14990 CHECK (flat_shipping_cost_clp >= 0),
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  banners jsonb NOT NULL DEFAULT '[]'::jsonb,
  smtp_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.store_settings (id, store_name, whatsapp_number)
VALUES (1, 'CM GAMER', '+56912345678')
ON CONFLICT (id) DO NOTHING;

-- 2. PC Builds (Fixed Specs & Fixed Price)
CREATE TABLE IF NOT EXISTS public.pc_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'MEDIA' CHECK (
    tier IN ('ENTRADA', 'MEDIA', 'ALTA', 'ENTUSIASTA')
  ),
  target_resolution text NOT NULL DEFAULT '1080p',
  price_clp integer NOT NULL DEFAULT 0 CHECK (price_clp >= 0),
  stock_quantity integer NOT NULL DEFAULT 1 CHECK (stock_quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (
    reserved_quantity >= 0 AND reserved_quantity <= stock_quantity
  ),
  image_url text NOT NULL DEFAULT '',
  gallery_urls text[] NOT NULL DEFAULT '{}',
  short_description text NOT NULL DEFAULT '',
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  fps_benchmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
  warranty_text text NOT NULL DEFAULT '6 meses de garantía directa en armado y componentes.',
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_builds_active_tier
  ON public.pc_builds (is_active, tier, price_clp);

-- 3. Warehouse Component Inventory (Simple standalone part tracking)
CREATE TABLE IF NOT EXISTS public.component_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (
    category IN ('CPU', 'GPU', 'MOTHERBOARD', 'RAM', 'STORAGE', 'PSU', 'CASE', 'COOLING', 'OTHER')
  ),
  brand text NOT NULL DEFAULT '',
  model text NOT NULL,
  sku text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT 'NEW' CHECK (
    condition IN ('NEW', 'OPEN_BOX', 'USED')
  ),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_inventory_category
  ON public.component_inventory (category, model);

-- 4. Technical Services (Maintenance, Cleaning, Thermal Paste, Optimization, Assembly)
CREATE TABLE IF NOT EXISTS public.tech_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'MANTENCION' CHECK (
    category IN ('MANTENCION', 'OPTIMIZACION', 'ARMADO', 'DIAGNOSTICO')
  ),
  description text NOT NULL DEFAULT '',
  price_clp integer CHECK (price_clp IS NULL OR price_clp >= 0),
  price_label text NOT NULL DEFAULT '',
  estimated_time text NOT NULL DEFAULT '24 - 48 hrs',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Orders & Order Items (5-Stage Pipeline + Immutable Closed States)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE,
  order_type text NOT NULL DEFAULT 'BUILD' CHECK (
    order_type IN ('BUILD', 'SERVICE', 'MIXED')
  ),
  customer_name text NOT NULL,
  customer_contact text NOT NULL,
  customer_email text DEFAULT '',
  delivery_method text NOT NULL DEFAULT 'STORE_PICKUP' CHECK (
    delivery_method IN ('STORE_PICKUP', 'SHIPPING_COD', 'FLAT_RATE_SHIPPING')
  ),
  shipping_address text DEFAULT '',
  shipping_cost_clp integer NOT NULL DEFAULT 0 CHECK (shipping_cost_clp >= 0),
  payment_method text NOT NULL DEFAULT 'BANK_TRANSFER' CHECK (
    payment_method IN ('BANK_TRANSFER', 'CASH_ON_PICKUP')
  ),
  status text NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (
    status IN ('PENDING_VERIFICATION', 'AWAITING_PAYMENT', 'PAID_READY', 'COMPLETED', 'CANCELLED')
  ),
  subtotal_clp integer NOT NULL DEFAULT 0 CHECK (subtotal_clp >= 0),
  total_clp integer NOT NULL DEFAULT 0 CHECK (total_clp >= 0),
  tracking_code text DEFAULT '',
  stock_verified_at timestamptz,
  paid_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'BUILD' CHECK (item_type IN ('BUILD', 'SERVICE')),
  build_id uuid REFERENCES public.pc_builds(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.tech_services(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  item_summary text NOT NULL DEFAULT '',
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_clp integer NOT NULL CHECK (unit_price_clp >= 0)
);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pc_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read store_settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Manage store_settings" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read pc_builds" ON public.pc_builds FOR SELECT USING (true);
CREATE POLICY "Manage pc_builds" ON public.pc_builds FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read component_inventory" ON public.component_inventory FOR SELECT USING (true);
CREATE POLICY "Manage component_inventory" ON public.component_inventory FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read tech_services" ON public.tech_services FOR SELECT USING (true);
CREATE POLICY "Manage tech_services" ON public.tech_services FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Manage orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read order_items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Manage order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Transactional RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_cm_order_with_reservation(
  p_order_code text,
  p_customer_name text,
  p_customer_contact text,
  p_customer_email text,
  p_delivery_method text,
  p_shipping_address text,
  p_shipping_cost_clp integer,
  p_payment_method text,
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_subtotal_clp integer := 0;
  v_total_clp integer := 0;
  v_has_build boolean := false;
  v_has_service boolean := false;
  v_order_type text := 'BUILD';
  v_req jsonb;
  v_build RECORD;
  v_item_type text;
  v_req_qty integer;
  v_unit_price integer;
  v_item_name text;
  v_item_summary text;
  v_build_id uuid;
  v_service_id uuid;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos una build o servicio.';
  END IF;

  INSERT INTO public.orders (
    order_code, order_type, customer_name, customer_contact, customer_email,
    delivery_method, shipping_address, shipping_cost_clp, payment_method,
    status, subtotal_clp, total_clp, notes
  )
  VALUES (
    p_order_code, 'BUILD', p_customer_name, p_customer_contact, COALESCE(p_customer_email, ''),
    COALESCE(p_delivery_method, 'STORE_PICKUP'), COALESCE(p_shipping_address, ''),
    COALESCE(p_shipping_cost_clp, 0), COALESCE(p_payment_method, 'BANK_TRANSFER'),
    'PENDING_VERIFICATION', 0, 0, COALESCE(p_notes, '')
  )
  RETURNING id INTO v_order_id;

  FOR v_req IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_type := COALESCE(v_req->>'item_type', 'BUILD');
    v_req_qty := GREATEST(1, (v_req->>'quantity')::integer);
    v_unit_price := GREATEST(0, (v_req->>'unit_price_clp')::integer);
    v_item_name := COALESCE(v_req->>'item_name', '');
    v_item_summary := COALESCE(v_req->>'item_summary', '');
    v_build_id := NULL;
    v_service_id := NULL;

    IF v_item_type = 'BUILD' THEN
      v_has_build := true;
      v_build_id := (v_req->>'build_id')::uuid;

      SELECT * INTO v_build
      FROM public.pc_builds
      WHERE id = v_build_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Build no encontrada en el catálogo.';
      END IF;

      IF (v_build.stock_quantity - v_build.reserved_quantity) < v_req_qty THEN
        RAISE EXCEPTION 'Stock insuficiente para % (disponible: %, solicitado: %).',
          v_build.name, (v_build.stock_quantity - v_build.reserved_quantity), v_req_qty;
      END IF;

      UPDATE public.pc_builds
      SET reserved_quantity = reserved_quantity + v_req_qty,
          updated_at = now()
      WHERE id = v_build.id;

      IF v_item_name = '' THEN
        v_item_name := v_build.name;
      END IF;
    ELSE
      v_has_service := true;
      IF COALESCE(v_req->>'service_id', '') <> '' THEN
        v_service_id := (v_req->>'service_id')::uuid;
      END IF;
    END IF;

    INSERT INTO public.order_items (
      order_id, item_type, build_id, service_id, item_name, item_summary, quantity, unit_price_clp
    ) VALUES (
      v_order_id, v_item_type, v_build_id, v_service_id, v_item_name, v_item_summary, v_req_qty, v_unit_price
    );

    v_subtotal_clp := v_subtotal_clp + (v_req_qty * v_unit_price);
  END LOOP;

  IF v_has_build AND v_has_service THEN
    v_order_type := 'MIXED';
  ELSIF v_has_service THEN
    v_order_type := 'SERVICE';
  ELSE
    v_order_type := 'BUILD';
  END IF;

  v_total_clp := v_subtotal_clp + COALESCE(p_shipping_cost_clp, 0);

  UPDATE public.orders
  SET order_type = v_order_type,
      subtotal_clp = v_subtotal_clp,
      total_clp = v_total_clp
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_cm_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;

  IF v_order.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'El pedido ya está cerrado (%).', v_order.status;
  END IF;

  FOR v_item IN
    SELECT * FROM public.order_items WHERE order_id = p_order_id AND item_type = 'BUILD' AND build_id IS NOT NULL
  LOOP
    UPDATE public.pc_builds
    SET stock_quantity = GREATEST(0, stock_quantity - v_item.quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
        updated_at = now()
    WHERE id = v_item.build_id;
  END LOOP;

  UPDATE public.orders
  SET status = 'COMPLETED',
      closed_at = now()
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_cm_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;

  IF v_order.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'El pedido ya está cerrado (%).', v_order.status;
  END IF;

  FOR v_item IN
    SELECT * FROM public.order_items WHERE order_id = p_order_id AND item_type = 'BUILD' AND build_id IS NOT NULL
  LOOP
    UPDATE public.pc_builds
    SET reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
        updated_at = now()
    WHERE id = v_item.build_id;
  END LOOP;

  UPDATE public.orders
  SET status = 'CANCELLED',
      closed_at = now()
  WHERE id = p_order_id;
END;
$$;
