export interface CreateLotePayload {
  shop: string;
  lote_number: string;
  product_sku: string;
  variant_sku?: string;
  warehouse_id: number;
  remaining: number;
  expiration_date?: string;
  observations: string;
}