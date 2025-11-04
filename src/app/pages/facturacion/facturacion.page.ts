// facturacion.page.ts
import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { OrdersService } from 'src/app/shared/services/orders.service';
import { LoteService } from 'src/app/shared/services/lote.service';
import { UsersService } from 'src/app/shared/services/users.service';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonContent, ViewWillEnter } from '@ionic/angular/standalone';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-facturacion',
  templateUrl: './facturacion.page.html',
  styleUrls: ['./facturacion.page.scss'],
  imports: [
    IonContent,
    CommonModule,
    MaterialModule,
    TablerIconsModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule
  ]
})
export class FacturacionPage implements OnInit, AfterViewInit, ViewWillEnter {
  shop = '';
  productos: any[] = [];
  variantes: any[] = [];
  carriers: any[] = [];
  smethods: any[] = [];

  allUsers: { email: string; tienda_id: string; precio_albaran: number }[] = [];
  usersOptions: { label: string; value: string | null }[] = [];
  userSeleccionado: string | null = null;
  userObjetoSeleccionado: any = null;

  // Lookup rápido producto → datos
  productsMap: Record<number, { name: string; image: string }> = {};
  variantesDataSource = new MatTableDataSource<any>();
  shippingDataSource = new MatTableDataSource<any>();

  @ViewChild('variantePaginator') variantePaginator!: MatPaginator;
  @ViewChild('shippingPaginator') shippingPaginator!: MatPaginator;

  varianteColumns = ['image', 'producto', 'name', 'picking_price'];
  shippingColumns = ['name', 'price'];

  showFacturacionForm = false;
  hasChanges = false;

  // Fechas por defecto
  fechaDesde: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  fechaHasta: Date = new Date();

  // Precios editables
  pickingPrices: Record<number, number> = {};
  shippingPrices: Record<number, number> = {};
  invoiceCost = 0;

  constructor(
    private orderService: OrdersService,
    private loteService: LoteService,
    private usersService: UsersService,
    private translate: TranslateService
  ) { }

  ionViewWillEnter() {
    // Solo cargar lista de usuarios
    this.usersService.getUsers().subscribe(data => {
      this.allUsers = data;
      this.usersOptions = [
        { label: 'No simular', value: null },
        ...data.map(u => ({ label: u.email, value: u.tienda_id }))
      ];
    });
  }

  ngAfterViewInit() { }
  ngOnInit() { }

  onUserChange() {
    if (!this.userSeleccionado) {
      this.showFacturacionForm = false;
      this.hasChanges = false;
      this.variantesDataSource.data = [];
      this.shippingDataSource.data = [];
      return;
    }
    // Inicializar precio albarán y bandera
    this.userObjetoSeleccionado = this.allUsers.find(u => u.tienda_id === this.userSeleccionado) || null;
    this.invoiceCost = this.userObjetoSeleccionado?.precio_albaran ?? 0;
    this.showFacturacionForm = true;
    this.hasChanges = false;
    // Cargar datos de esa tienda
    this.loadFacturacion(this.userSeleccionado);
  }

  async loadFacturacion(shopId: string) {
    this.productos = await this.loteService.getProductosByShop(shopId).toPromise() || [];
    this.variantes = await this.loteService.getAllVariantsByShop(shopId).toPromise() || [];
    this.carriers = await this.orderService.getCarriersByShop(shopId).toPromise() || [];
    this.smethods = await this.orderService.getShippingMethodsByShop(shopId).toPromise() || [];

    // Reconstruir mapa de productos
    this.productsMap = {};
    this.productos.forEach(p => this.productsMap[p.id] = { name: p.name, image: p.image });

    // Rellenar tablas
    this.variantesDataSource.data = this.variantes;
    this.shippingDataSource.data = this.smethods;

    // Opciones para selects (si se usan)
    // ...

    // Configurar filtros
    this.variantesDataSource.filterPredicate = (row, filter) => {
      const term = filter.trim().toLowerCase();
      const dataStr = [
        this.getProductName(row.id_producto),
        row.name,
        String(row.picking_price)
      ].join(' ').toLowerCase();
      return dataStr.includes(term);
    };
    this.shippingDataSource.filterPredicate = (row, filter) => {
      const term = filter.trim().toLowerCase();
      const dataStr = [row.label, String(row.value)].join(' ').toLowerCase();
      return dataStr.includes(term);
    };

    // Conectar paginadores
    this.variantesDataSource.paginator = this.variantePaginator;
    this.shippingDataSource.paginator = this.shippingPaginator;
  }

  applyVariantsFilter(e: Event) {
    let v = (e.target as HTMLInputElement).value.trim().toLowerCase().replace(/,/g, '.');
    this.variantesDataSource.filter = v;
    this.variantesDataSource.paginator?.firstPage();
  }
  applyShippingFilter(e: Event) {
    let v = (e.target as HTMLInputElement).value.trim().toLowerCase().replace(/,/g, '.');
    this.shippingDataSource.filter = v;
    this.shippingDataSource.paginator?.firstPage();
  }

  onPickingPriceChange(id: number, price: number) {
    this.pickingPrices[id] = price;
    this.hasChanges = true;
  }
  onShippingPriceChange(id: number, price: number) {
    this.shippingPrices[id] = price;
    this.hasChanges = true;
  }
  onInvoiceCostChange(cost: number) {
    this.invoiceCost = cost;
    if (this.userObjetoSeleccionado) {
      this.userObjetoSeleccionado.precio_albaran = cost;
    }
    this.hasChanges = true;
  }

  async saveChanges() {
    if (!this.userSeleccionado) return;

    this.orderService
      .batchUpdateFacturacion(
        this.userSeleccionado,
        this.pickingPrices,
        this.shippingPrices,
        this.invoiceCost
      )
      .subscribe({
        next: () => {
          // todo OK: quitamos el flag y, si quieres, recargamos
          this.hasChanges = false;
        },
        error: err => {
          console.error('Error guardando facturación', err);
          alert(this.translate.instant('error_guardando_facturacion'));
        }
      });
  }

  onCancel() {
    if (!confirm(this.translate.instant('seguro_eliminar_cambios'))) return;
    this.hasChanges = false;
    this.loadFacturacion(this.userSeleccionado!);
  }

  getProductName(id: number): string {
    return this.productsMap[id]?.name ?? '';
  }
  getProductImage(id: number): string {
    return this.productsMap[id]?.image ?? '';
  }

  private formatDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Fuerza la descarga de un Blob */
  private downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  exportFacturacion() {
    if (!this.userSeleccionado) return;

    const desde = this.formatDate(this.fechaDesde);
    const hasta = this.formatDate(this.fechaHasta);

    this.orderService
      .exportFacturacion(this.userSeleccionado, desde, hasta)
      .subscribe({
        next: blob => this.downloadBlob(blob, `facturacion_${this.userSeleccionado}_${desde}_${hasta}.xlsx`),
        error: err => {
          console.error('Error al descargar Excel', err);
          alert(this.translate.instant('error_descargar_excel'));
        }
      });
  }
}
