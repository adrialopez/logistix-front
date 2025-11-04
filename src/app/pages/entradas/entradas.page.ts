import { AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { SelectionModel } from '@angular/cdk/collections';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SelectItem, MessageService } from 'primeng/api';
import { MaterialModule } from 'src/app/material.module';
import { UpdateLotePayload } from 'src/app/model/dto/update-lote-payload';
import { Producto } from 'src/app/model/entity/producto';
import { LoteService } from 'src/app/shared/services/lote.service';
import { Location } from 'src/app/model/entity/location';
import { EntradaService } from 'src/app/shared/services/entrada.service';
import { AppEmployeeDialogContentComponent, ReturnLine } from './entradas-dialog.page';
import { Entry } from 'src/app/model/entity/entry';
import { AuthService } from 'src/app/shared/services/auth.service';
import { ReturnDialogComponent } from '../pedidos/pedido-dialog.page';
import { RouterModule } from '@angular/router';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { MatAutocomplete } from '@angular/material/autocomplete';

interface topcards {
  id: number;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-entradas',
  templateUrl: './entradas.page.html',
  styleUrls: ['./entradas.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    MaterialModule,
    TablerIconsModule,
    RouterModule
  ]
})
export class EntradasPage implements OnInit, AfterViewInit, OnDestroy {
  @Input() compact: boolean = false;
  @Input() showStats: boolean = true;
  @Input() storeId?: string | number;
  @Input() visibleColumns?: string[];
  @ViewChild('autoProducto') autoProducto!: MatAutocomplete;
  @ViewChild('autoVariante') autoVariante!: MatAutocomplete;

  productoInput: string = '';
  varianteInput: string = '';
  locationInput: string = '';
  productos: Producto[] = [];
  variantes: any[] = [];
  locations: Location[] = [];
  entries: Entry[] = [];

  entryEditando: Entry | null = null;
  mostrarModalEdicion = false;
  modoRelativo = false;
  nuevoStock = 0;
  observaciones = '';
  paginaActual = 0;
  lotesPorPagina = 20;

  productoSeleccionado = 'todos';
  // 🟢 empieza vacío, no "todas"
  varianteSeleccionada = '';
  selectedLocation = 0;
  searchTerm = '';
  showDeleted = false;

  totalEntradas = 0;          // NUEVO
  sortBy: string = 'created_at';
  sortDir: 'asc' | 'desc' = 'desc';

  lote = '';
  stock = 0;
  fecha: string | null = '';

  errorMessage = '';
  toastActive = false;
  sortMode: any;

  role: string = '';
  private destroy$ = new Subject<void>();

  selection = new SelectionModel<Entry>(true, []);
  productoOptions: SelectItem[] = [];
  varianteOptions: SelectItem[] = [];
  locationOptions: SelectItem[] = [];

  topcards: topcards[] = [
    { id: 1, color: 'error', icon: 'circle-x', title: 'Peligro Caducidaad', subtitle: '3' },
    { id: 2, color: 'warning', icon: 'alert-circle', title: 'Aviso Caducidad', subtitle: '1' },
    { id: 3, color: 'primary', icon: 'circle-check', title: 'Correctos', subtitle: '24' }
  ];

  resumen = {
    pendientes: 0,
    procesadas: 0,
    retrasadas: 0,
    hoy_procesadas: 0,
    hoy_pendientes: 0,
    hoy_total: 0
  };

  @ViewChild(MatTable, { static: true }) table: MatTable<any> = Object.create(null);
  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;

  displayedColumns: string[] = [];
  isAdmin = false;

  private readonly baseColumns: string[] = [
    'select',
    'reference',
    'client_order_number',
    'tienda_id',
    'status',
    'total_lines',
    'stock_validated',
    'shipping_date',
    'action'
  ];

  dataSource = new MatTableDataSource<Entry>([]);

  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    public dialog: MatDialog,
    private loteService: LoteService,
    private entradaService: EntradaService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.displayedColumns = this.compact && this.visibleColumns?.length
      ? this.filterAllowedColumns([...this.visibleColumns])
      : this.buildColumns();

    this.auth.role$
      .pipe(takeUntil(this.destroy$))
      .subscribe((role: any) => {
        this.role = (role || '').toLowerCase();
        this.isAdmin = this.role === 'admin'; // si lo usas en otros sitios

        // recalcular columnas al cambiar el rol
        this.displayedColumns = this.compact && this.visibleColumns?.length
          ? this.filterAllowedColumns([...this.visibleColumns])
          : this.buildColumns();

        this.cdr.markForCheck();
      });
  }

  ionViewWillEnter() {
    this.loadInitialData();
  }

  ngAfterViewInit(): void {
    this.paginator.pageSize = this.lotesPorPagina;
    this.paginator.page.subscribe(() => this.cargarEntradas());
    // primera carga
    this.cargarEntradas();
  }

  cargarEntradas() {
    const pageIndex = this.paginator ? this.paginator.pageIndex : 0;
    const pageSize = this.paginator ? this.paginator.pageSize : this.lotesPorPagina;

    const productId = this.productoSeleccionado !== 'todos' ? this.productoSeleccionado : undefined;
    const variantId = this.varianteSeleccionada || undefined;
    const warehouse = this.selectedLocation || undefined;

    this.entradaService.getEntradasPaged({
      page: pageIndex,
      pageSize,
      q: (this.searchTerm || '').trim() || undefined,
      product_id: productId,
      variant_id: variantId,
      warehouse_id: warehouse === 0 ? undefined : warehouse,
      sort_by: this.sortBy,
      sort_dir: this.sortDir
    }).subscribe(({ items, total, page, pageSize }) => {
      const normalized = (items || []).map((r: any) => {
        const stock_validated =
          r?.stock_validated === true || r?.stock_validated === 1 || r?.stock_validated === '1';

        const require_warehouse_validation =
          r?.require_warehouse_validation === true || r?.require_warehouse_validation === 1 || r?.require_warehouse_validation === '1'
            ? true
            : (r?.require_warehouse_validation === false || r?.require_warehouse_validation === 0 || r?.require_warehouse_validation === '0'
              ? false
              : undefined);

        const render_stock_validated =
          require_warehouse_validation === false ? true : stock_validated;

        return {
          ...r,
          stock_validated: render_stock_validated,
          require_warehouse_validation
        };
      });

      this.entries = normalized;
      this.dataSource.data = normalized;

      // sincroniza paginator
      this.totalEntradas = total;
      if (this.paginator) {
        this.paginator.length = total;
        if (this.paginator.pageIndex !== page) this.paginator.pageIndex = page;
        if (this.paginator.pageSize !== pageSize) this.paginator.pageSize = pageSize;
      }
    });
  }

  filteredProductos() {
    const q = (this.productoInput || '').toLowerCase().trim();
    return (this.productoOptions || []).filter(o => !q || (o.label || '').toLowerCase().includes(q));
  }

  filteredVariantes() {
    const q = (this.varianteInput || '').toLowerCase().trim();
    return (this.varianteOptions || []).filter(o => !q || (o.label || '').toLowerCase().includes(q));
  }

  filteredLocations() {
    const q = (this.locationInput || '').toLowerCase().trim();
    return (this.locationOptions || []).filter(o => !q || (o.label || '').toLowerCase().includes(q));
  }

  onProductoSelected(value: any) {
    this.productoSeleccionado = value ?? 'todos';
    if (value && value !== 'todos') {
      const opt = this.productoOptions.find(o => o.value === value);
      this.productoInput = opt?.label || '';
    } else {
      this.productoInput = ''; // <- sin texto cuando es 'todos'
    }
    this.onProductoChange();
  }

  onVarianteSelected(value: any) {
    this.varianteSeleccionada = value || '';
    if (this.varianteSeleccionada) {
      const opt = this.varianteOptions.find(o => o.value === this.varianteSeleccionada);
      this.varianteInput = opt?.label || '';
    } else {
      this.varianteInput = '';
    }
    this.onFilter();

    if (this.paginator) this.paginator.firstPage();
    this.cargarEntradas();
  }

  onLocationSelected(value: any) {
    this.selectedLocation = value || 0;
    if (value) {
      const opt = this.locationOptions.find(o => o.value === value);
      this.locationInput = opt?.label || '';
    } else {
      this.locationInput = ''; // <- sin texto cuando es "Todos"
    }
    this.onFilter();

    if (this.paginator) this.paginator.firstPage();
    this.cargarEntradas();
  }

  clearProducto() {
    // limpia UI
    this.productoInput = '';
    this.autoProducto?.options?.forEach(o => o.deselect());

    // limpia estado lógico
    this.productoSeleccionado = 'todos';

    // al no haber producto, no debe haber variantes ni IDs
    this.varianteOptions = [];
    this.varianteSeleccionada = '';
    this.varianteInput = '';
    this.autoVariante?.options?.forEach(o => o.deselect());

    this.onFilter();
  }

  clearVariante() {
    this.varianteInput = '';
    this.varianteSeleccionada = '';
    this.autoVariante?.options?.forEach(o => o.deselect());
    this.onFilter();
  }

  clearLocation() {
    this.locationInput = '';
    this.selectedLocation = 0; // o '' según tu backend
    this.onFilter();
  }

  /** quita la opción “Todos”/vacías para contar opciones reales */
  private realOptions<T extends { value: any }>(arr: T[]) {
    return (arr || []).filter(o => o.value !== '' && o.value !== 'todos' && o.value != null);
  }

  private buildVarianteOptions(productId: any): SelectItem[] {
    if (!this.hasProductSelected()) return []; // sin producto => sin variantes
    const list = (this.variantes || [])
      .filter((v: any) => String(v.id_producto) === String(productId))
      .map((v: any) => ({ label: v.name, value: v.id, product_id: v.id_producto }));
    return [{ label: 'Todas las variantes', value: '' }, ...list];
  }

  /** si hay una sola variante real, la selecciona */
  private tryAutoSelectSingleVariant() {
    const reales = this.realOptions(this.varianteOptions);
    if (reales.length === 1) {
      this.varianteSeleccionada = reales[0].value;
      this.varianteInput = reales[0].label || '';
    } else {
      this.varianteSeleccionada = '';
      this.varianteInput = '';
      this.autoVariante?.options?.forEach(o => o.deselect());
    }
    this.onFilter();
  }

  /** si hay un solo almacén real, lo selecciona */
  private tryAutoSelectSingleLocation() {
    const reales = this.realOptions(this.locationOptions);
    if (reales.length === 1) {
      this.selectedLocation = reales[0].value as any;
      this.locationInput = reales[0].label || '';
    } else {
      this.selectedLocation = 0;
      this.locationInput = '';
    }
    this.onFilter();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  canSeePrivileged(): boolean {
    return this.role === 'admin' || this.role === 'picker';
  }

  private buildColumns(): string[] {
    const cols: string[] = ['select', 'reference', 'client_order_number'];
    if (this.canSeePrivileged()) cols.push('tienda_id');        // Cliente
    cols.push('status', 'total_lines');
    if (this.canSeePrivileged()) cols.push('stock_validated');  // Validar Stock
    cols.push('shipping_date', 'action');
    return cols;
  }

  private filterAllowedColumns(cols: string[]): string[] {
    if (this.canSeePrivileged()) return cols;
    const blocked = new Set(['tienda_id', 'stock_validated']);
    return cols.filter(c => !blocked.has(c));
  }

  hasProductSelected(): boolean {
    return !!this.productoSeleccionado && this.productoSeleccionado !== 'todos';
  }

  applyFilter(value: string) {
    this.searchTerm = (value || '').trim();
    if (this.paginator) this.paginator.firstPage();
    this.cargarEntradas();
  }


  /** Filtro combinado */
  onFilter(): void {
    if (this.paginator) this.paginator.firstPage();
    this.cargarEntradas();
  }

  onProductoChange(): void {
    // al cambiar producto, resetea variante
    this.varianteSeleccionada = '';
    this.varianteInput = '';
    this.autoVariante?.options?.forEach(o => o.deselect());

    // recalcular opciones de variante SOLO del producto elegido
    this.varianteOptions = this.buildVarianteOptions(this.productoSeleccionado);

    // autoselección si hay 1 real
    this.tryAutoSelectSingleVariant();

    if (this.paginator) this.paginator.firstPage();
    this.cargarEntradas();

  }

  /** Eliminar seleccionados */
  deleteSelected(): void {
    const seleccionados = this.selection.selected;
    if (!seleccionados.length) return;

    seleccionados.forEach(row => {
      this.entradaService.deleteEntrada(row.id).subscribe({
        next: () => {
          this.dataSource.data = this.dataSource.data.filter(e => e.id !== row.id);
        },
        error: err => console.error('Error eliminando entrada', err)
      });
    });

    this.selection.clear();
  }

  /** Abre el modal de validación de stock */
  openValidarDialog(row: Entry): void {
    this.entradaService.getEntradaById(row.id).subscribe({
      next: (resp: any) => {
        const entry = Array.isArray(resp) ? resp[0] : resp;
        this.dialog.open(AppEmployeeDialogContentComponent, {
          width: 'auto',
          maxWidth: '95vw',
          data: {
            action: 'Validar',
            entrada: entry,
            productoOptions: this.productoOptions,
            varianteOptions: this.varianteOptions,
            locationOptions: this.locationOptions
          }
        }).afterClosed().subscribe((result) => {
          if (result?.event === 'Validado' || result?.event === 'Refresh') {
            this.cargarEntradas();
          }
        });
      },
      error: err => console.error('Error al abrir validación', err)
    });
  }

  openDialog(
    action: 'Add' | 'Update' | 'Delete' | 'View',
    entry: Entry | null,
    productoOptions: any[],
    varianteOptions: any[],
    locationOptions: any[]
  ): void {
    const po = (productoOptions ?? []).map(o => ({ ...o }));
    const vo = (varianteOptions ?? []).map(o => ({ ...o }));
    const lo = (locationOptions ?? []).map(o => ({ ...o }));

    const abrir = (entrada: Entry | null) => {
      const dialogRef = this.dialog.open(AppEmployeeDialogContentComponent, {
        width: '1200px',
        maxWidth: 'none',
        autoFocus: false,
        data: { action, entrada, productoOptions: po, varianteOptions: vo, locationOptions: lo }
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result?.event === 'Validado' || result?.event === 'Refresh') {
          this.cargarEntradas();
        }
      });
    };

    if (action === 'Add' || action === 'Delete') {
      abrir(action === 'Add' ? null : entry);
      return;
    }

    if (entry?.id) {
      this.entradaService.getEntradaById(entry.id).subscribe({
        next: (resp: any) => {
          const e = Array.isArray(resp) ? resp[0] : resp;
          if (!e) {
            abrir({ ...(entry as Entry), lineas: [] });
            return;
          }

          const lineas = e?.lineas ?? e?.stocklots ?? e?.lines ?? [];

          const entradaNormalizada = {
            ...(e as Entry),
            lineas,
            stock_validated:
              e?.stock_validated === true ||
              e?.stock_validated === 1 ||
              e?.stock_validated === '1'
          };

          abrir(entradaNormalizada);
        },
        error: err => {
          console.error('getEntradaById error', err);
          abrir({ ...(entry as Entry), lineas: [] });
        }
      });
    } else {
      abrir({ ...(entry as Entry), lineas: [] });
    }
  }

  noop() { }

  masterToggle(): void {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.data.forEach((row) => this.selection.select(row));
  }

  isAllSelected(): any {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  checkboxLabel(row?: Entry): string {
    if (!row) return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id + 1}`;
  }

  async loadInitialData() {
    try {
      const productos$ = this.loteService.getProductos();
      const locations$ = this.loteService.getLocations();
      const variantes$ = this.loteService.getAllVariants();
      const resumen$ = this.entradaService.getEntradasResumen();

      // espera todo en paralelo
      const [productos, locations, variantes, resumen] = await Promise.all([
        firstValueFrom(productos$),
        firstValueFrom(locations$),
        firstValueFrom(variantes$),
        firstValueFrom(resumen$),
      ]);

      this.productos = productos ?? [];
      this.locations = locations ?? [];
      this.variantes = variantes ?? [];
      this.resumen = resumen ?? this.resumen;

      // opciones para los autocompletes
      this.productoOptions = [
        { label: 'Todos los productos', value: 'todos' },
        ...this.productos.map(p => ({ label: p.name, value: p.id, image: p.image })),
      ];
      this.locationOptions = [
        { label: 'Todos', value: '' },
        ...this.locations.map(l => ({ label: l.name, value: l.id })),
      ];
      this.varianteOptions = this.buildVarianteOptions(this.productoSeleccionado);

      // autoselección de almacén si hay uno real
      this.tryAutoSelectSingleLocation();

      if (this.paginator) this.paginator.firstPage();
      this.cargarEntradas();
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error cargando datos iniciales', e);
    }
  }

  async cargarLotes() {
    this.entradaService.getEntradas().subscribe((responseData: any) => {
      const rows = Array.isArray(responseData) ? responseData : (responseData?.data ?? []);

      const normalized = rows.map((r: any) => {
        const stock_validated =
          r?.stock_validated === true || r?.stock_validated === 1 || r?.stock_validated === '1';

        // normaliza el flag que viene del backend (true/1/'1', false/0/'0')
        const require_warehouse_validation =
          r?.require_warehouse_validation === true || r?.require_warehouse_validation === 1 || r?.require_warehouse_validation === '1'
            ? true
            : (r?.require_warehouse_validation === false || r?.require_warehouse_validation === 0 || r?.require_warehouse_validation === '0'
              ? false
              : undefined);

        // ⚠️ Si sabemos explícitamente que NO requiere validación, forzamos el render como 'Validado'
        const render_stock_validated =
          require_warehouse_validation === false ? true : stock_validated;

        return {
          ...r,
          stock_validated: render_stock_validated,
          require_warehouse_validation
        };
      });

      this.dataSource.data = normalized;
      this.entries = normalized;
    });
  }

  /** Abre el modal de validación */
  onValidateStock(row: any): void {
    if (!row?.id) return;

    this.entradaService.getEntradaById(row.id).subscribe({
      next: (resp: any) => {
        const entry = Array.isArray(resp) ? (resp[0] ?? row) : (resp ?? row);
        const lines: ReturnLine[] = this.mapToReturnLines(entry);

        const ref = this.dialog.open(ReturnDialogComponent, {
          width: '1200px',
          maxWidth: '95vw',
          data: { entryId: entry.id, reference: entry.reference || null, lines }
        });

        ref.afterClosed().subscribe((result: any) => {
          if (!result) return;

          const req: any = (this.entradaService as any).marcarComoDevuelto(result.entryId, result.items);
          if (req?.subscribe?.call) {
            req.subscribe({
              next: () => {
                row.stock_validated = true as any;
                this.cargarEntradas();
              }
            });
          } else {
            row.stock_validated = true as any;
            this.cargarEntradas();
          }
        });
      },
      error: (err) => {
        console.error('Error al obtener entrada', err);
      }
    });
  }

  private mapToReturnLines(rawEntry: any): ReturnLine[] {
    const lines = rawEntry?.lineas ?? rawEntry?.stocklots ?? rawEntry?.lines ?? [];
    const productos = this.productoOptions || [];
    const variantes = this.varianteOptions || [];

    const findFromOptions = (ln: any) => {
      const psku = ln?.product_sku ?? null;
      const vsku = ln?.variant_sku ?? null;

      const prod = psku ? productos.find((p: any) => p.value === psku) : null;
      const vari = vsku ? variantes.find((v: any) => v.value === vsku) : null;

      const title = prod?.label || vari?.label || ln?.product_name || `${psku || ''}`;
      const image = (prod as any)?.image || ln?.product_image || null;

      return { title, image };
    };

    return (Array.isArray(lines) ? lines : []).map((ln: any) => {
      const { title, image } = findFromOptions(ln);
      return {
        id: Number(ln.id ?? ln.line_id ?? 0),
        product_sku: ln.product_sku ?? '',
        variant_sku: ln.variant_sku ?? null,
        lote_number: ln.lote_number ?? null,
        variant_name: ln.variant_name ?? null,
        product_name: ln.product_name ?? null,
        product_image: image,
        product_label: title,
        qtyOrdered: Number(ln.remaining ?? ln.qty ?? 0),
        qtyReturn: Number(ln.remaining ?? ln.qty ?? 0),
        devolver: true
      } as ReturnLine;
    });
  }
}
