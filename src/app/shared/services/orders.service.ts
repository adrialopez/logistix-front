import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { environment } from 'src/environments/environment';
import { BridgePrintService } from './bridge-print.service';

// ===== Tipados útiles (opcional) =====
export type LabelType = 'label_printer' | 'normal_printer';

export interface ShipWithSendcloudRequest {
  orderId: number | string;
  orderNumber?: string;
  // Si tu backend ya conoce la dirección del pedido, no necesitas pasarla desglosada:
  address?: any; // o un tipo con {name,address1,zip,city,country,phone,email,...}
  items: Array<{ sku?: string; ean?: string; qty: number }>;
  boxes?: { S: number; M: number; L: number };
  shipping_product_id?: number;   // ID de producto de envío Sendcloud
  contract_id?: number;           // si aplica
  label_type?: LabelType;         // 'label_printer'(A6) | 'normal_printer'(A4)
  start_from?: 0 | 1 | 2 | 3;     // solo para A4 (posición en hoja)
}

export interface ShipWithSendcloudResponse {
  parcelId: number;
  tracking_number?: string;
  labelType: 'label_printer' | 'normal_printer';
  labelsBase64: string[];     // <<< en vez de pdfBase64 único
  applied_shipment_id?: number;
  colli_count?: number;
  pdfBase64?: string;
  zplBase64?: string;
  zpl?: any;
  zplBase64List?: any;

}



@Injectable({
  providedIn: 'root'
})
export class OrdersService {

  private base = environment.apiUrl;
  private storeId = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private shopSvc: ShopService,
    private bridge: BridgePrintService) {
    this.shopSvc.shop$.subscribe(shop => {
      this.storeId = shop;
    });
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return token
      ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
      : new HttpHeaders();
  }

  getOrders(opts?: {
    page?: number; pageSize?: number;
    search?: string; sortBy?: string; sortDir?: 'asc' | 'desc';
    statusCanon?: string;
  }): Observable<
    any
> {
    let params = new HttpParams().set('store_id', this.storeId);
    if (opts?.page != null) params = params.set('page', String(opts.page));
    if (opts?.pageSize != null) params = params.set('pageSize', String(opts.pageSize));
    if (opts?.search) params = params.set('search', opts.search);
    if (opts?.sortBy) params = params.set('sortBy', opts.sortBy);
    if (opts?.sortDir) params = params.set('sortDir', opts.sortDir);
    if (opts?.statusCanon) params = params.set('statusCanon', opts.statusCanon);

    return this.http.get<{ total: number; rows: any[] }>(
      `${this.base}/orders`,
      { params, headers: this.authHeaders() }
    );
  }


  getPackGo(): Observable<any[]> {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.get<any[]>(
      `${this.base}/orders/packgo`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getOrderById(orderId: number): Observable<any> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<any>(
      `${this.base}/orders/${orderId}`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  createPedido(data: any): Observable<{ id: number }> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<{ id: number }>(
      `${this.base}/orders`,
      data,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  updatePedido(orderId: number, data: any): Observable<void> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.put<void>(
      `${this.base}/orders/${orderId}`,
      data,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }


  /** DELETE: Eliminar pedido (si lo agregas en backend) */
  deletePedido(orderId: number): Observable<void> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.delete<void>(
      `${this.base}/orders/${orderId}`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getShippingMethods(): Observable<any[]> {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.get<any[]>(
      `${this.base}/shipping-methods`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }
  getShippingMethodsByShop(shopId: any): Observable<any[]> {
    let params = new HttpParams().set('store_id', shopId);

    return this.http.get<any[]>(
      `${this.base}/shipping-methods`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getCarriers(): Observable<any[]> {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.get<any[]>(
      `${this.base}/carriers`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getCarriersByShop(shop: any): Observable<any[]> {
    let params = new HttpParams().set('store_id', shop);

    return this.http.get<any[]>(
      `${this.base}/carriers`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  batchUpdateFacturacion(
    shopDomain: string,
    pickingPrices: Record<number, number>,
    shippingPrices: Record<number, number>,
    invoiceCost: number
  ): Observable<void> {

    let params = new HttpParams().set('store_id', shopDomain);

    const url = `${this.base}/orders/facturacion`;
    const body = { pickingPrices, shippingPrices, invoiceCost };
    return this.http.put<void>(url, body, {
      params,
      headers: this.authHeaders()
    });
  }

  exportFacturacion(
    shopDomain: string,
    desde: string,
    hasta: string
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('store_id', shopDomain)
      .set('desde', desde)
      .set('hasta', hasta);
    const url = `${this.base}/orders/facturacion`;
    return this.http.get(url, {
      params,
      headers: this.authHeaders(),
      responseType: 'blob'
    });
  }

  devolucionOrder(orderId: any, data: any): Observable<void> {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.post<void>(
      `${this.base}/orders/devolucion`,
      {
        order_id: orderId,
        ...data
      },
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getStatusHistory(orderId: number) {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.get<any[]>(`${this.base}/orders/${orderId}/status-history`,
      {
        params,
        headers: this.authHeaders()
      });
  }

  shipWithSendcloud(body: ShipWithSendcloudRequest): Observable<ShipWithSendcloudResponse> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<ShipWithSendcloudResponse>(
      `${this.base}/orders/sendcloud/ship-order`,
      body,
      { params, headers: this.authHeaders() }
    );
  }

  /**
   * Marca el pedido como enviado en tu backend.
   * Ajusta la ruta a la que tengas (aquí supongo POST /orders/:id/ship).
   */
  markOrderAsShipped(orderId: number | string, meta?: {
    parcelId?: number;
    tracking_number?: string;
    boxes?: { S: number; M: number; L: number };
  }): Observable<void> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<void>(
      `${this.base}/orders/${orderId}/ship`,
      meta || {},
      { params, headers: this.authHeaders() }
    );
  }

  /**
   * Imprime en silencio usando el Bridge local (vía WebSocket).
   * Lo exponemos como Observable para que encaje con tus flujos rxjs.
   */
  printViaBridge(p: { pdfBase64: string; printer?: string }): Observable<void> {
    return from(this.bridge.printPdfBase64(p.pdfBase64, p.printer));
  }

  claimNextPackgo(userId: string, currentId: string) {
    let params = new HttpParams().set('store_id', this.storeId)
      .set('userId', userId)
      .set('currentId', currentId);
    return this.http.get<{ order: any, lockToken: string }>(
      `${this.base}/orders/packgo/next`,
      { params, headers: this.authHeaders() });
  }

  heartbeatPackgo(orderId: number, lockToken: string) {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.post<{ ok: boolean }>(`${this.base}/orders/packgo/heartbeat`, { orderId, lockToken },
      { params, headers: this.authHeaders() });
  }

  unlockPackgo(orderId: number, lockToken: string, isSkip: boolean = false) {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.post<{ ok: boolean }>(`${this.base}/orders/packgo/unlock`, { orderId, lockToken, isSkip },
      { params, headers: this.authHeaders() });
  }

  completePackgo(orderId: number, lockToken: string, extra?: any) {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.post<{ ok: boolean }>(`${this.base}/orders/packgo/complete`, { orderId, lockToken, ...extra },
      { params, headers: this.authHeaders() });
  }

  downloadAlbaran(orderId: number | string): Observable<Blob> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.get(`${this.base}/albaran/pdf/${orderId}`, {
      params,
      headers: this.authHeaders(),
      responseType: 'blob'
    });
  }
}
