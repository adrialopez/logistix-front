export interface CreateVariantePayload {
    id_producto: number;
    sku: string;
    name: string;
    tienda_id: string;
    price?: number;
    weight?: number;
}