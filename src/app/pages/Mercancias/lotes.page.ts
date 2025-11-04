import { Component, Inject, OnInit, Optional, ViewChild, Input, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { LoteService } from 'src/app/shared/services/lote.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MessageService, SelectItem } from 'primeng/api';
import { Variante } from 'src/app/model/entity/variante';
import { UpdateLotePayload } from 'src/app/model/dto/update-lote-payload';
import { Producto } from 'src/app/model/entity/producto';
import { Location } from 'src/app/model/entity/location';
import { CreateLotePayload } from 'src/app/model/dto/create-lote-payload';
import { TablerIconsModule } from 'angular-tabler-icons';
import { StockLot } from 'src/app/model/entity/stocklot';
import { SelectionModel } from '@angular/cdk/collections';
import { SettingsService } from 'src/app/shared/services/settings.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { take } from 'rxjs';

interface topcards {
  id: number;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-lotes',
  templateUrl: './lotes.page.html',
  styleUrls: ['./lotes.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    MaterialModule,
    TablerIconsModule,
    TranslateModule,
    RouterModule
  ],
  providers: []
})
export class LotesPage implements OnInit {
  @Input() compact: boolean = false;
  @Input() showOnlySearch: boolean = false;
  @Input() visibleColumns?: string[];


  productos: Producto[] = [];
  variantes: Variante[] = [];
  locations: Location[] = [];
  lotes: StockLot[] = [];

  totalLotes = 0;
  sortBy: 'created_at' | 'expiration_date' | 'remaining' | 'lote_number' | 'product_name' = 'created_at';
  sortDir: 'asc' | 'desc' = 'desc';

  loteEditando: StockLot | null = null;
  mostrarModalEdicion = false;
  modoRelativo = false;
  nuevoStock = 0;
  observaciones = '';
  paginaActual = 0;
  lotesPorPagina = 20;

  caducidades = {
    peligro: 0,
    warning: 0,
    ok: 0
  }


  productoSeleccionado = 'todos';
  varianteSeleccionada = 'todas';
  selectedLocation = 0;
  searchTerm = '';
  showDeleted = false;

  lote = '';
  stock = 0;
  fecha: string | null = '';


  errorMessage = '';
  toastActive = false;
  sortMode: any;

  selection = new SelectionModel<StockLot>(true, []);
  productoOptions: SelectItem[] = [];
  varianteOptions: SelectItem[] = [];
  locationOptions: SelectItem[] = [];
  topcards: topcards[] = [];

  constructor(
    private messageService: MessageService,
    public dialog: MatDialog,
    private loteService: LoteService,
    private settingsSvc: SettingsService,
    private translate: TranslateService // Añade esto
  ) { }

  async cargarCaducidades() {
    try {
      this.caducidades = await this.loteService.getCaducidades().toPromise();

      this.topcards = [
        {
          id: 1,
          color: 'error',
          icon: 'circle-x',
          title: this.translate.instant('peligro_caducidad'),
          subtitle: this.caducidades.peligro.toString(),
        },
        {
          id: 2,
          color: 'warning',
          icon: 'alert-circle',
          title: this.translate.instant('aviso_caducidad'),
          subtitle: this.caducidades.warning.toString(),
        },
        {
          id: 3,
          color: 'primary',
          icon: 'circle-check',
          title: this.translate.instant('correctos'),
          subtitle: this.caducidades.ok.toString(),
        }
      ];
    } catch (error) {
      console.error('Error cargando caducidades:', error);
    }
  }

  //TEMPLATE

  @ViewChild(MatTable, { static: true }) table: MatTable<any> =
    Object.create(null);

  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;


  searchText: any;

  displayedColumns = [
    'select',
    'lote_number',
    'producto',
    'almacen',
    'restante',
    'caducidad',
    'action'
  ];

  dataSource = new MatTableDataSource<StockLot>([]);

  async ngOnInit() {
    if (this.compact && this.visibleColumns?.length) {
      this.displayedColumns = [...this.visibleColumns];
    } else if (this.compact) {
      this.displayedColumns = ['producto', 'caducidad', 'restante'];
      this.lotesPorPagina = 5;
    }

    await this.loadInitialData();
    this.cargarCaducidades();
    this.cargarLotes(); // primera carga
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visibleColumns'] && this.compact && Array.isArray(this.visibleColumns)) {
      this.displayedColumns = [...this.visibleColumns!];
    }
  }

  // Filtra lotes con caducidad en los próximos `days` días y actualiza dataSource (usado en modo compact)
  applyUpcomingFilter(days: number = 30): void {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + days);

    const filtered = (this.lotes || []).filter(l => {
      const anyL = l as any;
      const raw = anyL.expiration_date ?? anyL.fecha_caducidad ?? anyL.expire_at ?? anyL.expiry_date ?? anyL.expires_at;
      if (!raw) return false;
      const expirationDate = new Date(raw);
      return expirationDate >= today && expirationDate <= maxDate;
    });

    this.dataSource.data = filtered;
    this.paginator.pageIndex = 0;
  }

  ionViewWillEnter() {

    this.loadInitialData();
    this.cargarLotes();
    this.cargarCaducidades();
  }
  ngAfterViewInit(): void {
    this.paginator.pageSize = this.lotesPorPagina;

    // Recarga al cambiar de página/tamaño
    this.paginator.page.subscribe(() => {
      this.cargarLotes();
    });
  }

  applyFilter(filterValue: string): void {
    this.searchTerm = (filterValue || '').trim();
    if (this.paginator) this.paginator.firstPage();
    this.cargarLotes();
  }

  openDialog(action: string, stocklot: StockLot | any, productoOptions: any, varianteOptions: any, locationOptions: any): void {
    const dialogRef = this.dialog.open(AppEmployeeDialogContentComponent, {
      data: { action, stocklot, productoOptions, varianteOptions, locationOptions }, autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.cargarLotes();
      if (result && result.event === 'Refresh') {
        this.cargarLotes();
      }
    });
  }

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

  checkboxLabel(row?: StockLot): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id + 1
      }`;
  }
  get deshabilitado() {
    return this.productoSeleccionado === 'todos';
  }

  get filteredLotes() {
    return this.lotes.filter(l => {
      const matchesSearch = l.lote_number.includes(this.searchTerm)
        || l.product_name.toLowerCase().includes(this.searchTerm.toLowerCase())
        || l.variant_name.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesDeleted = this.showDeleted ? true : l.is_deleted === false;
      const matchesLocation = this.selectedLocation ? l.warehouse_id === this.selectedLocation : true;
      const matchesStock = this.showDeleted ? true : l.remaining > 0;
      return matchesSearch && matchesDeleted && matchesLocation && matchesStock;
    });
  }

  get lotesAMostrar() {
    return this.filteredLotes.slice(this.paginaActual * this.lotesPorPagina, (this.paginaActual + 1) * this.lotesPorPagina);
  }


  async loadInitialData() {
    try {
      this.productos = await this.loteService.getProductos().toPromise() ?? [];
      this.locations = await this.loteService.getLocations().toPromise() ?? [];

      this.productoOptions = [
        { label: 'todos_los_productos', value: 'todos' },
        ...this.productos.map(p => ({ label: p.name || '', value: p.id })),
      ];
      this.locationOptions = [
        { label: this.translate.instant('todos_los_almacenes'), value: '' },
        ...this.locations.map(l => ({ label: l.name, value: l.id })),
      ];

      this.cargarLotes();
    } catch (e) {
      console.error('Error cargando datos iniciales', e);
    }
  }

  onFilter() {
    if (this.paginator) this.paginator.firstPage();
    this.cargarLotes();
  }
  onPage(event: any) {
    this.paginaActual = event.page;
    this.lotesPorPagina = event.rows;
  }

  deleteSelected(): void {
    const selectedIds = this.selection.selected.map((item) => item.id);
    if (selectedIds.length > 0) {
      this.openDialog('Delete', selectedIds, null, null, null);
    }


  }

  cargarLotes() {
    const pageIndex = this.paginator ? this.paginator.pageIndex : 0;     // 0-based
    const pageSize = this.paginator ? this.paginator.pageSize : this.lotesPorPagina;

    const productId = this.productoSeleccionado !== 'todos' ? this.productoSeleccionado : undefined;
    const variantId = this.varianteSeleccionada !== 'todas' ? this.varianteSeleccionada : undefined;
    const warehouse = this.selectedLocation || undefined;

    this.loteService.getLotesPaged({
      page: pageIndex,
      pageSize: pageSize,
      q: this.searchTerm || undefined,
      include_deleted: this.showDeleted,
      product_sku: productId,
      variant_sku: variantId,
      warehouse_id: warehouse === 0 ? undefined : warehouse,
      // misma lógica que tenías: si NO mostramos eliminados, ocultar remaining=0
      hide_zero: !this.showDeleted,
      sort_by: this.sortBy,
      sort_dir: this.sortDir
    })
      .subscribe(({ items, total, page, pageSize }) => {
        this.lotes = items.map(l => ({
          ...l,
          variante_nombre: l.variant_name || '—',
          // en paginado la “llegada” es created_at, no arrival_date
          fecha_caducidad: l.expiration_date ? new Date(l.expiration_date).toLocaleDateString() : null
        }));

        this.dataSource.data = this.lotes;

        this.totalLotes = total;                // ← importante para el paginator

        // sincroniza (opcional; el binding en HTML ya lo pinta)
        if (this.paginator) {
          this.paginator.length = total;
        }
      });
  }




  async handleEliminarLote(id: number) {
    if (!confirm('¿Seguro?')) return;
    this.loteService.deleteLote(id).subscribe(() => this.cargarLotes());
  }

  onSort(ev: { active: string; direction: 'asc' | 'desc' | '' }) {
    const map: any = {
      caducidad: 'expiration_date',
      Llegada: 'created_at',
      restante: 'remaining',
      lote_number: 'lote_number',
      producto: 'product_name'
    };
    this.sortBy = map[ev.active] || 'created_at';
    this.sortDir = (ev.direction || 'desc') as any;
    if (this.paginator) this.paginator.firstPage();
    this.cargarLotes();
  }

  onProductoChange(): void {
    // reset selección de variante siempre que cambie el producto
    this.variantes = [];
    this.varianteSeleccionada = 'todas';
    this.varianteOptions = [
      { label: this.translate.instant('todas_las_variantes'), value: 'todas' },
    ];

    // si es "todos", no pidas variantes ni settings
    if (this.productoSeleccionado === 'todos') {
      if (this.paginator) this.paginator.firstPage();
      this.cargarLotes();
      return;
    }

    // cargar variantes del producto seleccionado (solo para el selector)
    this.loteService.getVariants(this.productoSeleccionado).subscribe({
      next: (vars) => {
        this.variantes = vars || [];
        this.varianteOptions = [
          { label: this.translate.instant('todas_las_variantes'), value: 'todas' },
          ...this.variantes.map(v => ({ label: v.name, value: v.id })),
        ];
      },
      error: (err) => console.error('getVariants error', err)
    });

    // (opcional) cargar sortMode del producto; no bloquea la carga de lotes
    this.loteService.getSettings(this.productoSeleccionado).subscribe({
      next: (sett) => (this.sortMode = sett?.sortMode),
      error: (err) => console.error('getSettings error', err)
    });

    // recarga lista desde página 0
    if (this.paginator) this.paginator.firstPage();
    this.cargarLotes();
  }

  /**
   * Abre el modal de edición rellenando los campos con los datos del lote
   * @param l lote a editar
   */
  abrirModalEdicion(l: StockLot) {
    // Parseo de fecha a YYYY-MM-DD para el input <p-calendar>
    const parseFecha = (f: string | null) => {
      if (!f) return ''; // Si no hay fecha, retorna una cadena vacía
      const [d, m, y] = f.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    this.loteEditando = { ...l };
    this.modoRelativo = false;
    this.nuevoStock = l.remaining;
    this.observaciones = '';
    this.fecha = l.expiration_date ? parseFecha(l.expiration_date.toString()) : null;
    this.mostrarModalEdicion = true;
  }

  /**
   * Guarda los cambios realizados en el modal y recarga la lista
   */
  async guardarEdicion() {
    if (!this.loteEditando) return;
    const payload: UpdateLotePayload = {
      id: this.loteEditando.id,
      warehouse_id: this.selectedLocation,
      lote_number: this.loteEditando.lote_number,
      expiration_date: this.fecha || null, // Si no hay fecha, envía `null`
      observations: this.observaciones,
      remaining: this.nuevoStock
    };

    this.loteService.updateLote(payload).subscribe(() => {
      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Lote actualizado' });
      this.mostrarModalEdicion = false;
      this.cargarLotes();
    });
  }

  isWarning(expirationDate: string): boolean {
    const daysToExpire = this.calculateDaysToExpire(expirationDate);
    return daysToExpire > this.settingsSvc.getCriticalDays() && daysToExpire <= this.settingsSvc.getWarningDays();
  }

  isDanger(expirationDate: string): boolean {
    const daysToExpire = this.calculateDaysToExpire(expirationDate);
    return daysToExpire <= this.settingsSvc.getCriticalDays();
  }

  isCorrect(expirationDate: string): boolean {
    const daysToExpire = this.calculateDaysToExpire(expirationDate);
    return daysToExpire > this.settingsSvc.getWarningDays();
  }

  calculateDaysToExpire(expirationDate: string): number {
    const today = new Date();
    const expiration = new Date(expirationDate);
    const diffTime = expiration.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convertir milisegundos a días
  }

}

interface DialogData {
  action: string;
  productoOptions: any;
  varianteOptions: any;
  locationOptions: any;
  shop: string;
  stocklot: StockLot;
}

@Component({
  // tslint:disable-next-line: component-selector
  selector: 'app-dialog-content',
  imports: [
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    TablerIconsModule,
    TranslateModule // <-- Añade esto aquí
  ],
  templateUrl: 'lote-dialog-content.html',
})
// tslint:disable-next-line: component-class-suffix
export class AppEmployeeDialogContentComponent {
  action: string | any;
  // tslint:disable-next-line - Disables all
  local_data: any;
  selectedImage: any = '';
  joiningDate = new FormControl();
  /*
  entryDate = new FormControl();
  validacion = new FormControl('alm');
  */
  modoRelativo = false;
  nuevoStock = 0;
  productoSeleccionado = 'todos';
  varianteSeleccionada = 'todas';
  selectedLocation = 0;
  productoOptions: SelectItem[] = [];
  varianteOptions: SelectItem[] = [];
  locationOptions: SelectItem[] = [];
  shop: string = '';

  // Autocomplete de productos
  filteredProductos: SelectItem[] = [];
  productoLabel = '';

  @Input() compact: boolean = false;
  @Input() showOnlySearch: boolean = false;
  @Input() visibleColumns?: string[];

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AppEmployeeDialogContentComponent>,
    private loteService: LoteService,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DialogData) {

    // @Optional() is used to prevent error if no data is passed


    this.action = data.action;
    this.local_data = { ...data.stocklot };
    this.nuevoStock = this.local_data.remaining;
    this.productoOptions = data.productoOptions;
    this.varianteOptions = data.varianteOptions;
    this.locationOptions = data.locationOptions;
    this.shop = data.shop;

    // Inicializar productos filtrados (mostrar todos al inicio)
    this.filteredProductos = (this.productoOptions || [])
      .filter(o => String(o.value).toLowerCase() !== 'todos');

    const raw = this.local_data.expiration_date;
    let parsedDate: Date;

    if (raw) {
      if (raw.includes('/')) {
        // "DD/MM/YYYY" -> "YYYY-MM-DD"
        const [d, m, y] = raw.split('/');
        parsedDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
      } else {
        // debería ser ya "YYYY-MM-DD" o similar
        parsedDate = new Date(raw);
      }
      // Si sigue siendo inválido, usar hoy como fallback
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
      }
    } else {
      parsedDate = new Date();
    }

    // Asignamos el Date al FormControl (no una cadena)
    this.joiningDate.setValue(parsedDate);

    // Set default image path if not already set
    if (!this.local_data.product_image) {
      this.local_data.product_image = '';
    }
  }

  get stockResultante(): number {
    return this.modoRelativo
      ? this.local_data.remaining + (this.nuevoStock || 0)
      : this.nuevoStock;
  }

  /** Cuando cambias de modo, reinicia nuevoStock al valor adecuado */
  onModoChange(isRelativo: boolean) {
    this.modoRelativo = isRelativo;
    this.nuevoStock = isRelativo
      ? 0
      : this.local_data.remaining;
  }

  async doAction(): Promise<void> {

    const fecha: Date = this.joiningDate.value!;
    const fechaCad = fecha?.toISOString().split('T')[0];
    if (this.action === 'Add') {

      const faltan = [];

      const productoObj: any = this.productoOptions.find(p => p.value === this.productoSeleccionado);
      const varianteObj: any = this.varianteOptions.find(v => v.value === this.varianteSeleccionada);

      if (this.productoSeleccionado === 'todos') faltan.push('Producto');
      if (this.varianteOptions.length > 1 && this.varianteSeleccionada === 'todas') faltan.push('Variante');
      if (!this.local_data.lote_number?.trim()) faltan.push('Lote');
      if (!this.joiningDate.value) faltan.push('Caducidad');
      if (!this.local_data.remaining?.toString().trim()) faltan.push('Stock');
      if (!this.selectedLocation) faltan.push('Almacén');

      if (faltan.length) {
        this.openSnackBar(`Falta completar: ${faltan.join(', ')}`, 'Cerrar');
        return;
      }


      const payload: CreateLotePayload = {
        shop: this.shop,
        product_sku: productoObj?.value,
        variant_sku: this.varianteSeleccionada,
        lote_number: this.local_data.lote_number,
        expiration_date: fechaCad,
        remaining: this.local_data.remaining,
        warehouse_id: this.selectedLocation,
        observations: this.local_data.observations
      };

      try {
        await this.loteService.addLote(payload);
        this.openSnackBar('Lote creado correctamente', 'Cerrar');
        this.dialogRef.close({ event: 'Refresh' });
      } catch (err: any) {
        console.error('Error al guardar lote:', err);
        this.openSnackBar(`Error al crear lote: ${err?.message || 'Error desconocido'}`, 'Cerrar');
      }
    } else if (this.action === 'Update') {

      const finalStock = this.modoRelativo
        ? this.local_data.remaining + Number(this.nuevoStock)
        : Number(this.nuevoStock);
      const payload: UpdateLotePayload = {
        id: this.local_data.id,
        shop: this.shop,
        warehouse_id: this.local_data.warehouse_id,
        lote_number: this.local_data.lote_number,
        expiration_date: fechaCad,
        observations: this.local_data.observations,
        remaining: finalStock,
        initial_stock: this.local_data.remaining
      };

      try {
        await this.loteService.updateLote(payload).pipe(take(1)).subscribe((responseData: any) => {

          this.openSnackBar('Lote actualizado', 'Cerrar');
          this.dialogRef.close({ event: 'Update' });
        });
      } catch (err) {
        console.error('Error al actualizar lote', err);
        this.openSnackBar('No se pudo actualizar lote', 'Cerrar');
      }
    } else if (this.action === 'Delete') {
      try {
        this.loteService.deleteLote(this.local_data.id).subscribe((responseData: any) => {
        });
        this.dialogRef.close({ event: 'Delete' });
        this.openSnackBar('Lote eliminado', 'Cerrar');
      } catch (err) {
        console.error('Error al eliminar lote', err);
        this.openSnackBar('No se pudo eliminar lote', 'Cerrar');
      }
    }
  }

  formatFecha(date: any): string {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  }

  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }

  closeDialog(): void {
    this.dialogRef.close({ event: 'Cancel' });
  }

  selectFile(event: any): void {
    if (!event.target.files[0] || event.target.files[0].length === 0) {
      return; // No file selected
    }

    const mimeType = event.target.files[0].type;
    if (mimeType.match(/image\/*/) == null) {
      return; // Not an image file
    }

    const reader = new FileReader();
    reader.readAsDataURL(event.target.files[0]);

    reader.onload = (_event) => {
      if (typeof reader.result === 'string') {
        this.local_data.imagePath = reader.result; // Set selected image path
      }
    };
  }

  async onProductoChange() {
    this.varianteOptions = [];
    this.varianteSeleccionada = 'todas';

    if (this.productoSeleccionado !== 'todos') {

      this.loteService
        .getVariants(this.productoSeleccionado)
        .subscribe(vars => {
          this.varianteOptions = [
            { label: 'Todas las variantes', value: 'todas' },
            ...vars.map(v => ({ label: v.name, value: v.id })),
          ];
        });

    }
  }

  // Autocomplete de productos
  filterProductos(value: string) {
    const q = String(value || '').toLowerCase().trim();
    this.filteredProductos = (this.productoOptions || [])
      .filter(o => String(o.value).toLowerCase() !== 'todos')
      .filter(o => !q || (o.label || '').toLowerCase().includes(q));
  }

  onProductoSelected(prod: SelectItem) {
    this.productoSeleccionado = prod.value;
    this.productoLabel = String(prod.label || '');
    this.onProductoChange();
  }

}
