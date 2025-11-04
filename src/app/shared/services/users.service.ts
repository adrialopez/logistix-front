import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ShopService } from './shop.service';
import { environment } from 'src/environments/environment';


@Injectable({
  providedIn: 'root'
})
export class UsersService {
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

  getUsers(): Observable<any[]> {
    let params = new HttpParams().set('store_id', this.storeId);

    return this.http.get<any[]>(
      `${this.base}/users`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getUserById(id: number): Observable<any> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<any>(
      `${this.base}/users/${id}`,
      { params, headers: this.authHeaders() }
    );
  }

  createUser(user: { email: string; password: string; tienda_id: string; role: string }): Observable<any> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<any>(
      `${this.base}/users`,
      user,
      { params, headers: this.authHeaders() }
    );
  }

  updateUser(id: number, user: { email: string; tienda_id: string; role: string; password?: string }): Observable<any> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.put<any>(
      `${this.base}/users/${id}`,
      user,
      { params, headers: this.authHeaders() }
    );
  }

  deleteUser(id: number): Observable<any> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.delete<any>(
      `${this.base}/users/${id}`,
      { params, headers: this.authHeaders() }
    );
  }

  getTiendas(): Observable<any[]> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<any[]>(
      `${this.base}/users/tiendas`,
      { params, headers: this.authHeaders() }
    );
  }
}
