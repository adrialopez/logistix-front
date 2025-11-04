import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AppTicketlistComponent } from './tickets.component';
import { IonicModule } from "@ionic/angular";
import { MatPaginatorIntl } from '@angular/material/paginator';
@Component({
  selector: 'app-tickets',
  templateUrl: './tickets.page.html',
  styleUrls: ['./tickets.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, AppTicketlistComponent, IonHeader, IonToolbar, IonTitle],
  providers: [
      { provide: MatPaginatorIntl, useValue: getPaginatorIntl() }
    ]
})
export class TicketsPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}

export function getPaginatorIntl() {
  const paginatorIntl = new MatPaginatorIntl();

  paginatorIntl.itemsPerPageLabel = 'Items por página:';
  paginatorIntl.nextPageLabel = 'Siguiente página';
  paginatorIntl.previousPageLabel = 'Página anterior';
  paginatorIntl.firstPageLabel = 'Primera página';
  paginatorIntl.lastPageLabel = 'Última página';

  return paginatorIntl;
}
