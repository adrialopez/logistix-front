export interface Lote {
  id: number;
  numero_lote: string;
  restante: number;
  stock_inicial: number;
  cantidad: number;
  fecha_caducidad: string | null;
  fecha_llegada: string | null; //asi o en creado_en??
  creado_en: string;
  id_producto_shopify: string;
  observaciones: string;
  variant_id_shopify: string;
  inventory_item_id: string;
  variant_name: string;
  is_deleted: boolean;
  location_id: string;
  nombre_producto: string;
}
