export interface Movimiento {
  id: number;
  lote_id: string;
  cantidad: string;
  tipo: string;
  motivo: string;
  origen: string;
  tienda_id: string;
  fecha: string;
  id_producto_shopify: string;
  variant_id_shopify: string;
  pedido_id_shopify?: string;
  cliente_nombre?: string;
  cliente_email?: string;
}
