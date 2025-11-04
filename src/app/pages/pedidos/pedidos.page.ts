import { Component, OnInit, ViewChild, AfterViewInit, HostListener, Input, HostBinding, OnChanges, SimpleChanges, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { ViewWillEnter } from '@ionic/angular';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { OrdersService } from 'src/app/shared/services/orders.service';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LoteService } from 'src/app/shared/services/lote.service';
import { PedidoDialogComponentContent } from './pedido-dialog.page';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, interval } from 'rxjs';


import { applyCanonical, badgeClass, countByStatus, isEditable, type Canon } from 'src/app/shared/status-mapper';

// Configuración del paginador en español
export function getPaginatorIntl() {
  const paginatorIntl = new MatPaginatorIntl();

  paginatorIntl.itemsPerPageLabel = 'Items por página:';
  paginatorIntl.nextPageLabel = 'Siguiente página';
  paginatorIntl.previousPageLabel = 'Página anterior';
  paginatorIntl.firstPageLabel = 'Primera página';
  paginatorIntl.lastPageLabel = 'Última página';

  return paginatorIntl;
}

@Component({
  selector: 'app-pedidos',
  templateUrl: './pedidos.page.html',
  styleUrls: ['./pedidos.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [
    { provide: MatPaginatorIntl, useValue: getPaginatorIntl() }
  ],
  imports: [
    CommonModule,
    MaterialModule,
    TablerIconsModule,
    TranslateModule,
    RouterModule
  ],
})
export class PedidosPage implements OnInit, AfterViewInit, OnChanges, ViewWillEnter, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @Input() compact: boolean = false; // permite [compact] desde Logística
  @Input() presetFilter?: { preparedToday?: boolean; pendingPrepare?: boolean }; // <-- añadido
  @HostBinding('class.compact') get hostCompact() { return !!this.compact; }

  public categoryFilter: '' | Canon = ''; // tipado al canónico
  public isEditable = isEditable;

  nextSyncAt: Date | null = null;
  countdownText = 'Próxima sincronización: 2:00 minutos';
  private countdownSub?: Subscription;
  private _catalogsLoaded: boolean = false;

  isRefreshing = false;

  productos: any[] = [];
  variantes: any[] = [];
  carriers: any[] = [];
  smethods: any[] = [];
  selectedCategory: string = '';
  productoOptions: any[] = [];
  varianteOptions: any[] = [];
  carriersOptions: any[] = [];
  smethodsOptions: any[] = [];
  pedidosPorPagina: number = 20;
  totalCount: number = 0;
  stats: any;
  searchText: string = '';
  pedidos: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns = [
    'index', 'pais', 'order_number', 'status', 'cliente', 'tracking', 'fecha', 'importe', 'action'
  ];
  shop: string = '';

  private scanBuffer = '';
  private lastKeyTime = 0;
  private readonly SCAN_INTERCHAR_MS = 1000;
  private readonly FINISH_KEYS = new Set(['Enter', 'Tab']);

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(ev: KeyboardEvent) {
    // No interceptar si el foco está en un input/textarea/select
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (ev.target as HTMLElement)?.isContentEditable) {
      return;
    }

    const now = Date.now();
    if (now - this.lastKeyTime > this.SCAN_INTERCHAR_MS) {
      this.scanBuffer = '';
    }
    this.lastKeyTime = now;

    if (this.FINISH_KEYS.has(ev.key)) {
      ev.preventDefault();
      const code = this.scanBuffer.trim();
      this.scanBuffer = '';
      this.processScan(code);
      return;
    }

    // Solo acumulamos teclas “visibles” (letras/números)
    if (ev.key.length === 1) {
      this.scanBuffer += ev.key;
    }
  }

  constructor(
    private http: HttpClient,
    private orderService: OrdersService,
    public dialog: MatDialog,
    private loteService: LoteService,
    private translate: TranslateService,
    private snackBar: MatSnackBar,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {

    // ajustar columnas y paginado en modo compacto
    if (this.compact) {
      this.displayedColumns = ['order_number', 'status', 'fecha'];
      this.pedidosPorPagina = 5;
    }

    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const normalizedFilter = JSON.parse(filter); // Usamos un JSON con ambos filtros
      const search = normalizedFilter.search?.toLowerCase() || '';
      const cat: '' | Canon = normalizedFilter.category || '';

      const matchesSearch =
        data.order_number?.toString().toLowerCase().includes(search) ||
        data.status?.toLowerCase().includes(search) ||
        data.customer_name?.toLowerCase().includes(search) ||
        data.created_at?.toLowerCase().includes(search) ||
        data.total_amount?.toString().toLowerCase().includes(search) ||
        data.country?.toLowerCase().includes(search) ||
        (data.tracking_number ?? '').toString().toLowerCase().includes(search);

      const matchesCategory = cat === '' ? true : data._canonicalStatus === cat;


      return matchesSearch && matchesCategory;
    };

    this.startSyncCountdown();

  }

  ngOnDestroy() {
    this.countdownSub?.unsubscribe();
  }

  private startSyncCountdown(): void {
    this.nextSyncAt = this.computeNextSync();

    this.countdownSub?.unsubscribe();

    // Creamos el intervalo fuera de Angular para no calentar el árbol…
    this.ngZone.runOutsideAngular(() => {
      this.countdownSub = interval(1000).subscribe(() => {
        const now = Date.now();
        const target = this.nextSyncAt!.getTime();
        let diff = target - now;

        if (diff <= 0) {
          // siguiente tick a +2 min exactos
          const nxt = new Date(target);
          nxt.setMinutes(nxt.getMinutes() + 2);
          this.nextSyncAt = nxt;
          diff = this.nextSyncAt.getTime() - Date.now();
        }

        const txt = this.formatCountdown(diff);

        // …pero actualizamos el estado DENTRO de Angular y marcamos para check
        this.ngZone.run(() => {
          this.countdownText = txt;
          this.cdr.markForCheck();    // o this.cdr.detectChanges() si lo prefieres
        });
      });
    });
  }

  ngAfterViewInit() {

    // cuando cambie el ordenado, volvemos a la primera página y recargamos
    this.sort.sortChange.subscribe(() => {
      if (this.paginator) this.paginator.firstPage();
      this.cargarPedidos(true);
    });

    // cuando cambie la página, recargamos
    this.paginator.page.subscribe(() => this.cargarPedidos(true));
  }

  private computeNextSync(from: Date = new Date()): Date {
    // Queremos el siguiente hh:(par):10
    const base = new Date(from);
    base.setMilliseconds(0);
    base.setSeconds(10);

    // Si minuto es impar, saltamos al siguiente minuto (que será par)
    if (base.getMinutes() % 2 !== 0) {
      base.setMinutes(base.getMinutes() + 1);
    }

    // Si ya hemos pasado ese :10 del minuto par, saltamos +2 minutos
    if (base <= from) {
      base.setMinutes(base.getMinutes() + 2);
    }

    return base;
  }

  private formatCountdown(ms: number): string {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    const mmStr = String(mm);
    const ssStr = ss.toString().padStart(2, '0');
    return `Próxima sincronización: ${mmStr}:${ssStr} minutos`;
  }


  private processScan(raw: string) {
    const code = (raw || '').trim();
    if (!code) return;

    const clean = (v: any) =>
      (v ?? '')
        .toString()
        .replace(/^#/, '')           // quita '#' inicial
        .replace(/[^a-zA-Z0-9]/g, '') // quita todo lo que no sea letra o número
        .trim()
        .toUpperCase();


    const match = this.pedidos.find(p => clean(p.order_number) === clean(code));
    if (match) {
      // Abre el diálogo en modo View (ya tienes verDetalles hecho)
      this.verDetalles(match);
    } else {
      // Si quieres feedback cuando no encuentra, puedes poner un snackbar o console.log
      // console.warn('Código no corresponde a ningún order_number:', code);
    }
  }

  private async refreshCatalogs(): Promise<void> {
    // Si prefieres no tocar carriers/smethods, puedes quitar esas dos llamadas
    const productos = await this.loteService.getProductos().toPromise() ?? [];
    const variantes = await this.loteService.getAllVariants().toPromise() ?? [];
    const carriers = await this.orderService.getCarriers().toPromise() ?? [];
    const smethods = await this.orderService.getShippingMethods().toPromise() ?? [];

    this.productos = productos;
    this.variantes = variantes;
    this.carriers = carriers;
    this.smethods = smethods;

    // reconstruye las opciones igual que en cargarPedidos()
    this.productoOptions = [
      { label: this.translate.instant('todos_los_productos'), value: 'todos' },
      ...this.productos.map(p => ({ label: p.name, value: p.id, image: p.image })),
    ];

    this.varianteOptions = [
      { label: this.translate.instant('todas_las_variantes'), value: 'todos' },
      ...this.variantes.map(v => ({
        label: v.name,
        value: v.id,
        product_id: v.id_producto,
        sku: v.sku,
        weight: v.weight,
        price: v.price,
        total_units: v.stock_total
      })),
    ];

    this.carriersOptions = [
      { label: this.translate.instant('todos_los_carriers'), value: 'todos' },
      ...this.carriers.map(c => ({ label: c.label, value: c.value })),
    ];

    this.smethodsOptions = [
      { label: this.translate.instant('todos_los_metodos'), value: 'todos' },
      ...this.smethods.map(m => ({ label: m.label, value: m.value })),
    ];

    // Ya están recargados; mantenemos el flag en true
    this._catalogsLoaded = true;

    // fuerza refresco visual si hace falta
    this.cdr.markForCheck();
  }

  refreshAll(): void {
    this._catalogsLoaded = false;          // <- fuerza recarga de catálogos
    if (this.paginator) this.paginator.firstPage(); // opcional: vuelve a la página 1
    this.isRefreshing = true;
    this.cargarPedidos(false);             // <- NO saltar catálogos

    // desactivar el spinner cuando acabe cargarPedidos
    // (pon esto dentro de cargarPedidos, ver abajo)
  }

  async cargarPedidos(skipCatalogs: boolean = false) {
    // Catálogos (opciones de selects)
    if (!skipCatalogs && !this._catalogsLoaded) {
      this.productos = await this.loteService.getProductos().toPromise() ?? [];
      this.variantes = await this.loteService.getAllVariants().toPromise() ?? [];
      this.carriers = await this.orderService.getCarriers().toPromise() ?? [];
      this.smethods = await this.orderService.getShippingMethods().toPromise() ?? [];

      this.productoOptions = [
        { label: this.translate.instant('todos_los_productos'), value: 'todos' },
        ...this.productos.map(p => ({ label: p.name, value: p.id, image: p.image })),
      ];
      this.varianteOptions = [
        { label: this.translate.instant('todas_las_variantes'), value: 'todos' },
        ...this.variantes.map(v => ({
          label: v.name,
          value: v.id,
          product_id: v.id_producto,
          sku: v.sku,
          weight: v.weight,
          price: v.price,
          total_units: v.stock_total
        })),
      ];
      this.carriersOptions = [
        { label: this.translate.instant('todos_los_carriers'), value: 'todos' },
        ...this.carriers.map(c => ({ label: c.label, value: c.value })),
      ];
      this.smethodsOptions = [
        { label: this.translate.instant('todos_los_metodos'), value: 'todos' },
        ...this.smethods.map(m => ({ label: m.label, value: m.value })),
      ];
      this._catalogsLoaded = true;
    }
    // Parámetros de paginación/ordenación (Angular usa 0-based; backend 1-based)
    const page0 = this.paginator ? this.paginator.pageIndex : 0;
    const page = page0; // ← 1-based para el backend
    const pageSize = this.paginator ? this.paginator.pageSize : this.pedidosPorPagina;
    const sortBy = this.sort?.active || 'created_at';
    const sortDir = (this.sort?.direction as 'asc' | 'desc') || 'desc';

    this.isRefreshing = true;
    this.orderService.getOrders({
      page,
      pageSize,
      search: this.searchText,
      sortBy,
      sortDir,
      statusCanon: this.categoryFilter || undefined
    }).subscribe(
      (responseData) => {
        const rows = Array.isArray(responseData?.rows) ? responseData.rows : [];

        // Normaliza/etiqueta para la UI
        const pedidos = rows.map((o: any) => {
          o._preparedDate = o.preparedAt || o.prepared_at || o.shipped_at || o.shippedAt || o.completed_at || o.completedAt || o.shipping_date || o.created_at || null;
          o._statusNormalized = (o.status || o.state || '').toString().toLowerCase();
          return o;
        });

        this.pedidos = pedidos;

        // Total **global** que manda el backend
        this.totalCount = Number(responseData?.total ?? 0);
        this.stats = responseData?.stats;

        // Carga en tabla (si tienes un presetFilter que filtra en cliente, quítalo para no romper el total)
        if (this.presetFilter) {
          this.applyPresetFilter(); // OJO: esto cambia length al filtrado local
        } else {
          this.dataSource.data = this.pedidos;
        }
        this.isRefreshing = false;
      },
      (err) => {
        console.error('Error cargando pedidos:', err);
        this.pedidos = [];
        this.dataSource.data = [];
        this.totalCount = 0;
        this.isRefreshing = false;
      }
    );
  }




  // Aplica el presetFilter (preparados hoy + pendientes de preparar)
  applyPresetFilter(): void {
    if (!this.presetFilter) return;
    const f = this.presetFilter;
    const today = new Date();
    const isSameDay = (d: Date) => d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

    const pendingKeywords = [
      'unfulfilled', 'processing', 'on hold', 'pending', 'sin_preparar', 'pendiente', 'pendiente_preparar', 'to_prepare', 'to_pack', 'por_preparar'
    ];
    // Usar OR: incluir pedidos que sean preparados hoy OR pendientes de preparar
    const preparedSet = new Set<string>();
    const filteredList: any[] = [];

    (this.pedidos || []).forEach((o: any) => {
      const st = o._statusNormalized || '';
      const raw = o._preparedDate;
      const d = raw ? new Date(raw) : null;

      const isPreparedToday = f.preparedToday ? (!!d && isSameDay(d)) : false;
      const isPending = f.pendingPrepare ? pendingKeywords.some(k => st.includes(k)) : false;

      if (isPreparedToday || isPending) {
        // evitar duplicados por order_id / order_number
        const key = o.order_id ?? o.order_number ?? JSON.stringify(o);
        if (!preparedSet.has(key)) {
          preparedSet.add(key);
          filteredList.push(o);
        }
      }
    });

    const filtered = filteredList;

    this.dataSource.data = filtered;
    //this.totalCount = filtered.length;
  }

  // Método para manejar clics en las categorías
  btnCategoryClick(category: '' | Canon) {
    this.selectedCategory = category;
    this.categoryFilter = category;
    this.updateFilter();
  }

  // Método para contar tickets por estado
  countTicketsByStatus(c: Canon): number {
    return countByStatus(this.pedidos, c);
  }

  async ionViewWillEnter(): Promise<void> {
    await this.refreshCatalogs();
    this.cargarPedidos(true);
  }

  // Método para manejar eventos de búsqueda
  onKeyup(event: any) {
    this.searchText = event.target.value;
    this.updateFilter();
  }

  updateFilter() {
    if (this.paginator) this.paginator.firstPage();
    this.cargarPedidos(true);
  }
  // Método para abrir un diálogo (ejemplo)
  openDialog(action: string, productoOptions: any, shop: string, pedido: any = null, varianteOptions: any, smethodsOptions: any, carriersOptions: any): void {
    const dialogRef = this.dialog.open(PedidoDialogComponentContent, {
      width: '1200px',
      maxWidth: 'none',
      panelClass: 'pedido-dialog-custom',
      autoFocus: false,
      data: { action, productoOptions, shop, pedido, varianteOptions, smethodsOptions, carriersOptions } // 👈 añadimos pedido aquí
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && (result.event === 'Refresh' || result.event === 'Update')) {
        await this.refreshCatalogs();
        this.cargarPedidos(true);
      }

      if (result.created === true) {
        await this.refreshCatalogs();
        this.cargarPedidos(true);
        const msg = this.translate.instant('listado_actualiza_en_sync')
          || 'Para que aparezca el pedido en la lista, espera a la próxima sincronización.';
        this.snackBar.open(msg, this.translate.instant('cerrar') || 'Cerrar', {
          duration: 4500,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    });
  }


  verDetalles(pedido: any) {
    this.orderService.getOrderById(pedido.order_id).subscribe((pedidoCompleto) => {
      this.openDialog('View', this.productoOptions, this.shop, pedidoCompleto, this.varianteOptions, this.smethodsOptions, this.carriersOptions);
    });
  }

  openEditar(pedidoResumen: any) {
    this.orderService.getOrderById(pedidoResumen.order_id).subscribe((pedidoCompleto) => {
      this.openDialog('Update', this.productoOptions, this.shop, pedidoCompleto, this.varianteOptions, this.smethodsOptions, this.carriersOptions);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Si cambian los datos del presetFilter y ya tenemos pedidos cargados, reaplicar el filtro
    if (changes['presetFilter'] && this.pedidos && this.pedidos.length) {
      if (this.presetFilter) {
        this.applyPresetFilter();
      } else {
        this.dataSource.data = this.pedidos;
        this.totalCount = this.pedidos.length;
      }
    }
  }

  cancelPedido(pedidoResumen: any) {
    const orderId = pedidoResumen?.order_id;
    if (!orderId) return;

    // Confirmación rápida (puedes cambiarlo por un MatDialog si prefieres)
    const ok = confirm(this.translate.instant('confirmar_cancelacion') || '¿Seguro que deseas cancelar este pedido?');
    if (!ok) return;

    this.isRefreshing = true;
    this.orderService.deletePedido(orderId).subscribe({
      next: async () => {
        // recarga catálogos si procede y refresca listado
        await this.refreshCatalogs();
        this.cargarPedidos(true);

        this.snackBar.open(
          this.translate.instant('pedido_cancelado_ok') || 'Pedido cancelado correctamente.',
          this.translate.instant('cerrar') || 'Cerrar',
          { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top' }
        );
        this.isRefreshing = false;
      },
      error: (err) => {
        console.error('Error al cancelar pedido:', err);
        this.snackBar.open(
          this.translate.instant('pedido_cancelado_error') || 'No se pudo cancelar el pedido.',
          this.translate.instant('cerrar') || 'Cerrar',
          { duration: 4000, horizontalPosition: 'center', verticalPosition: 'top' }
        );
        this.isRefreshing = false;
      }
    });
  }

}


