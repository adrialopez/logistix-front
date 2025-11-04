import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { MaterialModule } from 'src/app/material.module';
import { StatsService } from 'src/app/shared/services/stats.service';
import { TranslateModule } from '@ngx-translate/core';
import { AppTicketlistComponent } from 'src/app/pages/tickets/tickets.component';
import { TicketService } from 'src/app/shared/services/ticket.service';
import { PedidosPage } from 'src/app/pages/pedidos/pedidos.page';
import { LotesPage } from '../Mercancias/lotes.page';
import { EntradasPage } from '../entradas/entradas.page';
import {
  mostvisitChart,
  pageimpChart,
  mediaPedidoBarChart,
  projectsChart,
  pedidosUnidadesChart,
  distribucionTransportistaChart,
  kpiControlChart
} from './charts.logistica';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-logistica',
  templateUrl: './logistica.page.html',
  styleUrls: ['./logistica.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    MaterialModule,
    TranslateModule,
    AppTicketlistComponent,
    EntradasPage,
    PedidosPage,
    LotesPage,
    NgApexchartsModule,
    TablerIconsModule
  ]
})
export class LogisticaPage implements OnInit {
  topcards: any[] = [];

  mostvisitChart = mostvisitChart;
  pageimpChart = pageimpChart;
  mediaPedidoBarChart = mediaPedidoBarChart;
  projectsChart = projectsChart;
  pedidosUnidadesChart = pedidosUnidadesChart;
  distribucionTransportistaChart = distribucionTransportistaChart;
  kpiControlChart = kpiControlChart;

  statsLogistica = {
    por_preparar: 0,
    preparados_hoy: 0,
    en_transito: 0,
    entradas_pendientes: 0,
    entradas_validadas_hoy: 0
  };

  months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  selectedMonth = this.months[new Date().getMonth()];

  showPudo = true;
  showDomicilio = true;
  showOtro = true;

  donutLabels = [
    { name: 'Profit', value: '$23,450', color: '#5D87FF' },
    { name: 'Expance', value: '$23,450', color: '#49BEFF' }
  ];

  selectedDonutIndex: number | null = null;
  @ViewChild('donutChart') donutChart?: ChartComponent;

  productoMasVendido: {
    image: any; producto: string, total_vendido: number, vendidos_hoy: number
  } = { producto: '', total_vendido: 0, vendidos_hoy: 0, image: '' };
  rankingProductos: { producto: string, total_vendido: number }[] = [];
  selectedProducto: { producto: string, total_vendido: number } | null = null;

  mostrarRanking = false;

  mediaPedidosMes: number = 0;
  mediaPedidosDias: number[] = [];
  mediaPedidosLabels: string[] = [];
  ticketMedioMes: number = 0;
  ticketMedioDias: number[] = [];

  kpiTotal: number = 0;
  kpiSelected = 0;

  showKpiSegment = [true, true, true];

  filteredTransportistaSeries: any[] = [];
  filteredTransportistaColors: string[] = [];

  constructor(
    private statsService: StatsService,
    private ticketService: TicketService,
  ) {
    // Topcards antiguas (si las quieres mantener)
    statsService.getStats().subscribe(responsedata => {
      this.topcards = [
        { id: 1, color: 'primary', img: '/assets/images/svgs/ent_reg.svg', title: 'entradas_registradas', subtitle: responsedata.ent_reg, textColor: '#000000', border: '1px solid #BDBDBD' },
        { id: 2, color: 'warning', img: '/assets/images/svgs/ent_pro.svg', title: 'entradas_procesadas', subtitle: responsedata.ent_pro, bgColor: '#E3F2FD', textColor: '#000000', border: '1px solid #BDBDBD' },
        { id: 3, color: 'secondary', img: '/assets/images/svgs/ped_cre.svg', title: 'pedidos_creados', subtitle: responsedata.ped_cre, bgColor: '#E3F2FD', textColor: '#000000', border: '1px solid #BDBDBD' },
        { id: 4, color: 'error', img: '/assets/images/svgs/ped_prep.svg', title: 'pedidos_preparados', subtitle: responsedata.ped_pre, bgColor: '#E3F2FD', textColor: '#000000', border: '1px solid #BDBDBD' },
        { id: 5, color: 'success', img: '/assets/images/svgs/ped_env.svg', title: 'pedidos_enviados', subtitle: responsedata.ped_env, bgColor: '#E3F2FD', textColor: '#000000', border: '1px solid #BDBDBD' },
      ];
    });
  }

  ngOnInit() {
    this.loadLogisticaStats();                  // básica (se queda)
    this.loadLogisticaBundle(this.selectedMonth); // TODO lo demás en una
  }

  // ======= NUEVO ÚNICO MÉTODO =======
  loadLogisticaBundle(mes: string) {
    const month = this.months.indexOf(mes) + 1;
    const year = new Date().getFullYear();

    this.statsService.getLogisticaBundle(month, year).subscribe(b => {
      // Transportista (PUDO/DOMICILIO/OTRO)
      this.mostvisitChart.series = [{ name: 'Transportista', data: b.transportista.data }];
      this.mostvisitChart.xaxis = { ...this.mostvisitChart.xaxis, categories: b.transportista.labels };
      this.updateTransportistaChart();

      // Ranking productos (top 10) y selección
      this.rankingProductos = b.rankingProductos;
      this.selectedProducto = null;

      // Producto más vendido + vendidos hoy
      this.productoMasVendido = b.productoMasVendido || { producto: '', total_vendido: 0, vendidos_hoy: 0 };

      // Media KPIs del mes (pedidos/día, ticket por día)
      this.mediaPedidosMes = b.mediaKPIsMes.mediaPedidos;
      this.mediaPedidosDias = b.mediaKPIsMes.pedidosPorDia;
      this.mediaPedidosLabels = b.mediaKPIsMes.dias.map((d: number) => d.toString());

      // → Media pedidos por semana
      const semanasPedidos: number[][] = [[], [], [], [], []];
      b.mediaKPIsMes.dias.forEach((dia: number, idx: number) => {
        const semanaIdx = Math.floor((dia - 1) / 7);
        semanasPedidos[semanaIdx].push(b.mediaKPIsMes.pedidosPorDia[idx]);
      });
      const mediaPorSemana = semanasPedidos.map(arr =>
        arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0
      );
      const semanasLabels = semanasPedidos.map((_, idx) => ` ${idx + 1}`);
      this.mediaPedidoBarChart.series = [{ name: 'Media pedido', data: mediaPorSemana }];
      this.mediaPedidoBarChart.xaxis = { ...this.mediaPedidoBarChart.xaxis, categories: semanasLabels };

      // → Ticket medio (por semana)
      const semanasTicket: number[][] = [[], [], [], [], []];
      b.mediaKPIsMes.dias.forEach((dia: number, idx: number) => {
        const semanaIdx = Math.floor((dia - 1) / 7);
        semanasTicket[semanaIdx].push(b.mediaKPIsMes.ticketPorDia[idx]);
      });
      const ticketPorSemana = semanasTicket.map(arr =>
        arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0
      );
      this.ticketMedioMes = b.mediaKPIsMes.ticketMedio;
      this.ticketMedioDias = ticketPorSemana;
      this.projectsChart.series = [{ name: 'Ticket', data: this.ticketMedioDias }];

      // KPI control
      this.kpiTotal = Number(b.kpiControl.total || 0);
      this.kpiControlChart.series = [b.kpiControl.entregados || 0, b.kpiControl.enTransito || 0, b.kpiControl.otros || 0];

      // Distribución transportista
      this.distribucionTransportistaChart.series = b.distribucionTransportista.data || [];
      this.distribucionTransportistaChart.labels = b.distribucionTransportista.labels || [];

      // Pedidos / Unidades por mes (año actual)
      this.pedidosUnidadesChart.series = [
        { name: 'Pedidos', data: b.pedidosUnidadesMes.pedidos || [] },
        { name: 'Unidades', data: b.pedidosUnidadesMes.unidades || [] }
      ];
    });
  }
  // ======= FIN NUEVO MÉTODO =======

  // Se mantiene: stats “básicas”
  loadLogisticaStats() {
    this.statsService.getStatsLogistica().subscribe((data: any) => {
      this.statsLogistica.por_preparar = data.por_preparar;
      this.statsLogistica.preparados_hoy = data.preparados_hoy;
      this.statsLogistica.en_transito = data.en_transito;
      this.statsLogistica.entradas_pendientes = data.entradas_pendientes;
      this.statsLogistica.entradas_validadas_hoy = data.entradas_validadas_hoy;
    });
  }

  // Cambio de mes → recarga solo el bundle
  onMonthChange(month: string) {
    this.selectedMonth = month;
    this.loadLogisticaBundle(month);
  }

  // Toggles de barras (PUDO/DOMICILIO/OTRO)
  toggleBar(bar: 'PUDO' | 'DOMICILIO' | 'OTRO') {
    if (bar === 'PUDO') this.showPudo = !this.showPudo;
    if (bar === 'DOMICILIO') this.showDomicilio = !this.showDomicilio;
    if (bar === 'OTRO') this.showOtro = !this.showOtro;
    this.updateTransportistaChart();
  }

  updateTransportistaChart() {
    const categories = [...(this.mostvisitChart.xaxis.categories || [])];
    const data = [...(this.mostvisitChart.series?.[0]?.data || [])];

    const filteredCategories: string[] = [];
    const filteredData: number[] = [];
    categories.forEach((cat: string, idx: number) => {
      if (
        (cat === 'PUDO' && this.showPudo) ||
        (cat === 'DOMICILIO' && this.showDomicilio) ||
        (cat === 'OTRO' && this.showOtro)
      ) {
        filteredCategories.push(cat);
        filteredData.push(data[idx]);
      }
    });

    this.filteredTransportistaSeries = [{ name: 'Transportista', data: [...filteredData] }];
    this.filteredTransportistaColors = filteredCategories.map(cat =>
      cat === 'PUDO' ? '#5D87FF'
        : cat === 'DOMICILIO' ? '#49BEFF'
          : cat === 'OTRO' ? '#FFB300'
            : '#CCCCCC'
    );
    this.mostvisitChart.xaxis = { ...this.mostvisitChart.xaxis, categories: [...filteredCategories] };
  }

  // Utilidades varias que ya usabas
  reloadTickets(): void { this.ticketService.refreshTickets?.(); }

  get filteredKpiSeries() { return this.kpiControlChart.series.map((v, idx) => this.showKpiSegment[idx] ? v : 0); }
  get filteredKpiColors() { return this.kpiControlChart.colors; }
  get filteredKpiLabels() { return this.kpiControlChart.labels; }
  get filteredKpiTotal(): number { return this.filteredKpiSeries.reduce((acc, val) => acc + val, 0); }

  get productoMasVendidoSube(): boolean { return (this.rankingProductos[0]?.total_vendido || 0) > 2; }
  get productoMasVendidoHoyVerde(): boolean { return this.productoMasVendido.vendidos_hoy > 1; }
  get mediaPedidoSube(): boolean {
    const arr = this.mediaPedidosDias;
    if (arr.length < 2) return true;
    return arr[arr.length - 1] >= arr[arr.length - 2];
  }

  get rankingSeries() { return [{ name: 'Unidades', data: this.rankingProductos.map(p => p.total_vendido) }]; }
  get rankingCategories() { return this.rankingProductos.map(p => p.producto); }

  onBarClick(event: any) {
    const index = event?.dataPointIndex;
    if (index !== undefined && this.rankingProductos[index]) {
      this.selectedProducto = this.rankingProductos[index];
    }
  }

  abrirRankingProductos() { this.mostrarRanking = !this.mostrarRanking; }

  toggleKpiSegment(idx: number) { this.showKpiSegment[idx] = !this.showKpiSegment[idx]; }
}
