import { Location } from "./location";
import { StockLot } from "./stocklot";

export interface Entry {
  id: number;
  reference: string;  //Nº albaran
  tienda_id: string; //Cliente
  client_order_number: string; //Nº pedido
  status: string;        //Estado
  warehouse_id: number;  //Id almacen
  warehouse_name: string; //Nombre almacen
  shipping_date?: string;  //Fecha llegada
  total_lines: number; //Lineas
  observations: string;
  is_deleted: boolean;
  totalWeight: number;
  stock_validated?: boolean | number;

  lineas: StockLot[]; //Lineas de pedido
}
