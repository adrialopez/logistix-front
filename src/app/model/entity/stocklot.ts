export interface StockLot {
  id: number;
  lote_number: string;
  product_sku: number;
  product_name: string;
  product_image: string;
  variant_sku?: string;
  variant_name: string;
  warehouse_id: number;
  warehouse_name: string;
  remaining: number;
  expiration_date?: string;
  arrival_date?: string;
  observations: string;
  is_deleted: boolean;
}
