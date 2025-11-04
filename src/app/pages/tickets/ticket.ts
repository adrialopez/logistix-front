export interface FieldValue {
  ticket_field_id: number;
  valor: string;
}

export interface TicketElement {
  id: number;   // ID del ticket
  ticket_type_id: number; // ID del tipo de ticket
  Imgsrc: string;
  clienteId: number; // Requerido
  title?: string; // Título del ticket
  Asignado?: string; //'asignado_a'
  estado: 'pendiente' | 'en_proceso' | 'resuelto'; // Estado del ticket
  prioridad: 'alta' | 'media' | 'baja';
  comentarios_internos?: string; // comentarios_internos
  resolucion?: string | undefined; //'resolucion' (opcional en create)
  created_at: string; // fecha_creacion
  fecha_resolucion?: string; // fecha_resolucion (opcional en create)
  // Array de valores de campos dinámicos
  fieldValues?: FieldValue[];
}