import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { Observable } from 'rxjs';
import { Variante } from 'src/app/model/entity/variante';
import { CreateVariantePayload } from 'src/app/model/dto/create-variante-payload';
import { UpdateVariantePayload } from 'src/app/model/dto/update-variante-payload';
import { playSkipBack } from 'ionicons/icons';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VariantesService {
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

  getVariantesByProducto(idProducto: number): Observable<Variante[]> {
    let params = new HttpParams().set('store_id', this.storeId);
    
    return this.http.get<Variante[]>(
      `${this.base}/variants${idProducto && idProducto > 0 ? `/${idProducto}` : ''}`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  addVariante(payload: CreateVariantePayload): Promise<{id: number} | undefined> {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.post<{id: number}>(
      `${this.base}/variants`,
      payload,
      {
        params,
        headers: this.authHeaders()
      }
    ).toPromise();
  }

  updateVariante(payload: UpdateVariantePayload): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    console.log(payload);
    return this.http.put<void>(
      `${this.base}/variants/${payload.id}`,
      payload,
      { params, headers: this.authHeaders() }
    );
  }

  deleteVariante(id: number): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.delete<void>(
      `${this.base}/variants/${id}`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

}
