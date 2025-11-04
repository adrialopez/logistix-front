export interface UpdateLotePayload {
  id: number;
  shop?: string;
  warehouse_id: number;
  lote_number: string;
  expiration_date: string | null;
  observations: string;
  remaining: number;
  initial_stock?: number;
}