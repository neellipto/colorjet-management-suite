import { getSupabase } from '@/lib/supabaseClient';
import type { ImportOrder, Shipment, TruckingJob } from '@/lib/v13BusinessOperations';

function ensure<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(fallback);
  return data;
}

export async function createImportOrderWithItems(input: {
  supplierId?: string;
  supplierName: string;
  purchaseOrderNo?: string;
  piNo?: string;
  transactionType: ImportOrder['transaction_type'];
  lcNo?: string;
  lcOpenDate?: string;
  lcExpiryDate?: string;
  currency: string;
  exchangeRate: number;
  advanceRequired?: number;
  productionPaymentRequired?: number;
  shipmentPaymentRequired?: number;
  expectedShipDate?: string;
  expectedArrivalDate?: string;
  notes?: string;
  items: Array<{
    productId?: string;
    sku?: string;
    productName: string;
    model?: string;
    identificationNo?: string;
    quantity: number;
    unit: string;
    unitPriceForeign: number;
    weightKg?: number;
    cbm?: number;
    category?: string;
    note?: string;
  }>;
}): Promise<ImportOrder> {
  if (!input.items.length) throw new Error('At least one import item is required.');

  const { data, error } = await getSupabase().rpc('v13_create_import_order', {
    p_supplier_id: input.supplierId ?? null,
    p_supplier_name: input.supplierName.trim(),
    p_purchase_order_no: input.purchaseOrderNo?.trim() || null,
    p_pi_no: input.piNo?.trim() || null,
    p_transaction_type: input.transactionType,
    p_lc_no: input.lcNo?.trim() || null,
    p_lc_open_date: input.lcOpenDate ?? null,
    p_lc_expiry_date: input.lcExpiryDate ?? null,
    p_currency: input.currency.trim().toUpperCase(),
    p_exchange_rate: input.exchangeRate,
    p_advance_required: input.advanceRequired ?? 0,
    p_production_payment_required: input.productionPaymentRequired ?? 0,
    p_shipment_payment_required: input.shipmentPaymentRequired ?? 0,
    p_expected_ship_date: input.expectedShipDate ?? null,
    p_expected_arrival_date: input.expectedArrivalDate ?? null,
    p_notes: input.notes?.trim() || null,
    p_items: input.items.map(item => ({
      product_id: item.productId ?? null,
      sku: item.sku ?? null,
      product_name: item.productName.trim(),
      model: item.model?.trim() || null,
      identification_no: item.identificationNo?.trim() || null,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unit_price_foreign: item.unitPriceForeign,
      weight_kg: item.weightKg ?? null,
      cbm: item.cbm ?? null,
      category: item.category?.trim() || null,
      note: item.note?.trim() || null,
    })),
  });

  return ensure(data as ImportOrder | null, error, 'Import order could not be created.');
}

export async function recordImportPayment(input: {
  importOrderId: string;
  paymentStage: 'advance' | 'production' | 'before_shipment' | 'balance' | 'freight' | 'bank_charge' | 'amendment' | 'other';
  paymentMethod: 'LC' | 'TT' | 'BANK' | 'CASH' | 'CARD' | 'OTHER';
  amountForeign: number;
  currency: string;
  exchangeRate: number;
  bankName?: string;
  referenceNo?: string;
  paymentDate: string;
  attachmentPath?: string;
  note?: string;
}): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabase().rpc('v13_record_import_payment', {
    p_import_order_id: input.importOrderId,
    p_payment_stage: input.paymentStage,
    p_payment_method: input.paymentMethod,
    p_amount_foreign: input.amountForeign,
    p_currency: input.currency.trim().toUpperCase(),
    p_exchange_rate: input.exchangeRate,
    p_bank_name: input.bankName?.trim() || null,
    p_reference_no: input.referenceNo?.trim() || null,
    p_payment_date: input.paymentDate,
    p_attachment_path: input.attachmentPath?.trim() || null,
    p_note: input.note?.trim() || null,
  });

  return ensure(data as Record<string, unknown> | null, error, 'Import payment could not be recorded.');
}

export async function createShipment(input: {
  importOrderId: string;
  shipmentMode: Shipment['shipment_mode'];
  carrierName?: string;
  vesselFlightNo?: string;
  bookingNo?: string;
  blAwbNo?: string;
  containerNo?: string;
  origin?: string;
  destination?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  etd?: string;
  eta?: string;
  freightCostForeign?: number;
  freightCurrency?: string;
  trackingUrl?: string;
}): Promise<Shipment> {
  const { data, error } = await getSupabase().rpc('v13_create_shipment', {
    p_import_order_id: input.importOrderId,
    p_shipment_mode: input.shipmentMode,
    p_carrier_name: input.carrierName?.trim() || null,
    p_vessel_flight_no: input.vesselFlightNo?.trim() || null,
    p_booking_no: input.bookingNo?.trim() || null,
    p_bl_awb_no: input.blAwbNo?.trim() || null,
    p_container_no: input.containerNo?.trim() || null,
    p_origin: input.origin?.trim() || null,
    p_destination: input.destination?.trim() || null,
    p_port_of_loading: input.portOfLoading?.trim() || null,
    p_port_of_discharge: input.portOfDischarge?.trim() || null,
    p_etd: input.etd ?? null,
    p_eta: input.eta ?? null,
    p_freight_cost_foreign: input.freightCostForeign ?? 0,
    p_freight_currency: input.freightCurrency?.trim().toUpperCase() || 'USD',
    p_tracking_url: input.trackingUrl?.trim() || null,
  });

  return ensure(data as Shipment | null, error, 'Shipment could not be created.');
}

export async function createTruckingJob(input: {
  shipmentId?: string;
  importOrderId?: string;
  truckingType: TruckingJob['trucking_type'];
  transporterName?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNo?: string;
  pickupLocation: string;
  deliveryLocation: string;
  expectedDeliveryAt?: string;
  transportCost?: number;
  note?: string;
}): Promise<TruckingJob> {
  const { data, error } = await getSupabase().rpc('v13_create_trucking_job', {
    p_shipment_id: input.shipmentId ?? null,
    p_import_order_id: input.importOrderId ?? null,
    p_trucking_type: input.truckingType,
    p_transporter_name: input.transporterName?.trim() || null,
    p_driver_name: input.driverName?.trim() || null,
    p_driver_phone: input.driverPhone?.trim() || null,
    p_vehicle_no: input.vehicleNo?.trim() || null,
    p_pickup_location: input.pickupLocation.trim(),
    p_delivery_location: input.deliveryLocation.trim(),
    p_expected_delivery_at: input.expectedDeliveryAt ?? null,
    p_transport_cost: input.transportCost ?? 0,
    p_note: input.note?.trim() || null,
  });

  return ensure(data as TruckingJob | null, error, 'Trucking job could not be created.');
}
