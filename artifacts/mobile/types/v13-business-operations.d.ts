declare module '@/lib/v13BusinessOperations' {
  interface Shipment {
    seal_no?: string | null;
    port_of_loading?: string | null;
    port_of_discharge?: string | null;
    actual_departure_at?: string | null;
    actual_arrival_at?: string | null;
    freight_cost_foreign?: number | null;
    freight_currency?: string | null;
  }
}

export {};
