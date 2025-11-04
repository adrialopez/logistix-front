import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { Stats } from 'src/app/model/dto/stats';
import { environment } from 'src/environments/environment'; // <-- usar environments

@Injectable({
  providedIn: 'root'
})
export class StatsService {
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

  getStats(): Observable<Stats> {
    const params = this.storeId ? new HttpParams().set('store_id', this.storeId) : new HttpParams();

    return this.http.get<Stats>(
      `${this.base}/stats`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }
  getStatsLogistica(): Observable<Stats> {
    const params = this.storeId ? new HttpParams().set('store_id', this.storeId) : new HttpParams();

    return this.http.get<Stats>(
      `${this.base}/stats/logistica`,
      {
        params,
        headers: this.authHeaders()
      }
    );
  }

  getTransportistaStats(mes: number, year: number) {
    return this.http.get<{ labels: string[], data: number[] }>(
      `${this.base}/stats/transportista`,
      {
        params: new HttpParams().set('mes', mes).set('year', year).set('store_id', this.storeId),
        headers: this.authHeaders() 
      }
    );
  }

  getProductoMasVendido(mes: number, year: number) {
    return this.http.get<{ producto: string, total_vendido: number, vendidos_hoy: number }>(
      `${this.base}/stats/producto-mas-vendido`,
      {
        params: new HttpParams().set('mes', mes).set('year', year).set('store_id', this.storeId),
        headers: this.authHeaders()
      }
    );
  }

  getLogisticaBundle(mes: number, year: number) {
    return this.http.get<any>(
      `${this.base}/stats/logistica-bundle`,
      {
        params: new HttpParams().set('mes', mes).set('year', year).set('store_id', this.storeId),
        headers: this.authHeaders()
      }
    );
  }

  getRankingProductosMasVendidos(mes: number, year: number, limit: number = 10) {
    return this.http.get<{ producto: string, total_vendido: number }[]>(
      `${this.base}/stats/ranking-productos`,
      {
        params: new HttpParams()
          .set('mes', mes)
          .set('year', year)
          .set('limit', limit)
          .set('store_id', this.storeId),
        headers: this.authHeaders()
      }
    );
  }

  getMediaPedidosMes(mes: number, year: number) {
    return this.http.get<{ media: number, dias: number[], pedidosPorDia: number[] }>(
      `${this.base}/stats/media-pedidos-mes`,
      {
        params: new HttpParams().set('mes', mes).set('year', year).set('store_id', this.storeId),
        headers: this.authHeaders()
      }
    );
  }

  getMediaKpisMes(mes: number, year: number) {
    return this.http.get<{
      mediaPedidos: number,
      ticketMedio: number,
      dias: number[],
      pedidosPorDia: number[],
      ticketPorDia: number[]
    }>(
      `${this.base}/stats/media-kpis-mes`,
      {
        params: new HttpParams().set('mes', mes).set('year', year).set('store_id', this.storeId),
        headers: this.authHeaders()
      }
    );
  }

  getKpiControl(mes: number, year: number) {
    return this.http.get<{ total: number, entregados: number, enTransito: number, otros: number }>(
      `${this.base}/stats/kpi-control`,
      {
        params: new HttpParams().set('mes', mes).set('year', year).set('store_id', this.storeId),
        headers: this.authHeaders()
      }
    );
  }

  getDistribucionTransportista(mes: number, year: number) {
    return this.http.get<{ labels: string[], data: number[] }>(
      `${this.base}/stats/distribucion-transportista`,
      {
        params: new HttpParams().set('mes', mes).set('year', year).set('store_id', this.storeId),
        headers: this.authHeaders()
      }
    );
  }

  getPedidosUnidadesMes() {
    return this.http.get<{ pedidos: number[], unidades: number[] }>(
      `${this.base}/stats/pedidos-unidades-mes`,
      {
        params: new HttpParams().set('store_id', this.storeId),
        headers: this.authHeaders()
      }
    );
  }
}
