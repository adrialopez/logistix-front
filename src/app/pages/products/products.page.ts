import { AfterViewInit, Component, Inject, OnInit, Optional, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { Producto } from 'src/app/model/entity/producto';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ProductosService } from 'src/app/shared/services/productos.service';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
import { SelectItem } from 'primeng/api';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { Variante } from 'src/app/model/entity/variante';
import { VariantesService } from 'src/app/shared/services/variantes.service';
import { CreateVariantePayload } from 'src/app/model/dto/create-variante-payload';
import { UpdateVariantePayload } from 'src/app/model/dto/update-variante-payload';
import { CreateProductoPayload } from 'src/app/model/dto/create-producto-payload';
import { UpdateProductoPayload } from 'src/app/model/dto/update-producto-payload';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule]
})
export class ProductsPage implements OnInit {

  shop = 'lotes-test.myshopify.com';
  productos: Producto[] = [];

  mostrarModalEdicion: boolean = false;
  modoRelativo: boolean = false;
  observaciones: string = '';
  paginaActual = 0;
  productosPorPagina = 20;

  searchTerm = '';
  showDeleted = false;

  errorMessage: string = '';
  toastActive: boolean = false;
  sortMode: any;

  totalRegistros = 0;             // ← total devuelto por backend
  sortBy = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  selection: SelectionModel<Producto> = new SelectionModel<Producto>(true, []);
  locationOptions: SelectItem[] = [];

  @ViewChild(MatTable, { static: true }) table: MatTable<any> =
    Object.create(null);

  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;

  displayedColumns = [
    'select',
    'name',
    'numero_lotes',
    'stock_total',
    'action'
  ]

  dataSource = new MatTableDataSource<Producto>([]);

  constructor(
    public dialog: MatDialog,
    public productoService: ProductosService,
    private translateService: TranslateService
  ) { }


  ngOnInit() {
    this.cargarProductos();
  }

  ionViewWillEnter(): void {
    this.cargarProductos();
  }

  ngAfterViewInit(): void {
    this.paginator.pageSize = this.productosPorPagina;

    // Re-cargar cada vez que el usuario cambie de página/tamaño
    this.paginator.page.subscribe(() => {
      this.cargarProductos();
    });
  }

  async cargarProductos() {
    const pageIndex = this.paginator ? this.paginator.pageIndex : 0;
    const pageSize = this.paginator ? this.paginator.pageSize : this.productosPorPagina;

    this.productoService.getProductsPaged({
      page: pageIndex + 1,           // backend 1-based
      pageSize: pageSize,
      q: this.searchTerm?.trim() || undefined,
      include_deleted: this.showDeleted,
      sort_by: this.sortBy,
      sort_dir: this.sortDir
    })
      .subscribe(resp => {
        const { items, total } = resp;
        this.totalRegistros = total;

        // ya no filtramos en cliente
        this.productos = items.map(p => ({ ...p }));
        this.dataSource.data = this.productos;

        // importante: para que el paginador muestre el total real del servidor
        if (this.paginator) {
          this.paginator.length = total;
        }
      });
  }

  applyFilter(filterValue: string): void {
    this.searchTerm = filterValue.trim().toLowerCase();
    if (this.paginator) this.paginator.firstPage();
    this.cargarProductos();
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

  checkboxLabel(row?: Producto): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id + 1
      }`;
  }

  openDialog(action: string, producto: Producto | any, shop: string): void {
    const dialogRef = this.dialog.open(AppProductsDialogContentComponent, {
      width: '1200px',
      maxWidth: '1200px',
      data: { action, producto, shop }, autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.cargarProductos();
      if (result && result.event === 'Refresh') {
        this.cargarProductos();
      }
    });
  }

  deleteSelected(): void {
    const selectedIds = this.selection.selected.map((item) => item.id);
    if (!selectedIds.length) return;

    const ok = confirm(`¿Eliminar ${selectedIds.length} producto(s)?`);
    if (!ok) return;

    this.productoService.deleteProducts(selectedIds).subscribe({
      next: () => {
        this.selection.clear();
        this.cargarProductos();
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  onDeleteOne(id: number) {
    const ok = confirm('¿Eliminar este producto?');
    if (!ok) return;
    this.productoService.deleteProducts([id]).subscribe(() =>
      this.cargarProductos());
  }


}

interface DialogData {
  action: string;
  shop: string;
  producto: Producto;
}

type Snapshot = {
  name?: string;
  sku?: string;
  weight?: number;
  price?: number;
  ean?: string;
};

type VarianteRow = Variante & {
  __original?: Snapshot;
  __dirty?: boolean;
  __isNew?: boolean;

  __skuError?: string | null;

  __search?: string;
  __options?: VarianteRow[];
  __selectedId?: number | null;

  weight?: number;
  price?: number;
  image?: string;

  ean?: string;
  __eanError?: string | null;

  stock_total?: number;
};
@Component({
  // tslint:disable-next-line: component-selector
  selector: "app-dialog-content",
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  styleUrls: ["./products.page.scss"],
  templateUrl: "products-dialog-content.html",
})
export class AppProductsDialogContentComponent implements OnInit, AfterViewInit {
  action: string;
  local_data: any; // producto (sku, name)
  shop: string;

  // Variantes que se muestran en el diálogo
  variantes: VarianteRow[] = [];
  isView = false;

  // Catálogo para el autocomplete (las variantes del propio producto)
  varianteOptions: VarianteRow[] = [];

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AppProductsDialogContentComponent>,
    private productsService: ProductosService,
    private varianteService: VariantesService,
    private snackBar: MatSnackBar,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.action = data.action;
    this.local_data = (this.action === 'Add')
      ? { id: null, name: '', image: '' }
      : { ...data.producto };
    this.shop = data.shop;
    this.isView = this.action === 'View';
  }

  ngOnInit(): void {
    this.cargarVariantes();
  }

  ngAfterViewInit(): void { }

  closeDialog(): void {
    this.dialogRef.close({ event: "Cancel" });
  }

  // ===== Helpers =====

  private snapshot(v: VarianteRow): Snapshot {
    return {
      name: v.name,
      sku: v.sku,
      weight: Number(v.weight ?? 0),
      price: Number(v.price ?? 0),
      ean: (v.ean ?? '').trim()
    };
  }



  private excludeAlreadyUsedIds(base: VarianteRow[], self?: VarianteRow): number[] {
    // ids ya presentes en filas (excepto la propia fila "self" si se pasa)
    return base
      .filter(r => !self || r !== self)
      .map(r => r.id)
      .filter((id): id is number => !!id);
  }

  private filterRowOptions(v: VarianteRow, term: string): VarianteRow[] {
    const t = (term || "").trim().toLowerCase();
    const exclude = new Set(this.excludeAlreadyUsedIds(this.variantes, v));
    return this.varianteOptions
      .filter(opt => !exclude.has(opt.id as number))
      .filter(opt => {
        if (!t) return true;
        const hay = `${opt.name ?? ""} ${opt.sku ?? ""}`.toLowerCase();
        return hay.includes(t);
      });
  }


  cargarVariantes(): void {
    const productId = this.local_data?.id;
    if (!productId) {
      this.variantes = [];
      this.varianteOptions = [];
      return;
    }

    this.varianteService.getVariantesByProducto(productId).subscribe((data) => {
      // Variantes actuales del producto (editables)
      this.variantes = (data || []).map((v) => {
        const row: VarianteRow = {
          ...v,
          weight: (v as any).weight ?? 0,
          price: (v as any).price ?? 0,
          image: (v as any).image,
          ean: (v as any).ean ?? '',
        };
        row.__original = this.snapshot(row);
        row.__dirty = false;
        row.__isNew = false;
        return row;
      });

      // Catálogo para autocomplete = mismas variantes del producto
      this.varianteOptions = (data || []).map((v) => ({
        ...v,
        weight: (v as any).weight ?? 0,
        price: (v as any).price ?? 0,
        image: (v as any).image,
      }));
    });
  }

  // ===== Autocomplete por fila (solo para filas NUEVAS) =====

  onRowSearchChange(v: VarianteRow, ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    v.__search = value;
    v.__options = this.filterRowOptions(v, value);
  }

  onRowSelect(v: VarianteRow, opt: VarianteRow): void {
    v.__selectedId = opt.id!;
    // Rellenamos los campos con la opción elegida (como “plantilla”)
    v.name = opt.name || "";
    v.sku = opt.sku || "";
    v.weight = Number(opt.weight ?? 0);
    v.price = Number(opt.price ?? 0);
    v.image = opt.image;

    // dejamos la fila como NUEVA (se creará al Guardar)
    v.__dirty = true;
    v.__isNew = true;

    // “congelamos” el texto en el input
    v.__search = opt.name || opt.sku || "";
    // y ocultamos la opción elegida de su lista
    v.__options = this.filterRowOptions(v, v.__search || "");
  }

  // ===== Edición inline =====

  markDirty(v: VarianteRow): void {
    const o: Snapshot = v.__original || {};
    if (v.__isNew) { v.__dirty = true; return; }
    v.__dirty =
      String(v.name ?? "") !== String(o.name ?? "") ||
      String(v.sku ?? "") !== String(o.sku ?? "") ||
      Number(v.weight ?? 0) !== Number(o.weight ?? 0) ||
      Number(v.price ?? 0) !== Number(o.price ?? 0) ||
      String((v.ean ?? '').trim()) !== String((o.ean ?? '').trim());
  }

  onSkuTyping(v: VarianteRow): void {
    if (!v.__isNew) return;               // solo validar al crear
    v.__skuError = null;                  // limpia mientras escribe
  }

  hasSkuErrors(): boolean {
    return this.variantes.some(x => !!x.__skuError);
  }


  addVariante(): void {
    const row: any = {
      id: 0 as any,
      product_id: this.local_data.id,
      name: "",
      sku: "",
      weight: 0,
      price: 0,
      image: "",
      __isNew: true,
      __dirty: true,
      __original: { name: "", sku: "", weight: 0, price: 0 },
      __skuError: "SKU requerido",
      ean: "",
      __eanError: null,
    };
    this.variantes.push(row);
  }

  private buildBulkPayload(): any[] {
    return [
      {
        title: (this.local_data?.name ?? '').trim(),
        image: (this.local_data?.image ?? '').trim() || null,
        variants: (this.variantes || []).map(v => ({
          title: (v.name ?? '').trim(),           // ← nombre de la variante
          sku: (v.sku ?? '').trim(),
          quantity: Number((v as any).quantity ?? 0), // si no tienes campo en UI, quedará 0
          weight: Number(v.weight ?? 0),
          price: Number(v.price ?? 0),
          ean: ((v.ean ?? '').trim() || null)
        }))
      }
    ];
  }


  private recomputeIdDuplicates(): void {
    const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

    // Conteos
    const skuCounts = new Map<string, number>();
    const eanCounts = new Map<string, number>();

    for (const r of this.variantes) {
      const kSku = norm(r.sku);
      const kEan = norm(r.ean);
      if (kSku) skuCounts.set(kSku, (skuCounts.get(kSku) ?? 0) + 1);
      if (kEan) eanCounts.set(kEan, (eanCounts.get(kEan) ?? 0) + 1);
    }

    for (const r of this.variantes) {
      // SKU: solo mostramos error en filas nuevas (como antes)
      if (!r.__isNew) {
        r.__skuError = null;
      } else {
        const kSku = norm(r.sku);
        if (!kSku) r.__skuError = 'SKU requerido';
        else if ((skuCounts.get(kSku) ?? 0) > 1) r.__skuError = 'SKU duplicado';
        else r.__skuError = null;
      }

      // EAN: siempre editable → validamos duplicados si viene informado
      const kEan = norm(r.ean);
      if (!kEan) {
        r.__eanError = null;                   // EAN opcional; sin valor no bloquea
      } else if ((eanCounts.get(kEan) ?? 0) > 1) {
        r.__eanError = 'EAN duplicado';
      } else {
        r.__eanError = null;
      }
    }
  }
  onSkuInput(v: VarianteRow, value: string): void {
    if (!v.__isNew) return;        // solo filas nuevas editan SKU
    v.sku = value;                 // actualiza el modelo
    this.recomputeIdDuplicates(); // ✅ recalcula errores en todas las filas
    v.__dirty = true;
  }

  onEanInput(v: VarianteRow, value: string): void {   // <--- nuevo
    v.ean = value;
    this.recomputeIdDuplicates();
    v.__dirty = true;
  }

  hasIdErrors(): boolean {
    return this.variantes.some(x => !!x.__skuError || !!x.__eanError);
  }

  async rmVariante(idVariante: number): Promise<void> {
    // Si es una fila "nueva" sin persistir, quitarla sin tocar API
    const idx = this.variantes.findIndex((v) => v.id === idVariante);
    if (idx > -1 && this.variantes[idx].__isNew) {
      this.variantes.splice(idx, 1);
      return;
    }

    try {
      await (this.varianteService.deleteVariante(idVariante).toPromise?.() ??
        this.varianteService.deleteVariante(idVariante).toPromise());
      this.openSnackBar("Variante eliminada", "Cerrar");
      this.cargarVariantes();
    } catch (err) {
      console.error("Error eliminando variante", err);
      this.openSnackBar("No se pudo eliminar la variante", "Cerrar");
    }
  }

  // ===== Guardar TODO con un solo botón =====
  async doAction(): Promise<void> {
    // validaciones locales
    if (this.hasIdErrors()) {
      this.openSnackBar('Revisa los identificadores (SKU/EAN) de las variantes', 'Cerrar');
      return;
    }
    if (!this.local_data?.name?.trim()) {
      this.openSnackBar('El producto necesita nombre', 'Cerrar');
      return;
    }
    if ((this.action === 'Add') && (!this.variantes || this.variantes.length === 0)) {
      this.openSnackBar('Añade al menos una variante', 'Cerrar');
      return;
    }

    try {
      const payload = this.buildBulkPayload();

      if (this.action === 'Add') {
        // INSERT masivo (crea producto + variantes + lotes con quantity)
        await this.productsService.addProducto(payload).toPromise();
      } else if (this.action === 'Update') {
        // UPDATE masivo (casa por SKU; si no existe, el backend decide si lo ignora o crea)
        await this.productsService.updateProducto(payload).toPromise();
      } else {
        // View/Delete no pasan por aquí
        return;
      }

      this.openSnackBar('Producto y variantes guardados', 'Cerrar');
      this.dialogRef.close({ event: 'Refresh' });
    } catch (err) {
      console.error('Error guardando', err);
      this.openSnackBar('No se pudo guardar', 'Cerrar');
    }
  }

  delete() {
    const id = this.local_data.id;
    this.productsService.deleteProducts([id]).subscribe(() => {
      this.openSnackBar("Producto eliminado", "Cerrar");
      this.dialogRef.close({ event: "Refresh" });
    });
  }
  // ===== Utils =====
  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {
      duration: 3000,
      horizontalPosition: "center",
      verticalPosition: "top",
    });
  }


}