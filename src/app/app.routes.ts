// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.page').then(m => m.LoginPage)
  },
  // todas las demás rutas van bajo el guard:
  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      {
      path: '',
      loadComponent: () => import('./pages/home-redirect/home-redirect.page').then(m => m.HomeRedirectPage)
    },
      {
        path: 'folder/:id',
        loadComponent: () =>
          import('./folder/folder.page').then(m => m.FolderPage)
      },
      {
        path: 'logistica',
        loadComponent: () =>
          import('./pages/logistica/logistica.page').then(m => m.LogisticaPage)
      },
      {
        path: 'lotes',
        loadComponent: () =>
          import('./pages/Mercancias/lotes.page').then(m => m.LotesPage)
      },
      {
        path: 'trazabilidad',
        loadComponent: () =>
          import('./pages/trazabilidad/trazabilidad.page').then(m => m.TrazabilidadPage)
      },
      {
        path: 'estadisticas',
        loadComponent: () =>
          import('./pages/estadisticas/estadisticas.page').then(m => m.EstadisticasPage)
      },
      {
        path: 'ajustes',
        loadComponent: () =>
          import('./pages/ajustes/ajustes.page').then(m => m.AjustesPage)
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./pages/locations/locations.page').then(m => m.LocationsPage)
      },
      {
        path: 'productos',
        loadComponent: () => import('./pages/products/products.page').then(m => m.ProductsPage)
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./pages/pedidos/pedidos.page').then(m => m.PedidosPage)
      },
      {
        path: 'entradas',
        loadComponent: () => import('./pages/entradas/entradas.page').then(m => m.EntradasPage)
      },
      {
        path: 'facturacion',
        loadComponent: () => import('./pages/facturacion/facturacion.page').then(m => m.FacturacionPage)
      },
      {
        path: 'packgo',
        loadComponent: () => import('./pages/packgo/packgo.page').then(m => m.PackgoPage)
      },
      {
        path: 'tickets',
        loadComponent: () => import('./pages/tickets/tickets.page').then(m => m.TicketsPage)
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.page').then(m => m.UsersPage)
      }
    ]
  },
  // fallback
  {
    path: '**',
    redirectTo: 'login'
  },









];
