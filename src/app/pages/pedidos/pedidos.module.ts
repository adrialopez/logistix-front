import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PedidosPage } from './pedidos.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule // <-- Esto es imprescindible para los componentes ion-*
  ],
  declarations: [PedidosPage]
})
export class PedidosPageModule {}
