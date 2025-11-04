import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { Movimiento } from 'src/app/model/entity/movimiento';
import { environment } from 'src/environments/environment';


@Injectable({
  providedIn: 'root',
})
export class MovimientoService {
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

  getMovimientos(opts?: { page?: number; pageSize?: number; order_number?: string; lote_id?: string; sort?: 'asc' | 'desc'; es_pedido?: boolean }): Observable<any> {
    let params = new HttpParams().set('store_id', this.storeId);

    if (opts?.page !== undefined) params = params.set('page', String(opts.page));
    if (opts?.pageSize !== undefined) params = params.set('pageSize', String(opts.pageSize));
    if (opts?.order_number) params = params.set('order_number', opts.order_number);
    if (opts?.lote_id) params = params.set('lote_id', opts.lote_id);
    if (opts?.sort) params = params.set('sort', opts.sort);
    if (opts?.es_pedido !== undefined) params = params.set('es_pedido', String(opts.es_pedido));

    return this.http.get<any>(`${this.base}/movimientos`, {
      params,
      headers: this.authHeaders()
    });
  }


  /*addLote(payload: CreateLotePayload): Promise<{ id: number } | undefined> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http
      .post<{ id: number }>(
        `${this.base}/movimientos`,
        payload,
        { params, headers: this.authHeaders() }   // <-- y aquí también
      )
      .toPromise();
  }*/

  // movimiento.service.ts
  exportMovimientosExcel(opts?: { order_number?: string; lote_id?: string; sort?: 'asc' | 'desc'; shop?: string }) {
    let params = new HttpParams().set('store_id', this.storeId);
    if (opts?.order_number) params = params.set('order_number', opts.order_number);
    if (opts?.lote_id) params = params.set('lote_id', opts.lote_id);
    if (opts?.sort) params = params.set('sort', opts.sort);
    if (opts?.shop) params = params.set('shop', opts.shop); // para links opcionales

    return this.http.get(`${this.base}/movimientos/export`, {
      params,
      headers: this.authHeaders(),
      responseType: 'blob' // 👈 importante para descargar
    });
  }

}
