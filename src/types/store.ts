export type BuildTier = 'ENTRADA' | 'MEDIA' | 'ALTA' | 'ENTUSIASTA';

export type ComponentCategory =
  | 'CPU'
  | 'GPU'
  | 'MOTHERBOARD'
  | 'RAM'
  | 'STORAGE'
  | 'PSU'
  | 'CASE'
  | 'COOLING'
  | 'OTHER';

export type ComponentCondition = 'NEW' | 'OPEN_BOX' | 'USED';

export type ServiceCategory =
  | 'MANTENCION'
  | 'OPTIMIZACION'
  | 'ARMADO'
  | 'DIAGNOSTICO';

export type DeliveryMethod =
  | 'STORE_PICKUP'
  | 'SHIPPING_COD'
  | 'FLAT_RATE_SHIPPING';

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_ON_PICKUP';

export type OrderStatus =
  | 'PENDING_VERIFICATION'
  | 'AWAITING_PAYMENT'
  | 'PAID_READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type OrderType = 'BUILD' | 'SERVICE' | 'MIXED';

export interface BankTransferDetails {
  holder_name: string;
  rut: string;
  bank_name: string;
  account_type: string;
  account_number: string;
  notification_email: string;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from_name: string;
  from_email: string;
  admin_copy_email: string;
}

export interface StoreBanner {
  id: string;
  badge_text: string;
  title: string;
  subtitle: string;
  cta_text: string;
  target_section: 'BUILDS' | 'SERVICES';
  accent_style: 'RED_DARK' | 'CARBON_STEEL';
  is_active: boolean;
}

export interface StoreSettings {
  id: number;
  store_name: string;
  hero_announcement: string;
  whatsapp_number: string;
  pickup_instructions: string;
  flat_shipping_cost_clp: number;
  bank_details: BankTransferDetails;
  banners: StoreBanner[];
  smtp_config?: SmtpConfig;
  updated_at?: string;
}

export interface BuildSpecs {
  cpu: string;
  gpu: string;
  motherboard: string;
  ram: string;
  storage: string;
  psu: string;
  case_name: string;
  cooling: string;
  os?: string;
}

export type BenchmarkSourceType = 'WORKSHOP_TEST' | 'EXTERNAL_REF';

export interface FpsBenchmark {
  game: string;
  fps: string;
  fps_avg?: number;
  resolution: string;
  preset?: string;
  source_type?: BenchmarkSourceType;
  source_url?: string;
}

export type WorkloadLevel = 'BASICO' | 'FLUIDO' | 'PROFESIONAL';

export interface WorkloadCapability {
  app: string;
  level: WorkloadLevel;
  note: string;
}

export interface PcBuild {
  id: string;
  slug: string;
  name: string;
  tier: BuildTier;
  target_resolution: string;
  price_clp: number;
  stock_quantity: number;
  reserved_quantity: number;
  image_url: string;
  gallery_urls: string[];
  short_description: string;
  specs: BuildSpecs;
  fps_benchmarks: FpsBenchmark[];
  workloads?: WorkloadCapability[];
  warranty_text: string;
  is_featured: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ComponentInventoryItem {
  id: string;
  category: ComponentCategory;
  brand: string;
  model: string;
  sku: string;
  condition: ComponentCondition;
  quantity: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface TechService {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  price_clp: number | null;
  price_label: string;
  estimated_time: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  item_type: 'BUILD' | 'SERVICE';
  build_id?: string | null;
  service_id?: string | null;
  item_name: string;
  item_summary: string;
  quantity: number;
  unit_price_clp: number;
}

export interface OrderRecord {
  id: string;
  order_code: string;
  order_type: OrderType;
  customer_name: string;
  customer_contact: string;
  customer_email: string;
  delivery_method: DeliveryMethod;
  shipping_address: string;
  shipping_cost_clp: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  subtotal_clp: number;
  total_clp: number;
  tracking_code: string;
  stock_verified_at?: string | null;
  paid_at?: string | null;
  notes: string;
  created_at: string;
  closed_at?: string | null;
  items: OrderItemRecord[];
}

export interface StoreSnapshot {
  settings: StoreSettings;
  builds: PcBuild[];
  components: ComponentInventoryItem[];
  services: TechService[];
  orders: OrderRecord[];
  backend: 'SUPABASE' | 'LOCAL';
  supabaseError?: string;
}

export interface CartEntry {
  key: string;
  item_type: 'BUILD' | 'SERVICE';
  build_id?: string;
  service_id?: string;
  name: string;
  summary: string;
  unit_price_clp: number;
  quantity: number;
  max_quantity?: number;
  image_url?: string;
}
