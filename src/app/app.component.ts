// src/app/app.component.ts
import {
  Component,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { filter } from 'rxjs/operators';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// Servicios y módulos
import { AuthService } from './shared/services/auth.service';
import { MaterialModule } from './material.module';
import { SelectItem } from 'primeng/api';
import { UsersService } from './shared/services/users.service';
import { FormsModule } from '@angular/forms';
import { CommonModule, AsyncPipe, NgIf } from '@angular/common';
import { ShopService } from './shared/services/shop.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Angular Material
import { MatSidenavModule, MatSidenav, MatSidenavContent } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

// Breakpoint
import { BreakpointObserver } from '@angular/cdk/layout';
import { IonRouterOutlet } from '@ionic/angular/standalone';

// Loading
import { LoadingService } from './shared/services/loading.service';

// RXJS utilidades para estabilizar el primer render
import { Subject, asapScheduler } from 'rxjs';
import { takeUntil, distinctUntilChanged, observeOn, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    IonRouterOutlet,
    RouterLink, RouterLinkActive,
    MaterialModule, FormsModule, CommonModule,
    MatSidenavModule, MatListModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatButtonModule,
    TranslateModule, NgIf, AsyncPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('leftsidenav') sidenav!: MatSidenav;
  @ViewChild(MatSidenavContent) content!: MatSidenavContent;

  // Difere el primer cambio de loading$ al siguiente microtask para evitar NG0100
  loading$ = this.loading.loading$.pipe(
    distinctUntilChanged(),
    startWith(false),
    observeOn(asapScheduler)
  );

  public appPages = [
  // Vistas comunes (client ve todas estas)
  //{ title: 'menu_logistica',    url: '/logistica',    icon: 'grid_view',         disabled: false, roles: ['admin','tier1','client'] },
  { title: 'menu_entradas',     url: '/entradas',     icon: 'login',             disabled: false, roles: ['admin','tier1','client'] },
  { title: 'menu_pedidos',      url: '/pedidos',      icon: 'description',       disabled: false, roles: ['admin','tier1','client'] },
    { title: 'menu_packgo',       url: '/packgo',       icon: 'archive',       disabled: false, admin: true, roles: ['admin','tier1', 'picker'] },
  { title: 'menu_productos',    url: '/productos',    icon: 'inventory_2',       disabled: false, roles: ['admin','tier1','client'] },
  { title: 'menu_lotes',        url: '/lotes',        icon: 'timer',             disabled: false, roles: ['admin','tier1','client'] },
  { title: 'menu_trazabilidad', url: '/trazabilidad', icon: 'receipt_long',      disabled: false, roles: ['admin','tier1','client'] },
  { title: 'menu_tickets',      url: '/tickets',      icon: 'confirmation_number', disabled:false, roles: ['admin','client'] },
  { title: 'menu_almacenes',    url: '/locations',    icon: 'storefront',        disabled: false, roles: ['admin','tier1','client'] },

  { title: 'menu_facturacion',  url: '/facturacion',  icon: 'payments',          disabled: false, admin: true, roles: ['admin'] },
  { title: 'menu_usuarios',     url: '/users',        icon: 'people',            disabled: false, admin: true, roles: ['admin'] },

  // Vistas NO admin-exclusivas pero ocultas para tier1 (client sí las ve)
  { title: 'menu_ajustes',      url: '/ajustes',      icon: 'settings',          disabled: false, roles: ['admin','tier1','client'] },

  // Exclusivas de admin (tenían admin: true)

  // Acción
  { title: 'menu_cerrar_sesion', url: '',             icon: 'logout', action: 'logout', disabled: false, roles: ['admin','tier1','client','picker'] },
];

  userEmail: string | null = '';
  role: string | null = 'client';
  usersOptions: SelectItem[] = [];
  userSeleccionado: string | null = null;

  public showMenu = false;
  public isOver = false;
  currentLang: string;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private auth: AuthService,
    private usersService: UsersService,
    private shopService: ShopService,
    private breakpointObserver: BreakpointObserver,
    private translate: TranslateService,
    private loading: LoadingService,
    private cdr: ChangeDetectorRef
  ) {
    const savedLang = localStorage.getItem('lang') || 'es';
    this.translate.setDefaultLang(savedLang);
    this.translate.use(savedLang);
    this.currentLang = savedLang;
  }

  ngOnInit(): void {
    // Detectar móvil / modo "over"
    this.breakpointObserver
      .observe(['(max-width: 1023px)'])
      .pipe(takeUntil(this.destroy$))
      .subscribe(r => {
        this.isOver = r.matches;
        this.cdr.markForCheck();
      });

    // Estado login (muestra/oculta menú y email)
    this.auth.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe((logged: any) => {
        this.showMenu = logged;
        this.userEmail = localStorage.getItem('email') || sessionStorage.getItem('email');
        this.cdr.markForCheck();
      });

    // Rol y simulador
    this.auth.role$
      .pipe(takeUntil(this.destroy$))
      .subscribe(role => {
        this.role = role;
        if (this.role === 'admin') {
          this.usersService.getUsers()
            .pipe(takeUntil(this.destroy$))
            .subscribe(responseData => {
              this.usersOptions = [
                { label: this.translate.instant('no_simular'), value: null },
                ...responseData.map(p => ({ label: p.email, value: p.tienda_id })),
              ];
              this.userSeleccionado = null;
              this.cdr.markForCheck();
            });
        } else {
          this.usersOptions = [];
          this.cdr.markForCheck();
        }
      });
  }

  ngAfterViewInit(): void {
    // Scroll al top en cada navegación
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntil(this.destroy$))
      .subscribe(() => this.content?.scrollTo({ top: 0 }));

    // Sella el primer render por si algo cambió durante el bootstrap
    queueMicrotask(() => this.cdr.detectChanges());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

    get visiblePages() {
    return this.appPages.filter(p => this.canViewPage(p));
  }

  private canViewPage(page: any): boolean {
    if (page.disabled) return false;
    const current = this.role ?? 'client';
    if (!page.roles) return true;
    return page.roles.includes(current);
  }

  changeLang(lang: string) {
    this.translate.use(lang);
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
  }

  onMenuClick(page: any) {
    if (page.action === 'logout') {
      this.auth.logout();
    }
  }

  onUserChange(nuevo: string | null) {
    if (this.userSeleccionado) {
      this.shopService.setShop(this.userSeleccionado);
    } else {
      // Poner la tienda de userEmail (si aplica)
    }
  }
}
