import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { Observable } from 'rxjs';
import { Producto } from 'src/app/model/entity/producto';
import { environment } from 'src/environments/environment';
import { CreateProductoPayload } from 'src/app/model/dto/create-producto-payload';
import { UpdateProductoPayload } from 'src/app/model/dto/update-producto-payload';


@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private base = environment.apiUrl;
  private storeId = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private shopSvc: ShopService) {
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

  getProducts(include_deleted = false): Observable<Producto[]> {
    let params = new HttpParams().set('store_id', this.storeId);

    if (include_deleted) params = params.set('include_deleted', 'true');

    return this.http.get<Producto[]>(
      `${this.base}/products`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  addProducto(payload: any): Observable<any> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<any>(
      `${this.base}/products/insert`,
      payload,
      { params, headers: this.authHeaders() }
    );
  }

  updateProducto(payload: any): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.put<void>(
      `${this.base}/products/update`,
      payload,
      { params, headers: this.authHeaders() }
    );
  }

  getProductsPaged(opts: {
    page: number;
    pageSize: number;
    q?: string;
    include_deleted?: boolean;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
  }): Observable<{
    items: Producto[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    let params = new HttpParams()
      .set('store_id', this.storeId)
      .set('page', String(opts.page))
      .set('page_size', String(opts.pageSize));

    if (opts.q) params = params.set('q', opts.q);
    if (opts.include_deleted) params = params.set('include_deleted', 'true');
    if (opts.sort_by) params = params.set('sort_by', opts.sort_by);
    if (opts.sort_dir) params = params.set('sort_dir', opts.sort_dir);

    return this.http.get<any>(`${this.base}/products/paged`, {
      params,
      headers: this.authHeaders()
    });
  }


  deleteProducto(id: number): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.delete<void>(
      `${this.base}/products/${id}`,
      { params, headers: this.authHeaders() }
    );
  }


  deleteProducts(ids: number[]): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<any>(
      `${this.base}/products/delete-bulk`, { ids },
      { params, headers: this.authHeaders() }
    );
  }

}
