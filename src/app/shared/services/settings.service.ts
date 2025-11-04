import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';
import { environment } from 'src/environments/environment';
import { tap } from 'rxjs/operators';


@Injectable({ providedIn: 'root' })
export class SettingsService {

    private base = environment.apiUrl;
    private storeId = '';

    private warningDays!: number; // Se inicializará desde el backend
    private criticalDays!: number; // Se inicializará desde el backend

    constructor(private http: HttpClient, private auth: AuthService, private shopSvc: ShopService) {
        this.shopSvc.shop$.subscribe(shop => this.storeId = shop);
    }

    private authHeaders(): HttpHeaders {
        const token = this.auth.getToken();
        return token
            ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
            : new HttpHeaders();
    }

    getSettings() {
        let params = new HttpParams().set('store_id', this.storeId);
        return this.http
            .get<any>(`${this.base}/settings`, {
                params,
                headers: this.authHeaders()
            })
            .pipe(
                tap(cfg => {
                    // Actualizar los valores en el servicio
                    this.warningDays = cfg.warningDays;
                    this.criticalDays = cfg.criticalDays;
                    console.log('Settings cargados:', { warningDays: this.warningDays, criticalDays: this.criticalDays });
                })
            );
    }

    updateGeneral(payload: { defaultSort: string, warningDays: number, criticalDays: number, sendcloudIntegrationId: number }) {
        let params = new HttpParams().set('store_id', this.storeId);
        return this.http.post(`${this.base}/settings`, payload, {
            params,
            headers: this.authHeaders()
        });
    }

    updateShopifyCredentials(payload: { dominioShopify: string, tokenAcceso: string }) {
        let params = new HttpParams().set('store_id', this.storeId);

        return this.http.post(`${this.base}/settings/shopify`, payload, {
            params,
            headers: this.authHeaders()
        });
    }

    updateShopifyProducts(payload: { dominioShopify: string, tokenAcceso: string }) {
        let params = new HttpParams().set('store_id', this.storeId);

        return this.http.post(`${this.base}/shopify/sync`, payload, {
            params,
            headers: this.authHeaders()
        });
    }

    disableShopify() {
        let params = new HttpParams().set('store_id', this.storeId);

        return this.http.get(`${this.base}/shopify/disable`, {
            params,
            headers: this.authHeaders()
        });
    }

    setWarningDays(days: number) {
        this.warningDays = days;
    }

    setCriticalDays(days: number) {
        this.criticalDays = days;
    }

    getWarningDays(): number {
        return this.warningDays;
    }

    getCriticalDays(): number {
        return this.criticalDays;
    }

    getNotifications() {
        const params = new HttpParams().set('store_id', this.storeId);
        return this.http.get<any[]>(`${this.base}/settings/notifications`, {
            params,
            headers: this.authHeaders()
        });
    }

    updateNotifications(items: Array<{ key: string; enabled: boolean; emails: string }>) {
        const params = new HttpParams().set('store_id', this.storeId);
        return this.http.post(`${this.base}/settings/notifications`, { items }, {
            params,
            headers: this.authHeaders()
        });
    }

    updateBillingData(billingData: {
        nombreFiscal: string;
        cif: string;
        direccionFiscal: string;
        codigoPostalFiscal: string;
        telefonoFiscal: string;
        emailFiscal: string;
    }) {
        const params = new HttpParams().set('store_id', this.storeId);
        return this.http.post(`${this.base}/settings/billing`, billingData, {
            params,
            headers: this.authHeaders()
        });
    }
}
