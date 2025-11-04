import { Component, Inject, OnInit, Optional, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { SelectionModel } from '@angular/cdk/collections';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SelectItem, MessageService } from 'primeng/api';
import { MaterialModule } from 'src/app/material.module';
import { CreateLotePayload } from 'src/app/model/dto/create-lote-payload';
import { UpdateLotePayload } from 'src/app/model/dto/update-lote-payload';
import { Producto } from 'src/app/model/entity/producto';
import { Variante } from 'src/app/model/entity/variante';
import { Location } from 'src/app/model/entity/location';
import { MovimientoService } from 'src/app/shared/services/movimiento.service';
import { Movimiento } from 'src/app/model/entity/movimiento';
import { TranslateModule, TranslateService, TranslateStore } from '@ngx-translate/core';
import * as XLSX from 'xlsx';
import { LoteService } from 'src/app/shared/services/lote.service';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-trazabilidad',
  templateUrl: './trazabilidad.page.html',
  styleUrls: ['./trazabilidad.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    MaterialModule,
    TablerIconsModule,
    TranslateModule,
    ReactiveFormsModule
  ],
  providers: [MessageService]
})
export class TrazabilidadPage implements OnInit {


  shop = 'movimientos-test.myshopify.com';
  productos: Producto[] = [];
  variantes: Variante[] = [];
  locations: Location[] = [];
  movimientos: any[] = [];

  loteEditando: any | null = null;
  mostrarModalEdicion = false;
  modoRelativo = false;
  nuevoStock = 0;
  observaciones = '';
  paginaActual = 0;
  movimientosPorPagina = 20;
  totalRegistros = 0;
  orderNumberCtrl = new FormControl<string>('', { nonNullable: true });
  mostrarSoloPedidos = true; // Por defecto activado


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

  selection = new SelectionModel<any>(true, []);
  productoOptions: SelectItem[] = [];
  varianteOptions: SelectItem[] = [];
  locationOptions: SelectItem[] = [];


  //TEMPLATE

  @ViewChild(MatTable, { static: true }) table: MatTable<any> =
    Object.create(null);

  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;

  searchText: any;
  lotesUnicos: Array<{ value: string; label: string }> = [];


  displayedColumns = [
    'lote_id',
    'lote_number',
    'producto',
    'cantidad',
    'motivo',
    'origen',
    'fecha'
  ];

  dataSource = new MatTableDataSource<any>([]);

  constructor(private http: HttpClient, private messageService: MessageService,
    public dialog: MatDialog,
    private movimientoservice: MovimientoService,
    private loteService: LoteService) { }

  ngOnInit() {
    this.orderNumberCtrl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.paginaActual = 0; // reset a primera página en cada filtro
        this.cargarmovimientos();
      });

    this.cargarmovimientos();
  }

  ionViewWillEnter() {

    this.cargarmovimientos();
  }
  ngAfterViewInit(): void {
    this.paginator.pageSize = this.movimientosPorPagina;

    // evento de paginator (server-side)
    this.paginator.page.subscribe(ev => {
      this.movimientosPorPagina = ev.pageSize;
      this.paginaActual = ev.pageIndex;
      this.cargarmovimientos();
    });
  }

  // Exportar a Excel el lote seleccionado (usa this.lote como filtro)
  async exportToExcel(): Promise<void> {
    try {
      console.log('test')
      // Usa los filtros activos. En tu caso el input es orderNumberCtrl
      const orderNumber = (this.orderNumberCtrl?.value || '').trim();
      if (!orderNumber) {
        this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Escribe un Nº de lote para exportar.' });
        return;
      }

      const blob = await firstValueFrom(
        this.movimientoservice.exportMovimientosExcel({
          order_number: orderNumber,
          sort: this.sortMode || 'desc',
          shop: this.shop // para los hipervínculos
        })
      );

      const fechaISO = new Date().toISOString().slice(0, 10);
      const filename = `movimientos_${orderNumber}_${fechaISO}.xlsx`;

      // Descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      window.URL.revokeObjectURL(url);

      this.messageService.add({ severity: 'success', summary: 'OK', detail: 'Exportación generada.' });
    } catch (err) {
      console.error('Error exportando Excel', err);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo exportar el Excel.' });
    }
  }




  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  openDialog(action: string, Movimiento: any | any, productoOptions: any, varianteOptions: any, locationOptions: any, shop: string): void {
    const dialogRef = this.dialog.open(AppEmployeeDialogContentComponent, {
      data: { action, Movimiento, productoOptions, varianteOptions, locationOptions, shop }, autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.cargarmovimientos();
      if (result && result.event === 'Refresh') {
        this.cargarmovimientos();
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

  checkboxLabel(row?: any): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id + 1
      }`;
  }

  get filteredmovimientos() {
    return this.movimientos.filter(l => {
      const matchesSearch = l.lote_id.includes(this.searchTerm);
      return matchesSearch;
    });
  }

  get movimientosAMostrar() {
    return this.filteredmovimientos.slice(this.paginaActual * this.movimientosPorPagina, (this.paginaActual + 1) * this.movimientosPorPagina);
  }

  onPage(event: any) {
    this.paginaActual = event.page;
    this.movimientosPorPagina = event.rows;
  }


  async cargarmovimientos() {
    const opts = {
      page: this.paginaActual,
      pageSize: this.movimientosPorPagina,
      order_number: (this.orderNumberCtrl?.value || '').trim(),
      sort: this.sortMode || 'desc',
      es_pedido: this.mostrarSoloPedidos ? true : undefined  // Filtrar solo pedidos si está activado
    };

    this.movimientoservice.getMovimientos(opts).subscribe({
      next: (resp) => {
        if (!resp) return;

        this.movimientos = resp.datos || [];
        this.dataSource.data = this.movimientos;

        // total para el paginator (server-side)
        this.totalRegistros = Number(resp.total ?? this.movimientos.length);

        // sincroniza paginator con el estado actual
        if (this.paginator) {
          this.paginator.length = this.totalRegistros;
          this.paginator.pageIndex = this.paginaActual;
          this.paginator.pageSize = this.movimientosPorPagina;
        }

        // limpia selección de filas al recargar
        this.selection.clear();

        // aviso de plan (si aplica)
        if (resp.warning) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Aviso',
            detail: resp.warning
          });
        }
      },
      error: (err) => {
        console.error('Error cargando movimientos', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los movimientos.'
        });
      }
    });
  }

  onMostrarPedidosChange() {
    this.paginaActual = 0; // Resetear a la primera página
    this.cargarmovimientos();
  }


  applyLoteFilter(loteValue: string) {
    this.lote = loteValue;

    // Filtro de MatTable por lote_id (o lote_id si prefieres)
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const value = (data as any).lote_id ?? (data as any).lote_id;
      return (value ?? '').toString().toLowerCase() === filter.toLowerCase();
    };
    this.dataSource.filter = (loteValue || '').trim().toLowerCase();
  }


}

interface DialogData {
  action: string;
  productoOptions: any;
  varianteOptions: any;
  locationOptions: any;
  shop: string;
  Movimiento: any;
}

@Component({
  // tslint:disable-next-line: component-selector
  selector: 'app-dialog-content',
  imports: [
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    TablerIconsModule
  ],
  templateUrl: 'trazabilidad-dialog-content.html',
})
// tslint:disable-next-line: component-class-suffix
export class AppEmployeeDialogContentComponent {
  action: string | any;
  // tslint:disable-next-line - Disables all
  local_data: any;
  selectedImage: any = '';
  joiningDate = new FormControl();
  modoRelativo = false;
  nuevoStock = 0;
  productoSeleccionado = 'todos';
  varianteSeleccionada = 'todas';
  selectedLocation = 0;
  productoOptions: SelectItem[] = [];
  varianteOptions: SelectItem[] = [];
  locationOptions: SelectItem[] = [];
  shop: string = '';


  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AppEmployeeDialogContentComponent>,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DialogData) {

    // @Optional() is used to prevent error if no data is passed


    this.action = data.action;
    this.local_data = { ...data.Movimiento };
    this.nuevoStock = this.local_data.remaining;
    this.productoOptions = data.productoOptions;
    this.varianteOptions = data.varianteOptions;
    this.locationOptions = data.locationOptions;
    this.shop = data.shop;

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
      this.local_data.product_image = 'assets/images/profile/user-1.jpg';
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


}
