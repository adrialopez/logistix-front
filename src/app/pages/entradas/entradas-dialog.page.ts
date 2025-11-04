import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, Optional, Inject, TemplateRef } from "@angular/core";
import { FormsModule, ReactiveFormsModule, FormControl } from "@angular/forms";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TablerIconsModule } from "angular-tabler-icons";
import { MaterialModule } from "src/app/material.module";
import { EntradaService } from "src/app/shared/services/entrada.service";
import { MAT_DATE_FORMATS, MatDateFormats } from '@angular/material/core';
import { LoteService } from "src/app/shared/services/lote.service"; // 👈

export interface ReturnLine {
  id: number;
  product_sku: number | string;
  variant_sku?: number | string | null;
  product_label?: string;
  image?: string | null;
  variant_name: string;
  product_name: string;
  lote_number?: string | null;
  qtyOrdered: number;
  qtyReturn: number;
  devolver: boolean;
  [key: string]: any;
}

export const MY_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: 'DD/MM/YY' },
  display: {
    dateInput: 'DD/MM/YY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD/MM/YY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

interface DialogData {
  action: 'Add' | 'Update' | 'Delete' | 'View' | 'Validar';
  productoOptions: Array<{ label: string; value: string | number; image?: string }>;
  varianteOptions: any[];
  locationOptions: any[];
  shop: string;
  entrada: any;
}

type VarianteOpt = {
  label: string;
  value: string | number;
  product_id: string | number;
  sku?: string;
  weight?: number;
  price?: number;
  [k: string]: any;
};

type LoteOption = {
  id: number;
  lote_number: string;
  product_sku: string | number | null;
  variant_sku: string | number | null;
  remaining?: number | null;
  expiration_date?: string | Date | null;
};

@Component({
  selector: 'app-entradas-dialog-content',
  templateUrl: 'entradas-dialog-content.html',
  standalone: true,
  imports: [MaterialModule, FormsModule, ReactiveFormsModule, CommonModule, TablerIconsModule],
  providers: [{ provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }]
})
export class AppEmployeeDialogContentComponent {
  action: DialogData['action'];
  local_data: any;
  joiningDate = new FormControl<Date | null>(null);

  lotesMap: { [rowIndex: number]: LoteOption[] } = {};
  filteredLotes: Array<LoteOption[]> = [];

  // UI
  modoRelativo = false;
  nuevoStock = 0;
  private _selectedLocation = 0;
  soloLectura = false;
  validateStock = false;

  // Opciones
  productoOptions: Array<{ label: string; value: string | number; image?: string }> = [];
  varianteOptions: VarianteOpt[] = [];
  locationOptions: any[] = [];
  shop = '';

  // Estado por fila
  variantesMap: { [rowIndex: number]: VarianteOpt[] } = {};
  filteredProductos: Array<Array<{ label: string; value: any; image?: string }>> = [];
  filteredVariantes: Array<VarianteOpt[]> = [];

  // Devoluciones
  quitarTodo = false;
  returnLines: ReturnLine[] = [];

  // almacén
  get selectedLocation(): number { return this._selectedLocation; }
  set selectedLocation(val: number) {
    const v = Number(val) || 0;
    this._selectedLocation = v;
    if (!this.local_data) this.local_data = {};
    this.local_data.warehouse_id = v || null;
  }

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AppEmployeeDialogContentComponent>,
    private entradaService: EntradaService,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private loteService: LoteService,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    this.action = data.action;
    this.shop = data.shop;

    // Productos
    this.productoOptions = (data.productoOptions ?? [])
      .filter(p => String(p.value).toLowerCase() !== 'todos')
      .map(p => ({ ...p }));

    // Variantes normalizadas
    this.varianteOptions = this.normalizeVarianteOptions(data.varianteOptions ?? []);
    this.locationOptions = (data.locationOptions ?? []).map(o => ({ ...o }));

    // Datos locales
    this.local_data = { ...(data.entrada ?? {}) };

    // 🔹 Flag "validar en almacén": default false para no romper comportamiento
    if (this.local_data.require_warehouse_validation == null) {
      this.local_data.require_warehouse_validation = true;
    }

    if (!Array.isArray(this.local_data.lineas)) this.local_data.lineas = [];

    // readonly si View o ya validada
    this.validateStock = this.toBool(this.local_data?.stock_validated);
    this.soloLectura = (this.action === 'View') || this.validateStock;

    // proveedor por defecto
    if (this.local_data.client_order_number == null) this.local_data.client_order_number = '';

    // almacén por defecto
    if (this.local_data?.warehouse_id) {
      this.selectedLocation = Number(this.local_data.warehouse_id) || 0;
    } else {
      const realWarehouses = this.realLocationOptions;
      if (this.action === 'Add' && realWarehouses.length === 1) {
        const soleId = Number(realWarehouses[0].value ?? realWarehouses[0].id ?? 0);
        if (soleId) {
          this.selectedLocation = soleId;
          this.local_data.warehouse_id = soleId;
        }
      }
    }

    this.nuevoStock = Number(this.local_data?.remaining ?? 0);

    // fecha llegada
    const llegadaParsed = this.parseToDate(this.local_data?.shipping_date);
    if (llegadaParsed) this.joiningDate.setValue(llegadaParsed);

    // normaliza líneas + inicializa labels para autocomplete
    this.local_data.lineas = this.local_data.lineas.map((linea: any) => {
      const expirationParsed = this.parseToDate(linea?.expiration_date);

      const productId = linea?.product_sku ?? linea?.product_id ?? null;
      const variantId = linea?.variant_sku ?? linea?.variant_id ?? null;

      const prod = this.productoOptions.find(p => this.eq(p.value, productId));
      const varOpt = this.varianteOptions.find(v => this.eq(v.value, variantId));

      return {
        ...linea,
        product_sku: this.asMaybeNumber(productId),
        product_label: prod?.label || (linea?.product_name ?? ''),
        variant_sku: (variantId === '' ? null : this.asMaybeNumber(variantId)),
        variant_label: varOpt?.label || (linea?.variant_name ?? ''),
        expiration_date: expirationParsed ?? linea?.expiration_date ?? null
      };
    });

    // si es Add y sin líneas, crea 1
    if (this.action === 'Add' && this.local_data.lineas.length === 0) {
      this.addItem();
    }

    // preparar filtros por fila
    this.preparePerRowFilters();

    // plan B: variantes si faltan
    if (this.varianteOptions.length === 0 || this.needsVariantRefill()) {
      this.fetchAllVariantsAndRebuild();
    }

    // caso Validar
    if (this.action === 'Validar') {
      this.entradaService.getEntradaById(this.local_data.id).subscribe(fullEntrada => {
        const rawLines = fullEntrada.lineas || [];
        this.returnLines = rawLines.map((ln: any) => {
          const prod = this.productoOptions.find(p => this.eq(p.value, ln.product_sku));
          return {
            id: ln.id,
            product_sku: ln.product_sku,
            product_name: ln.product_name,
            variant_name: ln.variant_name,
            image: prod?.image || ln.image || null,
            product_label: prod?.label || ln.product_name || `${ln.product_sku || ''}`,
            lote_number: ln.lote_number || null,
            qtyOrdered: Number(ln.remaining ?? ln.qty ?? 0),
            qtyReturn: Number(ln.remaining ?? ln.qty ?? 0),
            devolver: true,
          };
        });
      });
    }
  }

  // ---------- Normalización variantes ----------
  private normalizeVarianteOptions(raw: any[]): VarianteOpt[] {
    return (raw || [])
      .map((v: any) => {
        const value =
          v.value ?? v.id ?? v.variant_id ?? v.sku ?? v.code ?? v.variantSku;

        const product_id =
          v.product_id ?? v.id_producto ?? v.productId ?? v.product ?? v.parent_id ?? v.product_sku ?? v.productSku;

        const label = v.label ?? v.name ?? v.title ?? String(value);
        return { ...v, value, product_id, label } as VarianteOpt;
      })
      .filter(v => v.value != null && v.product_id != null);
  }

  private needsVariantRefill(): boolean {
    return (this.local_data?.lineas || []).some((item: any) => {
      const pid = item?.product_sku;
      if (pid == null) return false;
      const subset = (this.varianteOptions || []).filter(v => this.eq(v.product_id, pid));
      return subset.length === 0;
    });
  }

  private preparePerRowFilters() {
    (this.local_data.lineas || []).forEach((item: any, idx: number) => {
      this.filteredProductos[idx] = [...this.productoOptions];

      if (item.product_sku != null) {
        this.onProductoChange(item.product_sku, idx);
        if (item.variant_sku != null) this.loadLotesForRow(idx);
        else this.filteredLotes[idx] = [];
      } else {
        this.filteredVariantes[idx] = [];
        this.filteredLotes[idx] = [];
      }

      const prod = this.productoOptions.find(p => this.eq(p.value, item.product_sku));
      if (prod) item.product_image = prod.image;
    });
  }

  private fetchAllVariantsAndRebuild() {
    this.loteService.getAllVariants().subscribe({
      next: (vs: any[]) => {
        this.varianteOptions = this.normalizeVarianteOptions(vs || []);
        this.variantesMap = {};
        this.filteredVariantes = [];
        this.preparePerRowFilters();
      },
      error: (e) => {
        console.error('getAllVariants error:', e);
      }
    });
  }

  // ---------- Devoluciones ----------
  getProductLabel(sku: string | number): string {
    const prod = this.productoOptions.find(p => this.eq(p.value, sku));
    return prod ? prod.label : String(sku);
  }

  toggleQuitarTodo() {
    this.returnLines.forEach(ln => {
      ln.devolver = this.quitarTodo;
      ln.qtyReturn = this.quitarTodo ? ln.qtyOrdered : 0;
    });
  }

  onQtyChange(ln: ReturnLine) {
    if (ln.qtyReturn > ln.qtyOrdered) ln.qtyReturn = ln.qtyOrdered;
    if (!ln.devolver) ln.qtyReturn = 0;
  }

  totalADevolver(): number {
    return this.returnLines.reduce((acc, ln) => acc + (ln.devolver ? (ln.qtyReturn || 0) : 0), 0);
  }

  openReturnDialog(templateRef: TemplateRef<any>) {
    this.returnLines = (this.local_data.lineas || []).map((ln: any) => ({
      ...ln,
      product_label: ln.product_name || `${ln.product_sku || ''}`,
      product_image: ln.product_image || null,
      qtyOrdered: Number(ln.remaining ?? 0),
      qtyReturn: Number(ln.remaining ?? 0),
      devolver: true,
    }));
    this.dialog.open(templateRef, { width: '900px', maxWidth: '95vw' });
  }

  confirmarDevolucion(dialogRef: any) {
    const payload = this.returnLines.map(ln => ({
      line_id: ln.id,
      qty_return: ln.qtyReturn ?? 0
    }));

    this.entradaService.marcarComoDevuelto(this.local_data.id, payload).subscribe({
      next: () => {
        this.openSnackBar('Stock modificado correctamente', 'Cerrar');
        this.entradaService.getEntradaById(this.local_data.id).subscribe((detalle: any) => {
          this.local_data = detalle;
          dialogRef.close({ event: 'Validado', data: detalle });
        });
      },
      error: (err) => {
        console.error('Error al modificar stock', err);
        this.openSnackBar('Error al modificar stock', 'Cerrar');
      }
    });
  }

  // ---------- Helpers ----------
  get realLocationOptions() {
    return (this.locationOptions ?? []).filter(
      (o: any) => o && o.value !== '' && o.value !== null && o.value !== undefined
    );
  }
  get disableWarehouseSelect(): boolean {
    return this.realLocationOptions.length === 1;
  }
  trackByValue(index: number, item: any) { return item?.value ?? index; }

  private toBool(v: any): boolean { return v === true || v === 1 || v === '1'; }

  private parseToDate(raw: any): Date | null {
    if (!raw) return null;
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
    if (typeof raw === 'string') {
      if (raw.includes('/')) {
        const [d, m, y] = raw.split('/').map(s => s.trim());
        const dt = new Date(Number(y), Number(m) - 1, Number(d));
        return isNaN(dt.getTime()) ? null : dt;
      }
      const dt = new Date(raw);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }
  private toYMD(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  private asMaybeNumber(v: any) {
    if (v === null || v === undefined) return v;
    const n = Number(v);
    return isNaN(n) ? v : n;
  }
  private eq(a: any, b: any): boolean { return String(a) === String(b); }

  get stockResultante(): number {
    return this.modoRelativo
      ? Number(this.local_data.remaining || 0) + Number(this.nuevoStock || 0)
      : Number(this.nuevoStock || 0);
  }
  onModoChange(isRelativo: boolean) {
    this.modoRelativo = isRelativo;
    this.nuevoStock = isRelativo ? 0 : Number(this.local_data.remaining || 0);
  }
  createRange(n: number): number[] {
    return Array.from({ length: n + 1 }, (_, i) => i);
  }

  // ---------- Payload ----------
  private mapLineaForApi(linea: any) {
    const expiration =
      (linea?.expiration_date instanceof Date && !isNaN(linea.expiration_date.getTime()))
        ? this.toYMD(linea.expiration_date)
        : (typeof linea?.expiration_date === 'string' ? linea.expiration_date : null);

    return {
      id: linea.id ?? undefined,
      lote_id: linea.lote_id ?? null,
      qty: Number(linea.remaining) || 0,
      estado: linea.estado ?? 'pendiente',
      lote_number: (linea.lote_number ?? '').toString().trim(),
      product_sku: this.asMaybeNumber(linea.product_sku),
      variant_sku: linea.variant_sku === '' ? null : this.asMaybeNumber(linea.variant_sku),
      expiration_date: expiration,
      warehouse_id: Number(this.selectedLocation) || null,
      observations: (linea.observations ?? '').toString().trim(),
    };
  }

  buildEntradaPayloadForApi() {
    const llegada: any = this.joiningDate.value;
    let shipping_date: string | null = null;

    if (llegada && typeof llegada.toDate === 'function') {
      const asDate: Date = llegada.toDate();
      if (!isNaN(asDate.getTime())) shipping_date = this.toYMD(asDate);
    } else if (llegada instanceof Date && !isNaN(llegada.getTime())) {
      shipping_date = this.toYMD(llegada);
    } else if (typeof this.local_data.shipping_date === 'string') {
      const parsed = this.parseToDate(this.local_data.shipping_date);
      if (parsed) shipping_date = this.toYMD(parsed);
    }

    const lineas = Array.isArray(this.local_data.lineas)
      ? this.local_data.lineas.map((l: any) => this.mapLineaForApi(l))
      : [];

    return {
      reference: (this.local_data.reference ?? '').toString().trim(),
      client_order_number: (this.local_data.client_order_number ?? '').toString().trim(),
      status: this.local_data.status ?? this.local_data.require_warehouse_validation ? 'pendiente' : 'aceptada',
      shop: this.shop,
      shipping_date,
      warehouse_id: Number(this.selectedLocation || this.local_data.warehouse_id) || null,
      observations: (this.local_data.observations ?? '').toString().trim(),
      stock_validated: !!this.validateStock,

      // 🔹 NUEVO: flag para el backend (no requiere cambios de BD)
      require_warehouse_validation: !!this.local_data.require_warehouse_validation,

      lineas,
    };
  }

  // ---------- Acciones ----------
  doAction(): void {
    const llegada = this.joiningDate.value;
    if (llegada instanceof Date && !isNaN(llegada.getTime())) {
      this.local_data.shipping_date = this.toYMD(llegada);
    }

    if ((this.action === 'Add' || this.action === 'Update') &&
      (!this.selectedLocation || this.selectedLocation === 0)) {
      this.openSnackBar('Debes seleccionar un almacén', 'Cerrar');
      return;
    }

    const payload = this.buildEntradaPayloadForApi();
    payload.warehouse_id = this.selectedLocation || null;

    if (this.action === 'Add') {
      this.entradaService.addEntrada(payload).subscribe({
        next: () => {
          this.openSnackBar('Entrada creada correctamente', 'Cerrar');
          this.dialogRef.close({ event: 'Refresh' });
        },
        error: (err: unknown) => {
          console.error('Error al crear entrada', err);
          this.openSnackBar('Error al crear entrada', 'Cerrar');
        }
      });
      return;
    }

    if (this.action === 'Update') {
      if (!this.local_data?.id) {
        this.openSnackBar('No se puede actualizar: falta ID', 'Cerrar');
        return;
      }
      this.entradaService.updateEntrada(this.local_data.id, payload).subscribe({
        next: () => {
          this.openSnackBar('Entrada actualizada', 'Cerrar');
          this.dialogRef.close({ event: 'Refresh' });
        },
        error: (err: unknown) => {
          console.error('Error al actualizar entrada', err);
          this.openSnackBar('No se pudo actualizar entrada', 'Cerrar');
        }
      });
      return;
    }

    if (this.action === 'Delete') {
      if (!this.local_data?.id) {
        this.openSnackBar('No se puede eliminar: falta ID', 'Cerrar');
        return;
      }
      this.entradaService.deleteEntrada(this.local_data.id).subscribe({
        next: () => {
          this.openSnackBar('Entrada eliminada', 'Cerrar');
          this.dialogRef.close({ event: 'Refresh' });
        },
        error: (err: unknown) => {
          console.error('Error al eliminar entrada', err);
          this.openSnackBar('No se pudo eliminar entrada', 'Cerrar');
        }
      });
      return;
    }
  }

  // ---------- UI utils ----------
  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
  closeDialog(): void { this.dialogRef.close({ event: 'Cancel' }); }

  selectFile(event: any): void {
    const file = event?.target?.files?.[0];
    if (!file || !/image\/*/.test(file.type)) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => { if (typeof reader.result === 'string') this.local_data.imagePath = reader.result; };
  }

  addItem() {
    const idx = (this.local_data.lineas ?? []).length;
    if (!Array.isArray(this.local_data.lineas)) this.local_data.lineas = [];
    this.local_data.lineas.push({
      id: 0,
      lote_id: null,
      lote_number: '',
      product_sku: null,
      product_label: '',
      product_name: '',
      product_image: '',
      variant_sku: null,
      variant_label: '',
      variant_name: '',
      warehouse_id: this.local_data.warehouse_id ?? this.selectedLocation ?? null,
      warehouse_name: this.local_data.warehouse_name ?? '',
      remaining: 1,
      expiration_date: null as Date | null,
      arrival_date: '',
      observations: '',
      estado: 'pendiente',
      is_deleted: false
    });

    this.filteredProductos[idx] = [...this.productoOptions];
    this.filteredVariantes[idx] = [];
    this.filteredLotes[idx] = [];
  }

  removeItem(index: number) {
    if (!Array.isArray(this.local_data.lineas)) return;
    this.local_data.lineas.splice(index, 1);
    delete this.variantesMap[index];
    delete this.filteredProductos[index];
    delete this.filteredVariantes[index];
  }

  // -------- Autocomplete: PRODUCTO --------
  filterProductos(value: string, index: number) {
    const q = String(value || '').toLowerCase().trim();
    this.filteredProductos[index] = (this.productoOptions || []).filter(o =>
      !q || (o.label).toLowerCase().includes(q)
    );
  }

  // -------- Autocomplete: VARIANTE --------
  filterVariantes(value: string, index: number) {
    const q = String(value || '').toLowerCase().trim();
    this.filteredVariantes[index] = (this.variantesMap[index] || []).filter(opt =>
      !q || (opt.label).toLowerCase().includes(q)
    );
  }

  onProductoSelected(prod: { label: string; value: any; image?: string }, index: number) {
    const item = this.local_data.lineas[index];
    item.product_sku = prod.value;
    item.product_label = prod.label;
    item.product_image = prod.image || '';

    this.onProductoChange(prod.value, index);

    // limpiar variante y lote
    item.variant_sku = null;
    item.variant_label = '';
    this.resetLoteSelection(index);
  }

  onVarianteSelected(variantOpt: VarianteOpt, index: number) {
    const item = this.local_data.lineas[index];
    item.variant_sku = variantOpt.value;
    item.variant_label = variantOpt.label;

    this.resetLoteSelection(index);
    this.loadLotesForRow(index);
  }

  // Input del usuario en el campo lote_number
  onLoteInput(value: string, index: number) {
    const q = String(value ?? '').toLowerCase().trim();
    const base = this.lotesMap[index] || [];
    this.filteredLotes[index] = !q ? [...base] : base.filter(l =>
      String(l?.lote_number ?? '').toLowerCase().includes(q)
    );

    const item = this.local_data.lineas[index];
    item.lote_number = String(value || '').trim();
    item.lote_id = null;
  }

  // Cuando eligen una opción de la lista
  onLoteSelected(opt: LoteOption, index: number) {
    const item = this.local_data.lineas[index];
    item.lote_id = opt?.id ?? null;
    item.lote_number = opt?.lote_number ?? '';

    // Hidratar caducidad desde el lote elegido
    if (opt?.expiration_date !== undefined) {
      const parsed = this.parseToDate(opt.expiration_date);
      item.expiration_date = parsed ?? null;
    }

    if (!item.product_sku && opt?.product_sku) item.product_sku = opt.product_sku;
    if (!item.variant_sku && opt?.variant_sku) item.variant_sku = opt.variant_sku;
  }

  private resetLoteSelection(index: number) {
    const item = this.local_data.lineas[index];
    item.lote_id = null;
  }

  private loadLotesForRow(index: number) {
    const item = this.local_data.lineas[index];
    const product = item?.product_sku ?? null;
    const variant = item?.variant_sku ?? null;

    if (!product || variant == null || variant === '') {
      this.lotesMap[index] = [];
      this.filteredLotes[index] = [];
      return;
    }

    this.loteService.searchLots({ product_sku: product, variant_sku: variant, q: '' })
      .subscribe({
        next: (rows: LoteOption[]) => {
          this.lotesMap[index] = rows || [];
          this.filteredLotes[index] = [...(rows || [])];
        },
        error: () => {
          this.lotesMap[index] = [];
          this.filteredLotes[index] = [];
        }
      });
  }

  onProductoChange(productId: number, index: number) {
  const item = this.local_data.lineas[index];

  // lista de variantes para el producto
  const list = (this.varianteOptions ?? []).filter(v => this.eq(v.product_id, productId));
  this.variantesMap[index] = list;
  this.filteredVariantes[index] = [...list];

  // imagen/label de producto
  const prod = (this.productoOptions ?? []).find(p => this.eq(p.value, productId));
  if (prod) {
    item.product_image = prod.image;
    item.product_label = prod.label;
  }

  // siempre resetea selección de lote visible
  this.resetLoteSelection(index);
  this.filteredLotes[index] = [];

  // ⚠️ Si aún no tenemos variantes cargadas para este producto, NO tocar la variante existente.
  if (!list || list.length === 0) {
    return;
  }

  const reales = list.filter(v => v.value !== '' && v.value != null);

  // Si ya venía con variant_sku, intenta hidratar el label
  const vs = item.variant_sku;
  if (vs != null) {
    const found = reales.find(v => this.eq(v.value, vs));
    if (found) {
      item.variant_label = found.label;   // hidrata el label
      this.loadLotesForRow(index);        // ya podemos cargar lotes
      return;
    }
    // Solo limpiar si sabemos con certeza que la variante no existe en la lista real
    item.variant_sku = null;
    item.variant_label = '';
    return;
  }

  // Autoselección si hay una sola variante real y no venía ninguna
  if (reales.length === 1) {
    this.onVarianteSelected(reales[0], index);
  }
}

}
