import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { MaterialModule } from 'src/app/material.module';
import { OrdersService } from 'src/app/shared/services/orders.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { PackgoConfirmData, PackgoConfirmDialogComponent } from './packgo-confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BridgePrintService } from 'src/app/shared/services/bridge-print.service';
import { AuthService } from 'src/app/shared/services/auth.service';

type BoxKey = 'S' | 'M' | 'L';


@Component({
  selector: 'app-packgo',
  templateUrl: './packgo.page.html',
  styleUrls: ['./packgo.page.scss'],
  standalone: true,
  imports: [IonContent, MaterialModule, CommonModule, FormsModule],
  animations: [
    trigger('slideIndex', [
      transition('* => *', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'none' }))
      ])
    ])
  ]
})
export class PackgoPage implements OnInit, OnDestroy {
  /** Array de pedidos tal y como viene del backend */
  orders: any[] = [];


  private tiendaId = '...';  // de tu contexto
  private userId = 'usuario_X'; // tu sesión
  private hbTimer: any; // ← ya no se usa, lo dejo para “no cambiar nada” fuera del heartbeat
  private lockToken?: string;

  private completionDialogOpen = false;
  private scanPaused = false;
  /** Índice del pedido mostrado */
  currentIndex = 0;

  /** Pedido actual */
  currentOrder: any | null = null;
  boxQty: Record<BoxKey, number> = { S: 0, M: 0, L: 0 };

  addressFields: {
    Nombre?: string;
    Dirección?: string;
    'Dirección 2'?: string;
    'Código Postal'?: string;
    Ciudad?: string;
    Provincia?: string;
    País?: string;
    Teléfono?: string;
  } = {};

  printers: string[] = [];
  selectedPrinter?: string;
  loadingPrinters = false;

  /** Items mapeados */
  orderItems: Array<{
    image: string;
    title: string;
    subtitle?: string;
    ean?: string;
    reference?: string;
    location?: string;
    weight?: number;
    qty: number;
    picked: number;
  }> = [];

  /** UI / scanner */
  scannedIndex: number | null = null;
  private scannedTimer: any;
  private scanBuffer = '';
  private lastKeyTime = 0;
  private readonly SCAN_INTERCHAR_MS = 1000;
  private readonly FINISH_KEYS = new Set(['Enter', 'Tab']);

  isProcessing = false;

  /** Controles superiores */
  boxSize: BoxKey = 'M';
  addressText = '';

  // ====== 🔵 NUEVO: control del heartbeat por RxJS ======
  private stopHb$ = new Subject<void>();

  constructor(private ordersService: OrdersService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private bridge: BridgePrintService,
    private auth: AuthService) { }

  // --- Scanner: capta códigos y procesa ---
  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(ev: KeyboardEvent) {
    if (this.scanPaused) return;
    const now = Date.now();
    if (now - this.lastKeyTime > this.SCAN_INTERCHAR_MS) this.scanBuffer = '';
    this.lastKeyTime = now;

    if (this.FINISH_KEYS.has(ev.key)) {
      ev.preventDefault();
      const code = this.scanBuffer.trim();
      this.scanBuffer = '';
      this.processScan(code);
      return;
    }
    if (ev.key.length === 1) this.scanBuffer += ev.key;
  }

  incBox(k: BoxKey) {
    this.boxQty[k] = (this.boxQty[k] ?? 0) + 1;
  }
  decBox(k: BoxKey) {
    this.boxQty[k] = Math.max(0, (this.boxQty[k] ?? 0) - 1);
  }
  normalizeBox(k: BoxKey) {
    const v = Number(this.boxQty[k] ?? 0);
    this.boxQty[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  private resolveLabelPrinter(): string | undefined {
    return localStorage.getItem('label_printer') || undefined; // guarda aquí el nombre elegido
  }

  private beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    // Intento síncrono de limpiar - el navegador no espera async
    this.stopHeartbeat();

    // Usar sendBeacon para asegurar que la petición se envíe incluso al cerrar
    if (this.currentOrder?.order_id && this.lockToken) {
      const url = `${this.ordersService['base']}/orders/packgo/unlock`;
      const data = JSON.stringify({
        orderId: this.currentOrder.order_id,
        lockToken: this.lockToken,
        isSkip: false
      });

      // sendBeacon se envía incluso si la página se cierra
      navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
    }
  };

  private async cleanupLock() {
    try {
      // 🔵 en lugar de clearInterval, paramos el stream
      this.stopHeartbeat();
      if (this.currentOrder?.order_id && this.lockToken) {
        await firstValueFrom(this.ordersService.unlockPackgo(this.currentOrder.order_id, this.lockToken));
      }
    } catch { }
  }

  private getInitialBoxQty(order: any): Record<BoxKey, number> {
    const toInt = (v: any) => {
      const n = Number.parseInt(String(v ?? 0), 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    return {
      S: toInt(order?.cajas_s),
      M: toInt(order?.cajas_m),
      L: toInt(order?.cajas_l),
    };
  }


  async skipOrder() {
    try {
      // 🔵 detenemos HB antes de soltar el lock
      this.stopHeartbeat();
      if (this.currentOrder?.order_id && this.lockToken) {
        // Marcar como skip manual (isSkip = true) para evitar bucles
        await firstValueFrom(this.ordersService.unlockPackgo(this.currentOrder.order_id, this.lockToken, true));
      }
    } finally {
      await this.claimNext();
    }
  }


  private findNextIndexForCode(code: string): number {
    const codeU = code.toUpperCase();
    let firstFullMatch: number = -1;

    for (let i = 0; i < this.orderItems.length; i++) {
      const it = this.orderItems[i];
      const matches =
        (it.reference || '').toUpperCase() === codeU ||
        (it.ean || '') === code;

    if (!matches) continue;

      if (it.picked < it.qty) {
        // primera con unidades pendientes → úsala
        return i;
      } else if (firstFullMatch === -1) {
        // guarda la primera coincidencia ya completa por si no hay pendientes
        firstFullMatch = i;
      }
    }

    return firstFullMatch; // -1 si no hay ninguna coincidencia
  }

  private processScan(code: string) {
    if (!code) return;

    const idx = this.findNextIndexForCode(code);

    if (idx >= 0) {
      const it = this.orderItems[idx];
      if (it.picked < it.qty) {
        this.increment(idx);      // marca una unidad en esa línea
        this.flashRow(idx);
      } else {
        // Coincidía pero ya estaba completa: solo feedback visual (y opcional snack)
        this.flashRow(idx);
        this.snack.open('Ese artículo ya está completo en todas las líneas.', 'OK', { duration: 1400 });
      }
    } else {
      // No hay ninguna línea con ese EAN/SKU
      this.flashRow(null);
      this.snack.open('Código no encontrado en este pedido.', 'OK', { duration: 1400 });
    }
  }

  private flashRow(index: number | null) {
    this.clearScanFlash();
    if (index === null) return;
    this.scannedIndex = index;
    this.scannedTimer = setTimeout(() => (this.scannedIndex = null), 900);
  }

  private clearScanFlash() {
    if (this.scannedTimer) clearTimeout(this.scannedTimer);
    this.scannedIndex = null;
  }

  ngOnInit() {
    this.userId = this.auth.getUserId();
    this.selectedPrinter = this.bridge.getDefaultPrinter();
    this.refreshPrinters();
    this.claimNext(); // pide el primero
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  // 🔵 Ionic puede no destruir la página; usa estos hooks
  ionViewDidEnter() {
    this.startHeartbeat();
  }

  async ionViewWillLeave() {
    this.stopHeartbeat();
    await this.cleanupLock();
  }

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.stopHeartbeat();   // 🔵 asegura parada
    // No podemos await aquí porque ngOnDestroy no puede ser async
    // Pero sendBeacon en beforeUnload se encarga del caso de cierre de página
    this.cleanupLock();
  }

  async refreshPrinters() {
    try {
      this.loadingPrinters = true;
      const ok = await this.bridge.checkStatus();
      if (!ok) {
        this.snack.open('Bridge no conectado en este equipo.', 'OK', { duration: 2500 });
        this.printers = [];
        return;
      }
      this.printers = await this.bridge.listPrinters();
      if (!this.selectedPrinter && this.printers.length) {
        this.selectedPrinter = this.printers[0];
        this.bridge.setDefaultPrinter(this.selectedPrinter);
      }
    } catch (e: any) {
      this.snack.open(`Error listando impresoras: ${e?.message || e}`, 'OK', { duration: 3500 });
    } finally {
      this.loadingPrinters = false;
    }
  }

  onPrinterChange(name: string) {
    this.bridge.setDefaultPrinter(name);
    this.snack.open(`Impresora seleccionada: ${name}`, 'OK', { duration: 2000 });
  }

  /** Mapea el pedido actual a la estructura usada por la vista */
  private loadCurrentOrder() {
    this.completionDialogOpen = false;
    if (!this.orders.length) {
      this.currentOrder = null;
      this.orderItems = [];
      return;
    }

    this.currentOrder = this.orders[this.currentIndex];

    const productos = this.currentOrder?.productos || [];
    this.boxQty = this.getInitialBoxQty(this.currentOrder);
    this.orderItems = productos.map((p: any) => {
      const q = Number(p.quantity) || 0;
      return {
        image: p.image || this.resolveImage(p),
        title: p.name || p.sku || 'Artículo',
        subtitle: '',
        ean: p.ean || '',
        reference: p.sku || '',
        location: p.location || '',
        weight: p.weight || 0,
        qty: q,
        picked: 0
      };
    });

    // precarga dirección en un solo campo editable y limpio de saltos raros
    this.addressText = this.buildAddressText(this.currentOrder);
    // tamaño de caja por defecto (puedes inferir por peso/vol si lo tuvieras)
    this.boxSize = 'M';
  }

  /** Flechas: navegar pedidos */
  prevOrder() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadCurrentOrder();
    }
  }
  nextOrder() {
    if (this.currentIndex < this.orders.length - 1) {
      this.currentIndex++;
      this.loadCurrentOrder();
    }
  }

  /** Totales dinámicos del pedido actual */
  get totalQty() {
    return this.orderItems.reduce((acc, it) => acc + (it.qty || 0), 0);
  }
  get packedCount() {
    return this.orderItems.filter(it => it.picked === it.qty).length;
  }

  increment(i: number) {
    const it = this.orderItems[i];
    if (!it || it.picked >= it.qty) return;
    it.picked = Math.min(it.qty, it.picked + 1);
    if (this.isOrderCompleted()) this.onOrderCompleted();
  }

  decrement(i: number) {
    const it = this.orderItems[i];
    if (!it || it.picked <= 0) return;
    it.picked = Math.max(0, it.picked - 1);
  }



  private isOrderCompleted(): boolean {
    return this.orderItems.length > 0 && this.orderItems.every(it => it.picked === it.qty);
  }

  /** Hook de completado: ahora solo loguea */
  private onOrderCompleted() {
    if (this.completionDialogOpen) return; // no abrir duplicado
    this.completionDialogOpen = true;
    this.scanPaused = true;

    const total = (this.boxQty.S || 0) + (this.boxQty.M || 0) + (this.boxQty.L || 0);

    const data: PackgoConfirmData = {
      orderNumber: this.currentOrder?.order_number,
      address: this.addressText,
      boxQty: { ...this.boxQty },
      total
    };

    const ref = this.dialog.open(PackgoConfirmDialogComponent, {
      data,
      width: '560px',
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'packgo-confirm-dialog'
    });

    ref.afterClosed().subscribe(result => {
      this.scanPaused = false;
      this.completionDialogOpen = false;
      if (result === 'confirm') {
        this.printLabelsAndContinue(data);
      }
    });
  }


  private async printLabelsAndContinue(data: PackgoConfirmData) {
  // Validación rápida
  if (!this.currentOrder?.order_number && !this.currentOrder?._id) {
    this.snack.open('Pedido sin ID. No puedo crear etiqueta.', 'OK', { duration: 3000 });
    return;
  }
  if ((data.total || 0) <= 0) {
    this.snack.open('No hay bultos (S/M/L) para crear etiqueta.', 'OK', { duration: 3000 });
    return;
  }

  const orderId = this.currentOrder?.id ?? this.currentOrder?._id;
  const printer = this.resolveLabelPrinter();

  // Heurística: si el nombre contiene "epson", tratamos como A4 (PDF)
  const pname = (printer || '').toLowerCase();
  const labelType: 'normal_printer' | 'label_printer' =
    pname.includes('epson') ? 'normal_printer' : 'label_printer';

  // Payload para el endpoint
  const payload: any = {
    orderId,
    orderNumber: data.orderNumber,
    address: { text: this.addressText },
    items: this.orderItems.map(i => ({ sku: i.reference, ean: i.ean, qty: i.qty })),
    boxes: data.boxQty,
    label_type: labelType,
    start_from: undefined,
    shipping_product_id: this.currentOrder?.shipping_product_id,
    contract_id: this.currentOrder?.contract_id,
  };

  try {
    this.isProcessing = true;
    this.snack.open('Creando etiqueta(s)...', undefined, { duration: 2000 });

    const scResp = await firstValueFrom(this.ordersService.shipWithSendcloud(payload));
    console.log('Sendcloud resp:', scResp);

    const printerName = this.resolveLabelPrinter();
    const printerIp = localStorage.getItem('label_printer_ip') || undefined;

    let printedCount = 0;

    // ========== PRIORIDAD 1: ZPL (Array) ==========
    if (Array.isArray(scResp?.zplBase64List) && scResp.zplBase64List.length > 0) {
      const total = scResp.zplBase64List.length;
      this.snack.open(`Imprimiendo ${total} etiqueta(s) ZPL...`, undefined, { duration: 2000 });
      
      for (let i = 0; i < total; i++) {
        const b64 = scResp.zplBase64List[i];
        console.log(`Imprimiendo etiqueta ZPL ${i + 1}/${total}...`);
        
        try {
          await this.bridge.printZpl(b64, {
            ...(printerIp ? { ip: printerIp, port: 9100 } : {}),
            ...(printerName ? { printer: printerName } : {}),
            isBase64: true,
          });
          printedCount++;
          
          // Pequeña pausa entre etiquetas para no saturar la impresora
          if (i < total - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (printErr) {
          console.error(`Error imprimiendo etiqueta ${i + 1}:`, printErr);
          this.snack.open(`Error en etiqueta ${i + 1}: ${printErr}`, 'OK', { duration: 3000 });
        }
      }
      
      console.log(`✅ ${printedCount}/${total} etiquetas ZPL impresas`);
    }
    // ========== PRIORIDAD 2: ZPL (String único) ==========
    else if (typeof scResp?.zplBase64 === 'string' && scResp.zplBase64) {
      // Detectar si es PDF disfrazado
      if (/^JVBERi0xL/i.test(scResp.zplBase64)) {
        this.snack.open('Etiqueta detectada como PDF. Imprimiendo...', undefined, { duration: 1800 });
        await this.bridge.printPdfBase64(scResp.zplBase64, printerName);
        printedCount = 1;
      } else {
        this.snack.open('Imprimiendo etiqueta ZPL...', undefined, { duration: 1500 });
        await this.bridge.printZpl(scResp.zplBase64, {
          ...(printerIp ? { ip: printerIp, port: 9100 } : {}),
          ...(printerName ? { printer: printerName } : {}),
          isBase64: true,
        });
        printedCount = 1;
      }
    }
    // ========== PRIORIDAD 3: PDF (Array) ==========
    else if (Array.isArray(scResp?.labelsBase64) && scResp.labelsBase64.length > 0) {
      const total = scResp.labelsBase64.length;
      this.snack.open(`Imprimiendo ${total} etiqueta(s) PDF...`, undefined, { duration: 2000 });
      
      for (let i = 0; i < total; i++) {
        const pdfB64 = scResp.labelsBase64[i];
        console.log(`Imprimiendo PDF ${i + 1}/${total}...`);
        
        try {
          await this.bridge.printPdfBase64(pdfB64, printerName);
          printedCount++;
          
          // Pausa entre PDFs
          if (i < total - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (printErr) {
          console.error(`Error imprimiendo PDF ${i + 1}:`, printErr);
          this.snack.open(`Error en PDF ${i + 1}: ${printErr}`, 'OK', { duration: 3000 });
        }
      }
      
      console.log(`✅ ${printedCount}/${total} PDFs impresos`);
    }
    // ========== PRIORIDAD 4: PDF (String único) ==========
    else if (typeof scResp?.pdfBase64 === 'string' && scResp.pdfBase64) {
      this.snack.open('Imprimiendo PDF...', undefined, { duration: 1500 });
      await this.bridge.printPdfBase64(scResp.pdfBase64, printerName);
      printedCount = 1;
    }
    // ========== Sin etiquetas ==========
    else {
      throw new Error('El backend no devolvió ninguna etiqueta (ZPL o PDF).');
    }

    // Verificar que se imprimió al menos una
    if (printedCount === 0) {
      throw new Error('No se pudo imprimir ninguna etiqueta.');
    }

    // Marca como enviado
    await this.ordersService.markOrderAsShipped(orderId, {
      parcelId: scResp.parcelId,
      tracking_number: scResp.tracking_number,
      boxes: data.boxQty
    });

    this.snack.open(
      `✅ ${printedCount} etiqueta(s) impresa(s) y pedido actualizado`, 
      'OK', 
      { duration: 2500 }
    );

    // Completar el lock y pedir el siguiente
    if (this.currentOrder?.order_id && this.lockToken) {
      await firstValueFrom(this.ordersService.completePackgo(
        this.currentOrder.order_id,
        this.lockToken,
        {
          parcelId: scResp.parcelId,
          tracking_number: scResp.tracking_number,
          boxes: data.boxQty
        }
      ));
    }

    // Pide el siguiente pedido
    await this.claimNext();

  } catch (err: any) {
    console.error('Error en printLabelsAndContinue:', err);
    this.snack.open(
      `Error creando/imprimiendo etiqueta: ${err?.message || err}`, 
      'OK', 
      { duration: 5000 }
    );
  } finally {
    this.isProcessing = false;
  }
}

  private async claimNext() {
    try {
      // 🔵 limpia heartbeat anterior
      this.stopHeartbeat();

      const currentId = this.currentOrder?.order_id ?? null;
      this.currentOrder = null;
      this.orderItems = [];
      this.lockToken = undefined;


      const resp = await firstValueFrom(this.ordersService.claimNextPackgo(this.userId, currentId));
      if (!resp || !resp.order) {
        this.snack.open('No hay pedidos disponibles ahora mismo.', 'OK', { duration: 2500 });
        return;
      }
      this.lockToken = resp.lockToken;
      this.currentOrder = resp.order;
      this.boxQty = this.getInitialBoxQty(this.currentOrder);

      // mapeo items como ya haces
      const productos = this.currentOrder?.productos || [];
      this.orderItems = productos.map((p: any) => ({
        image: p.image || this.resolveImage(p),
        title: p.name || p.sku || 'Artículo',
        subtitle: '',
        ean: p.ean || '',
        reference: p.sku || '',
        location: p.location || '',
        weight: p.weight || 0,
        qty: Number(p.quantity) || 0,
        picked: 0
      }));

      this.addressText = this.buildAddressText(this.currentOrder);
      this.boxSize = 'M';
      this.boxQty = this.getInitialBoxQty(this.currentOrder);

      // 🔵 heartbeat cada 60s con RxJS
      this.startHeartbeat();

    } catch (e: any) {
      if (e?.status === 204) {
        this.snack.open('No hay pedidos disponibles.', 'OK', { duration: 2500 });
      } else {
        this.snack.open(`Error reclamando pedido: ${e?.message || e}`, 'OK', { duration: 3500 });
      }
    }
  }



  /** Imagen por defecto */
  private resolveImage(_item: any): string {
    return 'https://via.placeholder.com/80x80';
  }

  /** Dirección a texto compacto editable */
  private buildAddressText(order: any): string {
    if (!order) {
      this.addressFields = {};
      return '';
    }

    // mismos orígenes que ya usabas:
    const name = order.customer_name || order.shipping_name || order.name || '';
    const a1 = order.shipping_address1 || order.address1 || '';
    const a2 = order.shipping_address2 || order.address2 || '';
    const zip = order.shipping_zip || order.zip || '';
    const city = order.shipping_city || order.city || '';
    const prov = order.shipping_province || order.province || '';
    const country = order.shipping_country || order.country || '';
    const phone = order.shipping_phone || order.phone || '';

    // ← aquí rellenamos los campos legibles SIN crear otra función
    this.addressFields = {
      'Nombre': name,
      'Dirección': a1,
      'Dirección 2': a2,
      'Código Postal': zip,
      'Ciudad': city,
      'Provincia': prov,
      'País': country,
      'Teléfono': phone
    };

    // y seguimos devolviendo el texto unido como ya hacías
    const parts = [
      name, a1, a2,
      `${zip} ${city}`.trim(),
      prov, country, phone
    ].filter(Boolean);

    return parts.join(' · ');
  }

  /** trackBy */
  trackByIdx = (i: number, _row: any) => i;

  async chooseLabelPrinter() {
    try {
      // 1) Verifica que el bridge está vivo (opcional)
      const ok = await this.bridge.checkStatus();
      if (!ok) {
        this.snack.open('Bridge no conectado. Ábrelo en el PC.', 'OK', { duration: 3000 });
        return;
      }

      // 2) Lista impresoras del sistema
      const printers = await this.bridge.listPrinters();
      if (!printers.length) {
        this.snack.open('No se detectan impresoras en este equipo.', 'OK', { duration: 3000 });
        return;
      }

      console.log('Impresoras detectadas:', printers);

      // 3) Elige una (ejemplo: la primera o muestra un select en UI)
      const chosen = printers[0]; // <-- reemplaza por la que el usuario seleccione
      this.bridge.setDefaultPrinter(chosen);
      this.snack.open(`Impresora por defecto: ${chosen}`, 'OK', { duration: 2500 });
    } catch (e: any) {
      this.snack.open(`Error listando impresoras: ${e?.message || e}`, 'OK', { duration: 4000 });
    }
  }

  // ====== 🔵 NUEVO: helpers heartbeat ======
  private startHeartbeat() {
    // corta uno previo si lo hubiera
    this.stopHeartbeat();

    if (!this.currentOrder?.order_id || !this.lockToken) return;

    interval(60000)
      .pipe(takeUntil(this.stopHb$))
      .subscribe(() => {
        if (this.currentOrder?.order_id && this.lockToken) {
          this.ordersService
            .heartbeatPackgo(this.currentOrder.order_id, this.lockToken)
            .subscribe({ next: () => { }, error: () => { } });
        }
      });
  }

  private stopHeartbeat() {
    this.stopHb$.next(); // no complete: la página puede reutilizarse
  }
}
