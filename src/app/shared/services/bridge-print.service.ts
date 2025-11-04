import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject, firstValueFrom, filter, take, timeout } from 'rxjs';

export type ConnectionType = 'windows' | 'network' | 'linux';

export interface PrinterConfig {
  title?: string;
  connection_type: ConnectionType;
  path?: string;
  ip_address?: string;
  port?: number;
  capability_profile?: 'simple' | 'default';
  char_per_line?: number;
}

export interface ReceiptLine {
  name: string;
  variation?: string;
  quantity: number | string;
  unit_price?: string;
  line_total?: string;
  sub_sku?: string;
  brand?: string;
  cat_code?: string;
  sell_line_note?: string;
}

export interface ReceiptData {
  logo?: string;
  header_text?: string;
  invoice_heading?: string;
  display_name?: string;
  address?: string;
  phone?: string;
  invoice_no_prefix?: string;
  invoice_no?: string;
  date_label?: string;
  invoice_date?: string;
  customer_label?: string;
  customer_info?: string;
  client_id_label?: string;
  client_id?: string;
  table_qty_label?: string;
  table_product_label?: string;
  table_unit_price_label?: string;
  table_subtotal_label?: string;
  lines?: ReceiptLine[];
  subtotal_label?: string;
  subtotal?: string;
  discount_label?: string;
  discount?: string | number;
  tax_label?: string;
  tax?: string | number;
  total_label?: string;
  total?: string;
  tax_label1?: string; tax_info1?: string;
  tax_label2?: string; tax_info2?: string;
  footer_text?: string;
  barcode?: string;
  cash_drawer?: boolean;
}

type BridgeMsg = { id?: string; type: string; ok?: boolean; error?: string;[k: string]: any };

@Injectable({ providedIn: 'root' })
export class BridgePrintService {
  private url = 'ws://127.0.0.1:6441';

  private ws?: WebSocket;
  private _open$ = new BehaviorSubject<boolean>(false);
  readonly open$ = this._open$.asObservable();

  private incoming$ = new Subject<BridgeMsg>();
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();

  private defaultTimeoutMs = 15000;

  constructor(private zone: NgZone) { }

  // ---------------------------
  // Conexión
  // ---------------------------
  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) return resolve();

      try {
        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => this.zone.run(() => {
          this._open$.next(true);
          resolve();
        });

        ws.onclose = () => this.zone.run(() => {
          this._open$.next(false);
        });

        ws.onerror = () => this.zone.run(() => {
          reject(new Error('No se pudo conectar al bridge en ' + this.url));
        });

        ws.onmessage = (ev) => {
          this.zone.run(() => {
            let msg: BridgeMsg | null = null;
            try { msg = JSON.parse(ev.data); } catch { /* a veces texto plano */ }
            if (!msg) return;

            if (msg.id && this.pending.has(msg.id)) {
              const p = this.pending.get(msg.id)!;
              this.pending.delete(msg.id);
              if (msg['ok'] === false) p.reject(new Error(msg['error'] || 'Bridge error'));
              else p.resolve(msg as any);
            }

            // emitimos SIEMPRE lo que llega (con o sin id) para logs/fallbacks
            this.incoming$.next(msg);
          });
        };

      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch { }
      this.ws = undefined;
      this._open$.next(false);
    }
  }

  private ensureOpen = async () => {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
  };

  private nextId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  /** Envía mensaje y espera respuesta por `id` con timeout. */
  private async sendAndWait<T = any>(
    type: string,
    payload: Record<string, any> = {},
    timeoutMs = this.defaultTimeoutMs
  ): Promise<T> {
    await this.ensureOpen();
    const id = this.nextId();

    const p = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        // timeout: limpia y rechaza
        if (this.pending.has(id)) this.pending.delete(id);
        reject(new Error('Timeout esperando respuesta del bridge'));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v: any) => {
          clearTimeout(timer);
          resolve(v as T);
        },
        reject: (e: any) => {
          clearTimeout(timer);
          reject(e);
        }
      });
    });

    this.ws!.send(JSON.stringify({ id, type, ...payload }));
    return p;
  }


  /** Envía sin esperar respuesta. */
  private async fireAndForget(type: string, payload: Record<string, any> = {}) {
    await this.ensureOpen();
    this.ws!.send(JSON.stringify({ type, ...payload }));
  }

  // ---------------------------
  // API pública
  // ---------------------------
  async listPrinters(): Promise<string[]> {
    // Preferimos respuesta correlacionada:
    try {
      const resp = await this.sendAndWait<{ printers: string[] }>('list-printers');
      return resp?.printers ?? [];
    } catch {
      // Fallback: notificación sin id
      await this.ensureOpen();
      const once = firstValueFrom(
        this.incoming$.pipe(
          filter(m => m.type === 'list-printers'),
          take(1),
          timeout({ each: this.defaultTimeoutMs })
        )
      );
      this.ws!.send(JSON.stringify({ type: 'list-printers' }));
      const msg = await once;
      return (msg?.['printers'] as string[]) || [];
    }
  }

  async printZpl(
    zplOrBase64: string,
    opts?: { ip?: string; port?: number; printer?: string; isBase64?: boolean }
  ) {
    await this.fireAndForget('print-zpl', {
      ...(opts?.isBase64 ? { zpl_base64: zplOrBase64 } : { zpl: zplOrBase64 }),
      ...(opts?.ip ? { ip: opts.ip } : {}),
      ...(opts?.port ? { port: opts.port } : {}),
      ...(opts?.printer ? { printer: opts.printer } : {}),
    });
  }

  async printPdfBase64(pdfBase64: string, printer?: string) {
    await this.fireAndForget('print-pdf', {
      pdf_base64: pdfBase64,
      ...(printer ? { printer } : {}),
    });
  }

  async printReceiptEscpos(data: ReceiptData, printer_config?: PrinterConfig) {
    await this.fireAndForget('print-receipt', { data, ...(printer_config ? { printer_config } : {}) });
  }

  async openCashDrawer(printer_config?: PrinterConfig) {
    await this.fireAndForget('open-cashdrawer', { ...(printer_config ? { printer_config } : {}) });
  }

  async checkStatus(): Promise<boolean> {
    try {
      await this.ensureOpen();
      // Si el socket está abierto, ya es buena señal:
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Intento rápido de ack; si falla, igualmente devolvemos true
        try {
          const r = await this.sendAndWait<{ ok?: boolean }>('check-status', {}, 1200);
          return r?.ok !== false; // true si ok es true/undefined
        } catch {
          // Muchos bridges no responden; consideramos OK si hay socket abierto
          this.ws!.send(JSON.stringify({ type: 'check-status' })); // fire&forget
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }


  setDefaultPrinter(name: string) {
    localStorage.setItem('label_printer', name);
  }
  getDefaultPrinter(): string | undefined {
    return localStorage.getItem('label_printer') || undefined;
  }


}
