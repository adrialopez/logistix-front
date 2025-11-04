import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';

type BoxKey = 'S' | 'M' | 'L';

export interface PackgoConfirmData {
  orderNumber?: string;
  address?: string;
  boxQty: Record<BoxKey, number>;
  total: number;
}

@Component({
  standalone: true,
  selector: 'app-packgo-confirm-dialog',
  imports: [CommonModule, MatDialogModule, MaterialModule],
  template: `
  <div class="pgd-header">
    <h3>Confirmar etiquetas</h3>
    <button mat-icon-button (click)="close()">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <mat-dialog-content class="pgd-content">
    <div class="pgd-block">
      <div class="pgd-row">
        <div class="pgd-col">
          <div class="pgd-label">Pedido</div>
          <div class="pgd-value">{{ data.orderNumber || '—' }}</div>
        </div>
        <div class="pgd-col total">
          <div class="pgd-label">Total bultos</div>
          <div class="pgd-total">{{ data.total }}</div>
        </div>
      </div>

      <div class="pgd-row boxes">
        <div class="pgd-col">
          <div class="pgd-label">Cajas</div>
          <div class="chips">
            <span class="chip" [class.muted]="!data.boxQty.S">S <b>{{ data.boxQty.S }}</b></span>
            <span class="chip" [class.muted]="!data.boxQty.M">M <b>{{ data.boxQty.M }}</b></span>
            <span class="chip" [class.muted]="!data.boxQty.L">L <b>{{ data.boxQty.L }}</b></span>
          </div>
        </div>
      </div>

      <div class="pgd-row">
        <div class="pgd-col">
          <div class="pgd-label">Dirección de envío</div>
          <div class="pgd-address">{{ data.address || '—' }}</div>
        </div>
      </div>
    </div>

    <mat-card class="warn">
      <mat-card-content>
        <mat-icon>local_shipping</mat-icon>
        <div>
          <div class="title">Se van a crear las etiquetas de envío</div>
          <div class="sub">
            Generaremos {{ data.total }} etiqueta(s) según las cajas indicadas arriba. ¿Quieres confirmar?
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  </mat-dialog-content>

  <mat-dialog-actions align="end" class="pgd-actions">
    <button mat-stroked-button style="var(--mdc-outlined-button-outline-color, var(--mat-sys-outline));" (click)="close()">Cancelar</button>
    <button mat-flat-button color="primary" (click)="confirm()" [disabled]="data.total <= 0">
      Imprimir etiquetas
    </button>
  </mat-dialog-actions>
  `,
  styles: [`
  .pgd-header{
    display:flex; align-items:center; justify-content:space-between;
    padding:12px 16px 8px 16px;
  }
  .pgd-header h3{ margin:0; font-weight:700; }
  .pgd-content{ padding: 0 16px 8px 16px; }
  .pgd-block{
    border:1px solid rgba(0,0,0,.06); border-radius:12px; padding:12px;
    background:#fff; margin-bottom:12px;
  }
  .pgd-row{ display:flex; gap:16px; align-items:flex-start; margin-bottom:8px; }
  .pgd-col{ flex:1 1 0; }
  .pgd-col.total{ max-width:180px; text-align:center; }
  .pgd-label{ font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:.02em; margin-bottom:4px; }
  .pgd-value{ font-weight:600; }
  .pgd-total{
    font-size:28px; font-weight:800; line-height:1;
    padding:10px 0; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px;
  }
  .chips{ display:flex; gap:8px; }
  .chip{
    border:1px solid rgba(0,0,0,.08); border-radius:999px; padding:6px 10px;
    font-weight:600; background:#f8fafc;
  }
  .chip b{ margin-left:6px; }
  .chip.muted{ opacity:.45; }
  .pgd-address{ white-space:normal; word-break:break-word; }
  mat-card.warn mat-card-content{
    display:flex; gap:12px; align-items:flex-start;
  }
  mat-card.warn mat-card-content mat-icon{ color:#f59e0b; }
  .title{ font-weight:700; }
  .sub{ font-size:13px; color:#6b7280; }
  .pgd-actions{ padding: 0 16px 16px 16px; }
  `]
})
export class PackgoConfirmDialogComponent {
  constructor(
    public ref: MatDialogRef<PackgoConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PackgoConfirmData
  ) {}

  close() { this.ref.close('cancel'); }
  confirm() { this.ref.close('confirm'); }
}
