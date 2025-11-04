import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import { ShopService } from './shop.service';
import { environment } from 'src/environments/environment';



@Injectable({ providedIn: 'root' })
export class AuthService {
    private base = environment.apiUrl;
    private readonly TOKEN_KEY = 'auth_token';
    isLoggedIn$ = new BehaviorSubject<boolean>(this.isLoggedIn());
    private roleSubject = new BehaviorSubject<string | null>(null);
    public role$ = this.roleSubject.asObservable();


    constructor(private http: HttpClient, private router: Router, private shopSvc: ShopService) {
        this.initializeFromToken();
    }

    private initializeFromToken() {
        const tok = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (!tok) return;

        const payload = this.decodeJwt<any>(tok);
        if (payload) {
            this.roleSubject.next(payload.role);
            this.shopSvc.setShop(payload.tienda_id);
        }
    }

    login(payload: {
        email: string;
        password: string;
        remember: boolean;
    }): Observable<void> {
        return this.http
            .post<any>(`${this.base}/login`, {
                email: payload.email,
                password: payload.password
            })
            .pipe(
                tap(res => {
                    // si remember===true guardamos en localStorage, si no en sessionStorage
                    const storage = payload.remember ? localStorage : sessionStorage;
                    storage.setItem('auth_token', res.token);
                    storage.setItem('tienda', res.user.tienda_id);
                    storage.setItem('email', res.user.email);
                    this.shopSvc.setShop(res.user.tienda_id);
                    this.isLoggedIn$.next(true);

                    this.roleSubject.next(res.user.role);
                    this.isLoggedIn$.next(true);
                }),

                map(() => void 0)
            );
    }


    // auth.service.ts
    getEmail(): string | null {
        return localStorage.getItem('email') || sessionStorage.getItem('email');
    }

    getUserId(): string {
        // Prioriza email guardado; si hay JWT con sub/email, úsalo.
        const email = this.getEmail();
        if (email) return email;

        const tok = this.getToken();
        const payload = tok ? this.decodeJwt<any>(tok) : null;
        return payload?.email || payload?.sub || 'anon';
    }


    logout() {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('tienda');
        sessionStorage.removeItem('tienda');
        this.roleSubject.next(null); // 👈 Limpiar role al hacer logout
        this.isLoggedIn$.next(false);
        this.router.navigate(['/login']);
    }

    decodeJwt<T = any>(token: string): T | null {
        try {
            // 1) Partimos el token en “header.payload.signature”
            const [, payloadBase64] = token.split('.');
            // 2) Lo decodificamos de Base64
            const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
            // 3) Parseamos el JSON resultante
            return JSON.parse(json) as T;
        } catch {
            return null;
        }
    }


    getToken(): string | null {
        return localStorage.getItem('auth_token') ||
            sessionStorage.getItem('auth_token');
    }

    getTienda(): string | null {
        return localStorage.getItem('tienda') ||
            sessionStorage.getItem('tienda');
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }
}