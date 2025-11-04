// --- status-mapper.ts ---
// Núcleo simple para unificar estados a 4 canónicos y ayudar a pintarlos en UI.

export type Canon = 'SIN_PREPARAR' | 'PREPARADO' | 'FINALIZADO' | 'CANCELADO';

const MAP_SIN_PREPARAR = [
  'unfulfilled','processing','on hold','pending','pending payment',
  'to pack','to_prepare','sin preparar','por preparar','created'
];
const MAP_PREPARADO = [
  'prepared',
  'ready to send',
  'at sorting centre',
  'fulfilled',
  'shipped',
  'enviado',
  'listo',
  'announced',
  'awaiting customer pickup',
  'delivery attempt failed',
  'parcel en route',
  'shipment picked up by driver',
  'en route to sorting center',
  'sorted',
  'driver en route',
  'delivery delayed',
  'not sorted',
  'being sorted',
  'announced: not collected',
  'error collecting',
  'unable to deliver',
  'no label',
  'being announced',
  'submitting cancellation request',
  'cancellation requested',
  'cancelled upstream',
  'parcel cancellation failed.',
  'announcement failed',
  'at customs',
  'refused by recipient',
  'returned to sender',
  'delivery method changed',
  'delivery date changed',
  'delivery address changed',
  'address invalid'
];

const MAP_FINALIZADO = [
  'complete','completed','delivered','finalizado','entregado'
];
const MAP_CANCELADO = [
  'cancelled','canceled','refunded','failed','anulado','devuelto'
];

export function isEditable(c: Canon | undefined): boolean {
  return c === 'SIN_PREPARAR';
}

export const CANON_LABEL: Record<Canon, string> = {
  SIN_PREPARAR: 'sin_preparar',
  PREPARADO: 'preparado',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado',
};

const BADGE_BY_CANON: Record<Canon, string> = {
  SIN_PREPARAR: 'bg-light-warning',
  PREPARADO:   'bg-light-success',
  FINALIZADO:  'bg-light-primary',
  CANCELADO:   'bg-light-error',
};

function norm(s: any): string {
  return (s ?? '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toCanonicalStatus(raw: any): Canon {
  const n = norm(raw);
  if (!n) return 'SIN_PREPARAR';
  if (MAP_SIN_PREPARAR.includes(n)) return 'SIN_PREPARAR';
  if (MAP_PREPARADO.includes(n))   return 'PREPARADO';
  if (MAP_FINALIZADO.includes(n))  return 'FINALIZADO';
  if (MAP_CANCELADO.includes(n))   return 'CANCELADO';

  // heurística por si vienen adornados: "processing - picking", etc.
  if (/unful|pend|process|hold|pack|prepar/.test(n)) return 'SIN_PREPARAR';
  if (/fulfill|ready|sorting|shipp|enviado|listo|preparado/.test(n)) return 'PREPARADO';
  if (/complete|deliver|finaliz|entreg/.test(n)) return 'FINALIZADO';
  if (/cancel|refund|fail|anul|devol/.test(n)) return 'CANCELADO';
  return 'SIN_PREPARAR';
}

// Añade _canonicalStatus y _canonicalLabel a cada pedido (no toca nada más)
export function applyCanonical<T extends { status?: any; state?: any }>(
  orders: T[]
): (T & { _canonicalStatus: Canon; _canonicalLabel: string })[] {
  return (orders || []).map((o: any) => {
    const c = toCanonicalStatus(o.status ?? o.state ?? '');
    o._canonicalStatus = c;
    o._canonicalLabel  = CANON_LABEL[c];
    return o;
  });
}

// Clase CSS para el chip según canónico
export function badgeClass(c: Canon): string {
  return BADGE_BY_CANON[c];
}

// Color del timeline del historial (mantiene el caso "paid/authorized")
export function colorForHistory(raw: any): 'success' | 'error' | 'warning' | 'accent' | 'primary' {
  const n = norm(raw);
  if (/paid|authorized/.test(n)) return 'accent';
  const c = toCanonicalStatus(raw);
  if (c === 'SIN_PREPARAR') return 'warning';
  if (c === 'PREPARADO')    return 'success';
  if (c === 'FINALIZADO')   return 'primary';
  return 'error'; // CANCELADO
}

// Contador rápido por canónico
export function countByStatus(orders: any[], c: Canon): number {
  return (orders || []).filter(o => o?._canonicalStatus === c).length;
}
