export interface Variante {
  id: number;
  inventory_item_id: string;
  name: string;
  product_id: number;
  sku: string;
  weight?: number;
  price?: number;
  __original?: Partial<Pick<Variante, "sku"> & { weight?: number; price?: number }>;
  __dirty?: boolean;
  __isNew?: boolean;
}