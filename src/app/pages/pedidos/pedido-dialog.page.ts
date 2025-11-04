import { CommonModule } from "@angular/common";
import { Component, Optional, Inject, OnInit } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TablerIconsModule } from "angular-tabler-icons";
import { MaterialModule } from "src/app/material.module";
import { OrdersService } from "src/app/shared/services/orders.service";
import { EntradaService } from 'src/app/shared/services/entrada.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from "src/app/shared/services/auth.service";
import { LoteService } from "src/app/shared/services/lote.service";
import { Country, CountryService } from "src/app/shared/services/country.service";
import { MatOptionSelectionChange } from "@angular/material/core";
import { ToastrService } from 'ngx-toastr';


interface DialogData {
  action: string;
  productoOptions: any[];
  varianteOptions: any[];
  smethodsOptions: any[];
  carriersOptions: any[];
  pedido?: any;
  shop: string;
}

@Component({
  selector: 'app-dialog-pedidos-content',
  standalone: true,
  templateUrl: 'pedido-dialog.html',
  imports: [MaterialModule, FormsModule, ReactiveFormsModule, CommonModule, TablerIconsModule, TranslateModule]
})
export class PedidoDialogComponentContent implements OnInit {
  action: string;
  local_data: any;
  isView: boolean = false;
  productoOptions: any[] = [];
  varianteOptions: any[] = [];
  smethodsOptions: any[] = [];
  carriersOptions: any[] = [];
  shop: string = '';
  variantesMap: { [key: number]: any[] } = {};
  varianteSeleccionada: { [key: number]: any } = {};
  role: string | null = 'client';
  filteredProductos: any[][] = [];
  filteredVariantes: any[][] = [];
  filteredLotes: any[][] = [];
  lotesMap: { [rowIndex: number]: any[] } = {};
  statusHistory: Array<{ status: string; created_at: string }> = [];
  countries: Country[] = [];



  constructor(
    public dialogRef: MatDialogRef<PedidoDialogComponentContent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private snackBar: MatSnackBar,
    private pedidoService: OrdersService,
    private loteService: LoteService,
    private translate: TranslateService,
    private auth: AuthService,
    private dialog: MatDialog,
    private countryService: CountryService,
    private toastr: ToastrService
  ) {
    this.action = data.action;
    this.productoOptions = data.productoOptions;
    this.varianteOptions = data.varianteOptions;
    this.smethodsOptions = data.smethodsOptions;
    this.carriersOptions = data.carriersOptions;
    this.shop = data.shop;

    this.auth.role$.subscribe(role => {
      this.role = role;
    });

    if (this.action === 'View') {
      this.isView = true;
    }
    if (data.pedido) {
      const p = { ...data.pedido };

      // ===== Normalizaciones de cabecera =====
      p.order_id = p.order_id ?? p.id ?? null;                 // asegura order_id
      p.country = (p.country || 'ES').toUpperCase();           // país a MAY
      p.observations = p.observations ?? p.observaciones ?? ''; // tu template usa "observations"
      p.notas_internas = p.notas_internas ?? null;

      // Totales a número si vienen como string
      p.total_amount = Number(p.total_amount ?? 0);
      p.total_units = Number(p.total_units ?? 0);

      // ===== Normalización de líneas =====
      const byProductId = new Map(this.productoOptions.map(o => [o.value, o]));
      const byVariantId = new Map(this.varianteOptions.map(v => [v.value, v]));

      p.order_items = (Array.isArray(p.order_items) ? p.order_items : []).map((it: any) => {
        const prod = byProductId.get(Number(it.product_id)) || null;
        const vari = byVariantId.get(Number(it.variant_id)) || null;

        return {
          // ids
          id: it.id ?? null,
          order_id: p.order_id ?? p.id ?? it.order_id ?? null,

          // producto
          product_id: it.product_id != null ? Number(it.product_id) : null,
          product_label: prod?.label || it.product_label || it.description || '',
          product_image: prod?.image || it.product_image || '',

          // variante
          variant_id: it.variant_id != null ? Number(it.variant_id) : null,
          variant_label: it.variant_label || vari?.label || it.description || '',
          sku: (it.sku || vari?.sku || '').toString(),

          // números coherentes
          quantity: Number(it.quantity ?? 0),
          price: Number(it.price ?? it.unit_price ?? 0),
          weight: Number(it.weight ?? vari?.weight ?? 0),

          // stock en variante si lo tienes en options
          total_units: Number(vari?.total_units ?? NaN),

          // lote info (si existe)
          stock_lot_id: it.stock_lot_id ?? null,
          lote_number: it.lote_number ?? ''
        };
      });

      this.local_data = p;

      // Pre-rellena mapas de variantes por producto para que autocomplete funcione
      this.local_data.order_items.forEach((item: any, idx: number) => {
        this.variantesMap[idx] = this.varianteOptions.filter(v => v.product_id === item.product_id);
        this.filteredVariantes[idx] = [...this.variantesMap[idx]];

        // Si hay variante pre-seleccionada, replica sus campos (label, sku, etc.)
        if (item.variant_id != null) {
          const v = byVariantId.get(item.variant_id);
          if (v) {
            item.variant_label = item.variant_label || v.label || '';
            item.sku = item.sku || v.sku || '';
            item.weight = Number.isFinite(item.weight) ? item.weight : (v.weight ?? 0);
            item.price = Number.isFinite(item.price) ? item.price : (v.price ?? 0);
            item.total_units = Number.isFinite(item.total_units) ? item.total_units : Number(v.total_units ?? NaN);
          }
        }
      });
    } else {
      this.local_data = {
        order_number: '',
        status: 'Unfulfilled',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        country: 'ES',
        postal_code: '',
        city: '',
        shipping_address1: '',
        shipping_address2: '',
        observations: '',
        b2b: false,
        requiere_retorno: false,
        es_devuelto: false,
        order_items: [],
        observaciones: '',
        notas_internas: ''
      };
      this.addItem();
    }


    if (this.local_data.country) {
      this.local_data.country = String(this.local_data.country).toUpperCase();
    }
    this.local_data.order_items.forEach((i: any, idx: number) => {
      i.product_id = Number(i.product_id);
      if (i.variant_id) {
        this.varianteSeleccionada[idx] = i.variant_id;
      }
    });

    if (this.action === 'Add' && (!this.local_data.order_items || this.local_data.order_items.length === 0)) {
      this.local_data.order_items = [];
      this.addItem();
    }

    if (this.action === 'Update' || this.action === 'View') {
      this.local_data.order_items.forEach((item: any, idx: number) => {
        const prod = this.productoOptions.find(p => p.value === item.product_id);
        if (prod) item.product_image = prod.image;
        this.onProductoChange(item.product_id, idx);
      });
    }
  }

  ngOnInit() {
    this.local_data.order_items.forEach((item: any, i: number) => {
      // inicializa arrays
      this.filteredVariantes[i] = [];

      if (item.product_id) {
        this.onProductoChange(item.product_id, i);
      }

      if (item.variant_id != null && item.variant_id !== '') {
        const base = (this.variantesMap[i] && this.variantesMap[i].length)
          ? this.variantesMap[i]
          : this.varianteOptions;

        const opt = base.find(v => this.eq(v.value, item.variant_id) && this.eq(v.product_id, item.product_id));
        item.variant_label = opt?.label || '';
        item.sku = opt?.sku ?? '';
        item.weight = opt?.weight ?? 0;
        item.price = opt?.price ?? 0;
      }
    });

    const orderId = this.local_data?.order_id ?? this.local_data?.id;
    if (orderId) {
      this.pedidoService.getStatusHistory(orderId).subscribe(h => this.statusHistory = h || []);
    }

    this.countries = this.countryService.getCountries();
  }

  private eq(a: any, b: any) { return String(a) === String(b); }

  colorFor(status: string): string {
    const s = (status || '').toLowerCase();
    if (['fulfilled', 'delivered', 'completed'].some(k => s.includes(k))) return 'success';
    if (['returned', 'cancelled', 'canceled', 'refunded'].some(k => s.includes(k))) return 'error';
    if (['unfulfilled', 'pending', 'processing', 'created'].some(k => s.includes(k))) return 'warning';
    if (['paid', 'authorized'].some(k => s.includes(k))) return 'accent';
    return 'primary';
  }

  getCountryName(code?: string): string | undefined {
    if (!code) return undefined;
    const found = this.countries.find(c => c.code.toUpperCase() === code.toUpperCase());
    return found?.name;
  }

  addItem() {
    const idx = this.local_data.order_items.length;
    this.local_data.order_items.push({
      product_id: null,
      product_label: '',
      variant_id: null,
      variant_label: '',
      sku: '',
      weight: 1,
      quantity: 1,
      price: 0,
      product_image: '',
      stock_lot_id: null,
      lote_number: ''
    });
    this.filteredProductos[idx] = [...this.productoOptions];
    this.filteredVariantes[idx] = [];
    this.filteredLotes[idx] = [];
  }
  removeItem(index: number) {
    this.local_data.order_items.splice(index, 1);
  }

  getActionKey(): string {
    switch (this.action) {
      case 'Add': return 'accion_add';
      case 'Update': return 'accion_update';
      case 'View': return 'accion_view';
      case 'Delete': return 'accion_delete';
      default: return 'accion';
    }
  }

  async doAction(): Promise<void> {
    // Recalcular totales locales (no se envían en Add)
    this.local_data.total_units = (this.local_data.order_items || [])
      .reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
    this.local_data.total_amount = (this.local_data.order_items || [])
      .reduce((sum: number, i: any) => sum + ((Number(i.quantity) * Number(i.price)) || 0), 0);

    if (this.action === 'Add') {
      // ✨ Construir payload mínimo por SKU
      const items = (this.local_data.order_items || [])
        .map((it: any) => ({
          sku: (it.sku || '').trim(),
          quantity: Number(it.quantity) || 0,
          stock_lot_id: it.stock_lot_id || null,  // ← Incluir lote seleccionado
        }))
        .filter((x: any) => x.sku && x.quantity > 0);

      if (items.length === 0) {
        this.openSnackBar(this.translate.instant('pedido_items_requeridos') || 'Añade al menos una línea con SKU y cantidad');
        return;
      }

      const payload = {
        order_number: (this.local_data.order_number || '').trim() || String(Date.now()),
        status: (this.local_data.status || 'Unfulfilled'), // por defecto
        customer_name: (this.local_data.customer_name || '').trim(),
        customer_email: (this.local_data.customer_email || '').trim(),
        customer_phone: (this.local_data.customer_phone || '').trim(),
        country: ((this.local_data.country || 'ES') + '').toUpperCase(),
        postal_code: (this.local_data.postal_code || '').trim(),
        city: (this.local_data.city || '').trim(),
        shipping_address1: (this.local_data.shipping_address1 || '').trim(),
        shipping_address2: (this.local_data.shipping_address2 || '').trim(),
        observations: (this.local_data.observations || '').trim(),
        b2b: !!this.local_data.b2b,
        requiere_retorno: !!this.local_data.requiere_retorno,
        es_devuelto: !!this.local_data.es_devuelto,
        order_items: items, // ← solo sku y quantity
        observaciones: (this.local_data.observaciones || '').trim(),
        notas_internas: (this.local_data.notas_internas || '').trim(),
      };

      const bad = (this.local_data.order_items || []).find((it: any, idx: number) => {
        const max = this.getMaxQty(idx);
        return max !== null && Number(it.quantity) > max;
      });
      if (bad) {
        this.openSnackBar(this.translate.instant('cantidad_supera_stock') || 'La cantidad supera el stock disponible.');
        return;
      }
      let body = []
      body.push(payload);
      try {
        await this.pedidoService.createPedido(body).toPromise();
        this.openSnackBar(this.translate.instant('pedido_creado_ok') || 'Pedido creado');
        this.dialogRef.close({ event: 'Refresh', created: true });
      } catch (e) {
        console.error('createPedido error', e);
        this.openSnackBar(this.translate.instant('pedido_creado_error') || 'No se pudo crear el pedido');
      }
      return;
    }

    // ───────── Update / Delete se mantienen igual ─────────
    if (this.action === 'Update') {
      try {
        await this.pedidoService.updatePedido(this.local_data.id, this.local_data).toPromise();
        this.openSnackBar(this.translate.instant('pedido_actualizado_ok'));
        this.dialogRef.close({ event: 'Update' });
      } catch {
        this.openSnackBar(this.translate.instant('pedido_actualizado_error'));
      }
    } else if (this.action === 'Delete') {
      try {
        await this.pedidoService.deletePedido(this.local_data.order_id).toPromise();
        this.openSnackBar(this.translate.instant('pedido_eliminado_ok'));
        this.dialogRef.close({ event: 'Delete' });
      } catch {
        this.openSnackBar(this.translate.instant('pedido_eliminado_error'));
      }
    }
  }


  openSnackBar(message: string) {
    this.snackBar.open(message, this.translate.instant('cerrar'), {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }

  enforceMax(ev: Event, index: number) {
    const max = this.getMaxQty(index);
    if (max == null) return;

    const input = ev.target as HTMLInputElement;
    let val = Number(input.value);
    if (!Number.isFinite(val)) val = 0;

    if (val > max) {
      // clamp inmediato del input y del modelo
      input.value = String(max);
      this.local_data.order_items[index].quantity = max;
      // (opcional) feedback sutil:
      // this.openSnackBar(this.translate.instant('cantidad_supera_stock') || 'Has alcanzado el máximo disponible');
    } else if (val < 0) {
      input.value = '0';
      this.local_data.order_items[index].quantity = 0;
    }
  }


  filterProductos(value: string, index: number) {
    const q = (value || '').toLowerCase();
    this.filteredProductos[index] = this.productoOptions.filter(o =>
      o.label.toLowerCase().includes(q)
    );
  }

  filterVariantes(value: any, index: number) {
    const q = String(value && value.label !== undefined ? value.label : value || '')
      .toLowerCase();
    this.filteredVariantes[index] = (this.variantesMap[index] || []).filter(opt =>
      String(opt.label || '').toLowerCase().includes(q)
    );
  }
  onProductoSelected(prod: any, index: number) {
    this.local_data.order_items[index].product_id = prod.value;
    this.local_data.order_items[index].product_label = prod.label;
    this.local_data.order_items[index].product_image = prod.image || '';

    this.variantesMap[index] = this.varianteOptions.filter(v => v.product_id === prod.value);
    this.filteredVariantes[index] = [...this.variantesMap[index]];

    // limpia variante previa
    this.local_data.order_items[index].variant_id = null;
    this.local_data.order_items[index].variant_label = '';

    // limpia lote previo
    this.resetLoteSelection(index);
    this.filteredLotes[index] = [];

    // autoselección si solo hay una
    if (this.filteredVariantes[index].length === 1) {
      this.onVarianteSelected(this.filteredVariantes[index][0], index);
    }
  }

  onVarOptionSelected(ev: MatOptionSelectionChange, variant: any, index: number) {
    if (!ev.isUserInput || !ev.source.selected) return; // evita el evento de deselección
    this.onVarianteSelected(variant, index);            // reutiliza tu lógica actual
  }

  onVarianteSelected(variantOpt: any, index: number) {
    this.local_data.order_items[index].variant_id = variantOpt.value;   // ← ID único
    this.local_data.order_items[index].variant_label = variantOpt.label; // ← visible
    this.local_data.order_items[index].weight = variantOpt.weight; // ← visible
    this.local_data.order_items[index].sku = variantOpt.sku; // ← visible
    this.local_data.order_items[index].price = variantOpt.price; // ← visible
    this.local_data.order_items[index].total_units = Number(variantOpt.total_units ?? NaN);

    // Resetear selección de lote y cargar lotes disponibles
    this.resetLoteSelection(index);
    this.loadLotesForRow(index);

    this.clampQty(index);
  }

  onProductoChange(productId: number | string, index: number) {
    const item = this.local_data.order_items[index];

    // variantes del producto (comparador tolerante)
    this.variantesMap[index] = (this.varianteOptions || []).filter(v =>
      this.eq(v.product_id, productId)
    );
    this.filteredVariantes[index] = [...this.variantesMap[index]];

    // imagen/label del producto
    const prod = this.productoOptions.find(p => this.eq(p.value, productId));
    if (prod) {
      item.product_image = prod.image || '';
      item.product_label = prod.label || '';
    }

    // ⚠️ Si aún no hay variantes cargadas, NO tocar la variante existente
    const list = this.variantesMap[index];
    if (!list || list.length === 0) return;

    // Autoselección si hay una sola y no hay variant_id previa
    if (list.length === 1 && (item.variant_id == null || item.variant_id === '')) {
      this.onVarianteSelected(list[0], index);
      return;
    }

    // Si ya venía variant_id, hidrata el label y demás campos por ID
    const vid = item.variant_id;
    if (vid != null && vid !== '') {
      const found = list.find(v => this.eq(v.value, vid));
      if (found) {
        item.variant_label = found.label || '';
        item.sku = found.sku ?? '';
        item.weight = found.weight ?? 0;
        item.price = found.price ?? 0;
        item.total_units = Number(found.total_units ?? NaN);
        this.clampQty(index);
        return;
      }
      // Si la variante actual no pertenece al producto seleccionado, entonces sí límpiala
      item.variant_id = null;
      item.variant_label = '';
    }
  }

  closeDialog(): void {
    this.dialogRef.close({ event: 'Cancel' });
  }

  getMaxQty(index: number): number | null {
    const st = Number(this.local_data.order_items?.[index]?.total_units);
    return Number.isFinite(st) && st >= 0 ? st : null; // null = sin límite
  }

  clampQty(index: number): void {
    const item = this.local_data.order_items[index];
    const max = this.getMaxQty(index);
    let q = Number(item.quantity) || 0;

    if (q < 0) q = 0;
    if (max !== null && q > max) q = max;

    item.quantity = q;
  }

  onQtyChange(index: number) {
    this.clampQty(index);
  }

  downloadAlbaran() {
    const orderId = this.local_data?.order_id ?? this.local_data?.id;
    if (!orderId) {
      this.toastr.error(this.translate.instant('error_descargar_albaran') || 'No se puede descargar el albarán', 'Error');
      return;
    }

    this.pedidoService.downloadAlbaran(orderId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `albaran_${this.local_data?.order_number || orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toastr.success(this.translate.instant('descargar_albaran_ok') || 'Albarán descargado correctamente', 'Éxito');
      },
      error: (err) => {
        console.error('Error al descargar albarán', err);
        this.toastr.error(this.translate.instant('error_descargar_albaran') || 'Error al descargar el albarán', 'Error');
      }
    });
  }

  openReturnDialog() {
    // Construimos las líneas a partir de los order_items actuales
    const items = (this.local_data?.order_items || []).map((it: any, idx: number) => ({
      index: idx,
      item_id: it.id ?? null,          // si tu API lo da
      product_id: it.product_id ?? null,
      variant_id: it.variant_id ?? null,
      product_label: it.product_label ?? it.product_name ?? '',
      variant_label: it.variant_label ?? it.variant_name ?? '',
      image: it.product_image ?? '',
      quantity: Number(it.quantity) || 0,
      weight: it.weight,
      price: it.price,
      sku: it.sku,
    }));

    this.dialog.open(ReturnDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      autoFocus: false,
      data: {
        order_id: this.local_data?.order_id ?? this.local_data?.id ?? null,
        order_number: this.local_data?.order_number ?? '',
        total_amount: this.local_data?.total_amount ?? 0,
        items
      }
    }).afterClosed().subscribe(async (result: any) => {
      if (!result) { return; }

      try {
        if ((this.pedidoService as any).markReturn) {
          await (this.pedidoService as any).markReturn(
            this.local_data?.order_id ?? this.local_data?.id,
            result
          ).toPromise();
        } else {
        }

        // ✅ Refrescar estado en el front inmediatamente
        this.local_data.es_devuelto = true;
        if (result.motivo_devolucion) {
          this.local_data.motivo_devolucion = result.motivo_devolucion;
        }

        this.openSnackBar(this.translate.instant('devolucion_ok') || 'Devolución registrada');

      } catch (e) {
        console.error('Error registrando devolución', e);
        this.openSnackBar(this.translate.instant('devolucion_error') || 'No se pudo registrar la devolución');
      }
    });
  }

  // ========== MÉTODOS PARA LOTES ==========

  filterLotes(value: string, index: number) {
    const q = String(value || '').toLowerCase().trim();
    const base = this.lotesMap[index] || [];
    this.filteredLotes[index] = !q ? [...base] : base.filter(l =>
      String(l?.lote_number ?? '').toLowerCase().includes(q)
    );
  }

  onLoteInput(value: string, index: number) {
    this.filterLotes(value, index);
    const item = this.local_data.order_items[index];
    item.lote_number = String(value || '').trim();
    // No limpiar stock_lot_id aquí, solo cuando seleccionan uno nuevo
  }

  onLoteSelected(opt: any, index: number) {
    const item = this.local_data.order_items[index];
    item.stock_lot_id = opt?.id ?? null;
    item.lote_number = opt?.lote_number ?? '';

    // Actualizar el máximo de cantidad según el stock restante del lote
    if (opt?.remaining != null) {
      item.total_units = Number(opt.remaining);
      this.clampQty(index);
    }
  }

  private resetLoteSelection(index: number) {
    const item = this.local_data.order_items[index];
    item.stock_lot_id = null;
    item.lote_number = '';
  }

  private loadLotesForRow(index: number) {
    const item = this.local_data.order_items[index];
    const product = item?.product_id ?? null;
    const variant = item?.variant_id ?? null;

    if (!product || variant == null || variant === '') {
      this.lotesMap[index] = [];
      this.filteredLotes[index] = [];
      return;
    }

    // Buscar lotes con stock > 0
    this.loteService.searchLots({ product_sku: product, variant_sku: variant, q: '' })
      .subscribe({
        next: (rows: any[]) => {
          // Filtrar solo lotes con stock disponible
          const lotesConStock = (rows || []).filter(l => (l.remaining ?? 0) > 0);
          this.lotesMap[index] = lotesConStock;
          this.filteredLotes[index] = [...lotesConStock];

          // Si no hay lote seleccionado, usar el total de todos los lotes como máximo
          if (!item.stock_lot_id) {
            const totalStock = lotesConStock.reduce((sum, l) => sum + (Number(l.remaining) || 0), 0);
            item.total_units = totalStock;
          }
        },
        error: () => {
          this.lotesMap[index] = [];
          this.filteredLotes[index] = [];
        }
      });
  }
}





















interface ReturnDialogData {
  order_id: number | string | null;
  order_number: string;
  total_amount: number;
  items: Array<{
    index: number;
    item_id: number | null;
    product_id: number | null;
    variant_id: number | null;
    product_label: string;
    variant_label: string;
    image?: string;
    quantity: number;
    weight: number;
    price: number;
    sku: string;
  }>;
}

@Component({
  standalone: true,
  selector: 'app-return-dialog',
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  template: `
  <div class="d-flex align-items-center justify-content-between m-b-8 p-x-20 p-t-16">
    <h3 style="margin:0;">
      {{ 'devolver_productos' | translate : ({default:'Devolver productos'}) }}
      <small class="text-muted" *ngIf="data?.order_number">&nbsp;{{data.order_number}}</small>
    </h3>
    <button mat-icon-button (click)="close()">
      <i-tabler name="x" class="icon-20 d-flex"></i-tabler>
    </button>
  </div>

  <mat-dialog-content class="mat-typography" style="padding-top: 0;">
    <p class="f-s-14 m-b-16" style="margin: 0 4px 12px 4px;">
      {{ 'devolver_productos_hint' | translate : ({default:
        'Marca los artículos que vuelven al stock y ajusta la cantidad a devolver (no puede superar la cantidad del pedido).'}) }}
    </p>

    <div class="d-flex align-items-center m-b-12" style="gap:12px; margin: 0 4px 8px 4px;">
      <mat-checkbox
        [checked]="allChecked"
        (change)="toggleAll($event.checked)">
        {{ allChecked ? ('quitar_todos' | translate : ({default:'Quitar todos'})) : ('marcar_todos' | translate : ({default:'Marcar todos'})) }}
      </mat-checkbox>
    </div>

    <div class="row" *ngFor="let line of lines; let i = index" style="align-items:center; margin-bottom:12px;">
      <div class="col-lg-1 d-flex align-items-center justify-content-end px-0">
        <img *ngIf="line.image" [src]="line.image" width="37" height="37" style="border-radius:4px; height:37px;" />
      </div>

      <div class="col-lg-5">
        <div class="f-w-600">{{ line.product_label || '-' }}</div>
        <div class="text-muted f-s-13">{{ line.variant_label || '-' }}</div>
      </div>

      <div class="col-lg-2">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ 'cantidad_pedida' | translate : ({default:'Cant. pedida'}) }}</mat-label>
          <input matInput type="number" [value]="line.quantity" disabled>
        </mat-form-field>
      </div>

      <div class="col-lg-2">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ 'a_devolver' | translate : ({default:'A devolver'}) }}</mat-label>
          <input
            matInput
            type="number"
            [(ngModel)]="line.restockQty"
            [disabled]="!line.checked"
            [min]="0"
            [max]="line.quantity"
            (ngModelChange)="onQtyChange(line)">
        </mat-form-field>
      </div>

      <div class="col-lg-2 d-flex align-items-center">
        <mat-checkbox
          [(ngModel)]="line.checked"
          (change)="onCheckChange(line)">
          {{ 'devolver' | translate : ({default:'Devolver'}) }}
        </mat-checkbox>
      </div>
    </div>
    <div class="row" style="margin-top: 16px;">
      <div class="col-12">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ 'motivo_devolucion' | translate : ({default:'Motivo de devolución'}) }}</mat-label>
          <textarea matInput [(ngModel)]="motivo" name="motivo"
            [placeholder]="'motivo_opcional' | translate : ({default:'Opcional'})"></textarea>
        </mat-form-field>
      </div>
    </div>
  </mat-dialog-content>

  <mat-dialog-actions align="end" style="padding:16px;">
    <button mat-flat-button class="bg-error text-white" (click)="close()">
      {{ 'cancelar' | translate : ({default:'Cancelar'}) }}
    </button>
    <button mat-flat-button color="primary" (click)="confirm()" [disabled]="!hasAnyQty()">
      {{ 'confirmar' | translate : ({default:'Confirmar'}) }}
    </button>
  </mat-dialog-actions>
  `
})
export class ReturnDialogComponent {
  lines: Array<{
    index: number;
    item_id: number | null;
    product_id: number | null;
    variant_id: number | null;
    product_label: string;
    variant_label: string;
    sku: string;
    weight: number;
    price: number;
    image?: string;
    quantity: number;
    checked: boolean;
    restockQty: number;
  }> = [];
  motivo: string = '';


  get allChecked(): boolean {
    return this.lines.length > 0 && this.lines.every(l => l.checked);
  }

  constructor(
    private ref: MatDialogRef<ReturnDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReturnDialogData,
    private translateService: TranslateService,
    private ordersService: OrdersService
  ) {
    // Por defecto, todos marcados y restockQty = quantity
    this.lines = (data?.items || []).map(it => ({
      ...it,
      checked: it.quantity > 0,
      restockQty: it.quantity > 0 ? it.quantity : 0
    }));
  }

  onCheckChange(line: any) {
    if (!line.checked) {
      line.restockQty = 0;
    } else if (line.restockQty === 0) {
      line.restockQty = Math.max(0, Math.min(line.quantity, line.quantity));
    }
  }

  onQtyChange(line: any) {
    const q = Number(line.restockQty) || 0;
    if (q < 0) line.restockQty = 0;
    if (q > line.quantity) line.restockQty = line.quantity;
    if (line.restockQty > 0 && !line.checked) line.checked = true;
  }

  toggleAll(checked: boolean) {
    this.lines.forEach(l => {
      l.checked = checked;
      l.restockQty = checked ? l.quantity : 0;
    });
  }

  hasAnyQty(): boolean {
    return this.lines.some(l => l.checked && l.restockQty > 0);
  }

  confirm() {


    const payload = this.lines
      .filter(l => l.checked && l.restockQty > 0)
      .map(l => ({
        item_id: l.item_id,
        product_id: l.product_id,
        variant_id: l.variant_id,
        quantityOrdered: l.quantity,
        restockQty: l.restockQty
      }));

    if (payload.length === 0) {
      return;
    }

    // Llamamos al servicio (nuevo método que añadiremos en OrdersService)
    this.ordersService.devolucionOrder(this.data.order_id, {
      order_number: this.data.order_number,
      items: payload,
      total_amount: this.data.total_amount,
      motivo_devolucion: this.motivo || null
    }).subscribe({
      next: () => {
        // Cerramos modal devolviendo el payload si quieres notificar al padre
        this.ref.close({
          items: payload,
          motivo_devolucion: this.motivo || null
        });
      },
      error: (err) => {
        console.error('Error al devolver pedido', err);
        this.ref.close(); // puedes decidir si cierras o no
      }
    });
  }

  close() {
    this.ref.close();
  }
}
