import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Location } from 'src/app/model/entity/location';
import { ShopService } from './shop.service';
import { CreateLocationPayload } from 'src/app/model/dto/create-location-payload';
import { UpdateLocationPayload } from 'src/app/model/dto/update-location-payload';
import { environment } from 'src/environments/environment';


@Injectable({
  providedIn: 'root'
})
export class LocationService {
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

  getLocations(include_deleted = false): Observable<Location[]> {
    let params = new HttpParams().set('store_id', this.storeId);

    if (include_deleted) params = params.set('include_deleted', 'true');

    return this.http.get<Location[]>(
      `${this.base}/locations`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  addLocation(payload: CreateLocationPayload): Promise<{id: number} | undefined> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<{id: number}>(
      `${this.base}/locations`,
      payload,
      { params, headers: this.authHeaders() }
    ).toPromise();
  }

  updateLocation(payload: UpdateLocationPayload): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.put<void>(
      `${this.base}/locations/${payload.id}`,
      payload,
      { params, headers: this.authHeaders() }
    );
  }

  deleteLocation(id: number): Observable<void> {
    const params = new HttpParams().set('store_id', this.storeId);
    return this.http.delete<void>(
      `${this.base}/locations/${id}`,
      { params, headers: this.authHeaders() }
    );
  }
}
