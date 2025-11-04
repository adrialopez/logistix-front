import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateLotePayload } from 'src/app/model/dto/create-lote-payload';
import { UpdateLotePayload } from 'src/app/model/dto/update-lote-payload';
import { Producto } from 'src/app/model/entity/producto';
import { Variante } from 'src/app/model/entity/variante';
import { Location } from 'src/app/model/entity/location';
import { StockLot } from 'src/app/model/entity/stocklot';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { environment } from 'src/environments/environment';


@Injectable({
  providedIn: 'root',
})
export class LoteService {
  private base = environment.apiUrl;
  private storeId = '';

  constructor(private http: HttpClient, private auth: AuthService, private shopSvc: ShopService) {
    this.shopSvc.shop$.subscribe(shop => this.storeId = shop);
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return token
      ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
      : new HttpHeaders();
  }

  getLotes(
    productSku?: string,
    variantSku?: string,
    warehouseId?: number,
    includeDeleted = false
  ): Observable<StockLot[]> {
    let params = new HttpParams().set('store_id', this.storeId);
    if (includeDeleted) params = params.set('include_deleted', 'true');
    if (productSku) params = params.set('product_sku', productSku);
    if (variantSku) params = params.set('variant_sku', variantSku);
    if (warehouseId != null) params = params.set('warehouse_id', warehouseId.toString());

    return this.http.get<StockLot[]>(
      `${this.base}/stock-lots`,
      {
        params,
        headers: this.authHeaders()    // <-- añadir headers
      }
    );
  }

  // lote.service.ts
  getLotesPaged(opts: {
    page: number;                     // 0-based
    pageSize: number;
    q?: string;
    include_deleted?: boolean;
    product_sku?: number | string;
    variant_sku?: number | string;
    warehouse_id?: number | '';
    sort_by?: 'created_at' | 'expiration_date' | 'remaining' | 'lote_number' | 'product_name';
    sort_dir?: 'asc' | 'desc';
    hide_zero?: boolean;              // ej. true cuando no mostramos eliminados
  }) {
    let params = new HttpParams()
      .set('store_id', this.storeId)
      .set('page', String(opts.page))
      .set('page_size', String(opts.pageSize));

    if (opts.q) params = params.set('q', opts.q);
    if (opts.include_deleted) params = params.set('include_deleted', 'true');
    if (opts.product_sku) params = params.set('product_sku', String(opts.product_sku));
    if (opts.variant_sku) params = params.set('variant_sku', String(opts.variant_sku));
    if (opts.warehouse_id !== undefined && opts.warehouse_id !== null && opts.warehouse_id !== '')
      params = params.set('warehouse_id', String(opts.warehouse_id));
    if (opts.sort_by) params = params.set('sort_by', opts.sort_by);
    if (opts.sort_dir) params = params.set('sort_dir', opts.sort_dir);
    if (opts.hide_zero) params = params.set('hide_zero', 'true');

    return this.http.get<{ items: StockLot[]; total: number; page: number; pageSize: number }>(
      `${this.base}/stock-lots/paged`,
      { params, headers: this.authHeaders() }
    );
  }


  getLoteById(id: number | string): Observable<StockLot> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<StockLot>(
      `${this.base}/stock-lots/${id}`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  searchLots(params: { product_sku: any; variant_sku?: any; q?: string }): Observable<any[]> {

    let httpParams = new HttpParams().set('product_sku', String(params.product_sku)).set('store_id', this.storeId);
    if (params.variant_sku != null && params.variant_sku !== '') {
      httpParams = httpParams.set('variant_sku', String(params.variant_sku));
    }
    if (params.q) httpParams = httpParams.set('q', params.q);

    return this.http.get<any[]>(`${this.base}/stock-lots/search`, {
      params: httpParams,
      headers: this.authHeaders()
    });
  }

  getProductos(): Observable<Producto[]> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<Producto[]>(
      `${this.base}/products`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getProductosByShop(storeId: string): Observable<Producto[]> {
    const params = new HttpParams().set('store_id', storeId);
    return this.http.get<Producto[]>(
      `${this.base}/products`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getAllVariants(): Observable<Variante[]> {
    let params = new HttpParams()
      .set('store_id', this.storeId)
    return this.http.get<Variante[]>(
      `${this.base}/variants/all`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }
  getAllVariantsByShop(storeId: string): Observable<Variante[]> {
    let params = new HttpParams()
      .set('store_id', storeId)
    return this.http.get<Variante[]>(
      `${this.base}/variants/all`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getVariants(productSku: string): Observable<Variante[]> {
    let params = new HttpParams()
      .set('store_id', this.storeId)
      .set('id', productSku);
    return this.http.get<Variante[]>(
      `${this.base}/variants`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getLocations(): Observable<Location[]> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<Location[]>(
      `${this.base}/locations`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  addLote(payload: CreateLotePayload): Promise<{ id: number } | undefined> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http
      .post<{ id: number }>(
        `${this.base}/stock-lots`,
        payload,
        { params, headers: this.authHeaders() }   // <-- y aquí también
      )
      .toPromise();
  }

  updateLote(payload: UpdateLotePayload): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.put<void>(
      `${this.base}/stock-lots/${payload.id}`,
      payload,
      { params, headers: this.authHeaders() }
    );
  }

  deleteLote(id: number): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.delete<void>(
      `${this.base}/stock-lots/${id}`,
      { params, headers: this.authHeaders() }
    );
  }

  getSettings(productId: string): Observable<{ sortMode: string | null }> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<{ sortMode: string | null }>(
      `${this.base}/settings/${productId}`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getEntradas(): Observable<any[]> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<any[]>(`${this.base}/entradas`, { params, headers: this.authHeaders() });
  }

  getEntradaById(id: any): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<any>(`${this.base}/entradas/${id}`, { params, headers: this.authHeaders() });
  }

  // 👇 NUEVO: crear
  addEntrada(payload: any): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<any>(`${this.base}/entradas`, payload, { params, headers: this.authHeaders() });
  }

  // 👇 NUEVO: actualizar
  updateEntrada(id: number | string, payload: any): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.put<any>(`${this.base}/entradas/${id}`, payload, { params, headers: this.authHeaders() });
  }

  // 👇 NUEVO: borrar
  deleteEntrada(id: number | string): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.delete<void>(`${this.base}/entradas/${id}`, { params, headers: this.authHeaders() });
  }

  getCaducidades(): Observable<any> {
    let params = new HttpParams()
      .set('store_id', this.storeId)

    return this.http.get<any>(
      `${this.base}/stock-lots/caducidades`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }
}
