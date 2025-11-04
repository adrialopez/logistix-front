import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { TicketElement, FieldValue } from '../../pages/tickets/ticket';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';

export interface TicketType {
  id: number;
  nombre: string;
  descripcion: string;
  accion_sistema?: string;
  fields: TicketField[];
}

export interface TicketComment {
  id?: number;
  autor?: string;
  mensaje: string;
  created_at: string; // ISO
}

export interface TicketField {
  id: number;
  ticket_type_id: number;
  nombre: string;
  tipo: 'text' | 'number' | 'date' | 'select' | 'textarea';
  es_requerido: boolean;
  orden: number;
}

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private base = environment.apiUrl;
  private storeId = '';

  // Ajusta según tu configuración
  private ticketsSubject = new BehaviorSubject<TicketElement[]>([]);

  constructor(private http: HttpClient,
    private auth: AuthService,
    private shopSvc: ShopService) {
    this.shopSvc.shop$.subscribe(shop => {
      this.storeId = shop;
    });
    this.loadTicketsFromAPI();
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return token
      ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
      : new HttpHeaders();
  }


  // Observable para que los componentes se suscriban a cambios
  get tickets$(): TicketElement[] {
    return this.ticketsSubject.value;
  }

  get ticketsObservable(): Observable<TicketElement[]> {
    return this.ticketsSubject.asObservable();
  }

  // Cargar tickets desde la API
  private loadTicketsFromAPI(): void {
    let params = new HttpParams().set('store_id', this.storeId);

    this.http.get<TicketElement[]>(`${this.base}/tickets`,
      {
        params,
        headers: this.authHeaders()
      }).subscribe({
        next: (tickets) => {
          // Mapear estados de backend a frontend si es necesario
          const mappedTickets = tickets.map(ticket => ({
            ...ticket,
            estado: this.mapBackendStatusToFrontend(ticket.estado),
            Asignado: ticket.Asignado || 'Sin asignar',
            created_at: ticket.created_at,
            comentario: ticket.comentarios_internos
          }));
          this.ticketsSubject.next(mappedTickets);
        },
        error: (error) => {
          console.error('Error cargando tickets:', error);
        }
      });
  }

  // Obtener todos los tipos de ticket con sus campos
  getAllTicketTypes(): Observable<TicketType[]> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<TicketType[]>(`${this.base}/tickets/types`,
      {
        params,
        headers: this.authHeaders()
      });
  }

  // Obtener un ticket específico por ID
  getTicketById(id: number): Observable<TicketElement> {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<TicketElement>(`${this.base}/tickets/${id}`,
      {
        params,
        headers: this.authHeaders()
      });
  }

  // Crear un nuevo ticket
  addTicket(ticket: TicketElement): void {
    // Mapear ticket de frontend a formato backend
    const backendTicket = {
      ticketTypeId: ticket.ticket_type_id,
      clienteId: ticket.clienteId,
      estado: this.mapFrontendStatusToBackend(ticket.estado),
      prioridad: ticket.prioridad,
      comentariosInternos: ticket.comentarios_internos,
      resolucion: ticket.resolucion,
      fieldValues: ticket.fieldValues || []
    };

    let params = new HttpParams().set('store_id', this.storeId);
    this.http.post<TicketElement>(`${this.base}/tickets`, backendTicket,
      {
        params,
        headers: this.authHeaders()
      }).subscribe({
        next: (newTicket) => {
          // Mapear respuesta de backend a frontend
          const frontendTicket = {
            ...newTicket,
            estado: this.mapBackendStatusToFrontend(newTicket.estado),
            Asignado: newTicket.Asignado || 'Sin asignar',
            created_at: newTicket.created_at,
            comentario: newTicket.comentarios_internos,
            Imgsrc: ticket.Imgsrc || '/assets/images/tickets/default-ticket.jpg'
          };

          const currentTickets = this.ticketsSubject.value;
          this.ticketsSubject.next([frontendTicket, ...currentTickets]);
        },
        error: (error) => {
          console.error('Error creando ticket:', error);
          throw error;
        }
      });
  }

  // Actualizar un ticket existente
  updateTicket(ticket: TicketElement): void {
    const backendTicket = {
      id: ticket.id,
      estado: this.mapFrontendStatusToBackend(ticket.estado),
      asignado: ticket.Asignado,
      prioridad: ticket.prioridad,
      comentariosInternos: ticket.comentarios_internos,
      resolucion: ticket.resolucion
    };

    let params = new HttpParams().set('store_id', this.storeId);
    this.http.put<any>(`${this.base}/tickets`, backendTicket,
      {
        params,
        headers: this.authHeaders()
      }).subscribe({
        next: (updatedFromApi) => {
          const mapped = {
            ...updatedFromApi,
            estado: this.mapBackendStatusToFrontend(updatedFromApi.estado),
            Asignado: updatedFromApi.Asignado || 'Sin asignar',
            created_at: updatedFromApi.created_at || updatedFromApi.created_at,
            comentario: updatedFromApi.comentarios_internos
          };
          const current = this.ticketsSubject.value;
          this.ticketsSubject.next(current.map(t => t.id === mapped.id ? mapped : t));
        },
        error: (error) => {
          console.error('Error actualizando ticket:', error);
          throw error;
        }
      });
  }

  // Eliminar un ticket
  deleteTicket(id: number): void {
    let params = new HttpParams().set('store_id', this.storeId);
    this.http.delete(`${this.base}/tickets/${id}`,
      {
        params,
        headers: this.authHeaders()
      }).subscribe({
        next: () => {
          const currentTickets = this.ticketsSubject.value;
          const filteredTickets = currentTickets.filter(ticket => ticket.id !== id);
          this.ticketsSubject.next(filteredTickets);
        },
        error: (error) => {
          console.error('Error eliminando ticket:', error);
          // En caso de error, simular eliminación localmente
          const currentTickets = this.ticketsSubject.value;
          const filteredTickets = currentTickets.filter(ticket => ticket.id !== id);
          this.ticketsSubject.next(filteredTickets);
        }
      });
  }

  // Mapear estados de backend a frontend
  private mapBackendStatusToFrontend(backendStatus: string): 'pendiente' | 'en_proceso' | 'resuelto' {
    switch (backendStatus) {
      case 'pendiente': return 'pendiente';
      case 'en_proceso': return 'en_proceso';
      case 'resuelto': return 'resuelto';
      default: return 'pendiente';
    }
  }

  // Mapear estados de frontend a backend
  private mapFrontendStatusToBackend(frontendStatus: string): 'pendiente' | 'en_proceso' | 'resuelto' {
    switch (frontendStatus) {
      case 'pendiente': return 'pendiente';
      case 'en_proceso': return 'en_proceso';
      case 'resuelto': return 'resuelto';
      default: return 'pendiente';
    }
  }

  // Recargar tickets desde la API
  refreshTickets(): void {
    this.loadTicketsFromAPI();
  }

  getComments(ticketId: number) {
    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.get<TicketComment[]>(
      `${this.base}/tickets/${ticketId}/comments`,
      { params, headers: this.authHeaders() }
    );
  }

  addComment(ticketId: number, mensaje: string) {
    let userEmail = localStorage.getItem('email') || sessionStorage.getItem('email');

    let params = new HttpParams().set('store_id', this.storeId);
    return this.http.post<TicketComment>(
      `${this.base}/tickets/${ticketId}/comments`,
      { mensaje: mensaje,
        email: userEmail
       },
      { params, headers: this.authHeaders() }
    );
  }
}