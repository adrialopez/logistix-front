// src/app/shared/services/entrada.service.ts
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ShopService } from './shop.service';
import { environment } from 'src/environments/environment';

// ✅ Declaramos aquí la interfaz, no en el componente
export interface EntradaDetalle {
  id: number;
  reference: string;
  client_order_number?: string;
  status: string;
  shipping_date?: string;
  arrival_date?: string;
  stock_validated?: boolean;
  warehouse_id?: number;
  observations?: string;
  lineas: {
    id: number;
    lote_id?: number;
    lote_number?: string;
    product_sku?: string | number;
    variant_sku?: string | number;
    remaining?: number;
    estado?: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class EntradaService {
  private base = environment.apiUrl;
  private storeId = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private shopSvc: ShopService
  ) {
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

  /** LISTAR */
  getEntradas(): Observable<any[]> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<any[]>(
      `${this.base}/entradas`,
      { params, headers: this.authHeaders() }
    );
  }

  getEntradasResumen(): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<any[]>(
      `${this.base}/entradas/resumen`,
      { params, headers: this.authHeaders() }
    );
  }

  /** OBTENER DETALLE */
  getEntradaById(id: any): Observable<EntradaDetalle> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<EntradaDetalle>(
      `${this.base}/entradas/${id}`,
      { params, headers: this.authHeaders() }
    );
  }

  /** VALIDAR ENTRADA (stock) */
  validateStock(id: number | string): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<any>(
      `${this.base}/entradas/${id}/validate-stock`,
      {}, // sin body; no hay devoluciones
      { params, headers: this.authHeaders() }
    );
  }

  /** CREAR ENTRADA */
  addEntrada(payload: any): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<any>(
      `${this.base}/entradas`,
      payload,
      { params, headers: this.authHeaders() }
    );
  }

  // alias
  createEntrada(payload: any): Observable<any> { return this.addEntrada(payload); }
  crearEntrada(payload: any): Observable<any> { return this.addEntrada(payload); }

  /** ACTUALIZAR ENTRADA */
  updateEntrada(id: number | string, payload: any): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.put<any>(
      `${this.base}/entradas/${id}`,
      payload,
      { params, headers: this.authHeaders() }
    );
  }
  actualizarEntrada(id: number | string, payload: any): Observable<any> {
    return this.updateEntrada(id, payload);
  }

  /** PATCH */
  patchEntrada(id: number | string, partial: any): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.patch<any>(
      `${this.base}/entradas/${id}`,
      partial,
      { params, headers: this.authHeaders() }
    );
  }

  /** BORRAR */
  deleteEntrada(id: number | string): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.delete<void>(
      `${this.base}/entradas/${id}`,
      { params, headers: this.authHeaders() }
    );
  }

  /** MARCAR COMO DEVUELTO */
  marcarComoDevuelto(entryId: number, items: { line_id: number; qty_return: number }[]): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<any>(
      `${this.base}/entradas/${entryId}/validate-stock`,
      { items },
      { params, headers: this.authHeaders() }
    );
  }

  getEntradasPaged(opts: {
    page: number;                 // 0-based
    pageSize: number;
    q?: string;
    product_id?: string | number;
    variant_id?: string | number;
    warehouse_id?: string | number;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
  }) {
    let params = new HttpParams()
      .set('store_id', this.storeId)
      .set('page', String(opts.page))
      .set('page_size', String(opts.pageSize));

    if (opts.q) params = params.set('q', opts.q);
    if (opts.product_id) params = params.set('product_id', String(opts.product_id));
    if (opts.variant_id) params = params.set('variant_id', String(opts.variant_id));
    if (opts.warehouse_id !== undefined && opts.warehouse_id !== null && opts.warehouse_id !== '')
      params = params.set('warehouse_id', String(opts.warehouse_id));
    if (opts.sort_by) params = params.set('sort_by', opts.sort_by);
    if (opts.sort_dir) params = params.set('sort_dir', opts.sort_dir);

    return this.http.get<{ items: any[]; total: number; page: number; pageSize: number }>(
      `${this.base}/entradas/paged`,
      { params, headers: this.authHeaders() }
    );
  }

}
