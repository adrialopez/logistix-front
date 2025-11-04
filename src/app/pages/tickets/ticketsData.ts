import {TicketElement} from 'src/app/pages/tickets/ticket'

export const tickets: TicketElement[] = [ 
  {
    id: 1,
    ticket_type_id: 1,
    Imgsrc: '/assets/images/tickets/ticket-1.jpg',
    clienteId: 1,
    Asignado: 'Alice',
    estado: 'pendiente',
    prioridad: 'alta',
    comentario: 'Problema con el sistema de inventario',
    fecha: '',
  }
  ,
  {
    id: 2,
    ticket_type_id: 2,
    Imgsrc: '/assets/images/tickets/ticket-2.jpg',
    clienteId: 2,
    Asignado: 'Bob',
    estado: 'en_proceso',
    prioridad: 'media',
    comentario: 'Solicitud de actualización de software',
    fecha: '',
  },
  {
    id: 3,
    ticket_type_id: 3,
    Imgsrc: '/assets/images/tickets/ticket-3.jpg',
    clienteId: 3,
    Asignado: 'Charlie',
    estado: 'resuelto',
    prioridad: 'baja',
    comentario: 'Error en la aplicación móvil',
    fecha: '',
  },
]