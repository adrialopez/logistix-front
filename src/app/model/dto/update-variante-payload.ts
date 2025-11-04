export interface UpdateVariantePayload {
    id: number;
    name: string;
    product_id: number;
    sku: string;
    shop: string;
    price?: number;
    weight?: number;
    
}