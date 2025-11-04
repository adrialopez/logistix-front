import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  Inject,
  OnDestroy,
  Input
} from '@angular/core';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TicketService, TicketType, TicketField, TicketComment } from 'src/app/shared/services/ticket.service';
import { TicketElement, FieldValue } from 'src/app/pages/tickets/ticket';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/shared/services/auth.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ticket-list',
  templateUrl: './tickets.component.html',
  imports: [MaterialModule, CommonModule, TablerIconsModule, TranslateModule, RouterModule]
})
export class AppTicketlistComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatTable, { static: true }) table!: MatTable<any>;
  @ViewChild(MatPaginator, { static: false }) paginator!: MatPaginator;

  searchText: string = '';
  totalCount = 0;
  Closed = 0;
  Inprogress = 0;
  Open = 0;

  @Input() compact: boolean = false; // <-- nuevo
  @Input() showStats: boolean = true; // <-- nuevo

  // ejemplo: columnas por defecto
  displayedColumns: string[] = ['id', 'title', 'status', 'prioridad', 'date', 'action'];

  dataSource = new MatTableDataSource<TicketElement>([]);
  private ticketsSubscription?: Subscription;

  ticketsPorPagina = 20;
  selectedCategory: string = '';

  constructor(
    private ticketService: TicketService,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private translate: TranslateService // Añadido
  ) { }

  ngOnInit(): void {
    if (this.compact) {
      // columnas reducidas para vista compacta
      this.displayedColumns = ['id', 'title', 'status', 'date'];
    }
    this.loadTickets();
  }

  ngOnDestroy(): void {
    if (this.ticketsSubscription) {
      this.ticketsSubscription.unsubscribe();
    }
  }

  private loadTickets(): void {
    // Suscribirse a cambios en los tickets
    this.ticketsSubscription = this.ticketService.ticketsObservable.subscribe(
      tickets => {
        this.dataSource.data = tickets;
        this.updateCounts();
      }
    );
  }

  private updateCounts(): void {
    this.totalCount = this.dataSource.data.length;
    this.Open = this.countTicketsByStatus('en_proceso');
    this.Closed = this.countTicketsByStatus('resuelto');
    this.Inprogress = this.countTicketsByStatus('pendiente');
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngAfterViewChecked(): void {
    if (this.dataSource.paginator !== this.paginator && this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
  }

  onKeyup(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    this.applyFilter(input.value);
  }

  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  btnCategoryClick(val: string): number {
    
    this.selectedCategory = val;
    // Mapear valores de frontend
    let filterValue = '';
    switch (val) {
      case 'InProgress':
        filterValue = 'pendiente';
        break;
      case 'Open':
        filterValue = 'en_proceso';
        break;
      case 'Closed':
        filterValue = 'resuelto';
        break;
      default:
        filterValue = '';
    }

    this.dataSource.filter = filterValue.trim().toLowerCase();
    return this.dataSource.filteredData.length;
  }

  openDialog(action: string, ticket: TicketElement | any): void {
    const dialogRef = this.dialog.open(TicketDialogComponent, {
      data: { action, ticket },
      autoFocus: false,
      width: '1000px',
      maxWidth: 'none',
      maxHeight: '90vh'
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Refrescar la lista si se hizo algún cambio
        this.ticketService.refreshTickets();
      }
    });
  }

  countTicketsByStatus(status: string): number {
    return this.dataSource.data.filter(
      (ticket) => ticket.estado.toLowerCase() === status.toLowerCase()
    ).length;
  }

  refreshTickets(): void {
    this.ticketService.refreshTickets();
    this.snackBar.open(
      this.translate.instant('tickets_actualizados'),
      this.translate.instant('cerrar'),
      { duration: 2000 }
    );
  }
}
@Component({
  selector: 'app-dialog-content',
  templateUrl: 'ticket-dialog-content.html',
  imports: [
    MaterialModule,
    CommonModule,
    TablerIconsModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule
  ],
  styles: [`
    .message {
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 12px;
      word-break: break-word;
    }
    .msg-own {
      width: 80%;
      margin-left: 0;
      background: rgb(68, 183, 247, .15);
      border-color: #c8e6c9;
    }
    .msg-other {
      width: 80%;
      margin-left: 20%;
      background: rgb(93, 135, 255, .15);
      border-color: #e0e0e0;
    }
  `]
})
export class TicketDialogComponent implements OnInit {
  action: string;
  local_data: TicketElement;
  users: any[] = [];
  ticketTypes: TicketType[] = [];
  ticketFieldsForSelectedType: TicketField[] = [];
  selectedTicketType?: TicketType;
  fieldValues: { [fieldId: number]: any } = {};

  // Controles de formulario
  ticketTypeIdControl = new FormControl<number | null>({ value: null, disabled: false }, [Validators.required]);
  clienteIdControl   = new FormControl<number | null>({ value: null, disabled: false }, [Validators.required]);
  prioridadControl   = new FormControl<'alta' | 'media' | 'baja'>({ value: 'media', disabled: false }, [Validators.required]);
  estadoControl      = new FormControl<'pendiente' | 'en_proceso' | 'resuelto'>({ value: 'pendiente', disabled: false });
  comentariosControl = new FormControl<string>({ value: '', disabled: false });
  resolucionControl  = new FormControl<string>({ value: '', disabled: false });

  // Comentario adicional: OPCIONAL
  newComment = new FormControl<string>('', [Validators.maxLength(1000)]);

  // Sesión
  currentUserEmail: string | null = localStorage.getItem('email') || sessionStorage.getItem('email');

  // Historial
  comments: TicketComment[] = [];

  // Roles
  role: string | null = null;
  get isAdmin(): boolean { return this.role === 'admin'; }
  get isView(): boolean { return this.action === 'View'; }

  constructor(
    public dialogRef: MatDialogRef<TicketDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private ticketService: TicketService,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
    private auth: AuthService
  ) {
    this.action = data.action;
    this.local_data = { ...data.ticket };

    this.initializeFormControls();

    // Si es modo View, todo en lectura
    if (this.isView) this.setEditableState(false);

    // Suscripción a rol para permisos
    this.auth.role$?.subscribe(role => {
      this.role = role;
      this.applyRolePermissions();
    });
  }

  ngOnInit(): void {
    this.loadTicketTypes();
    this.loadComments();

    // Validación condicional de resolución
    this.estadoControl.valueChanges.subscribe(estado => {
      if (estado === 'resuelto') {
        this.resolucionControl.setValidators([Validators.required]);
      } else {
        this.resolucionControl.clearValidators();
      }
      this.resolucionControl.updateValueAndValidity({ emitEvent: false });
    });

    // Precarga de campos dinámicos si viene con valores
    if ((this.action === 'Update' || this.action === 'View') && this.local_data.fieldValues) {
      this.local_data.fieldValues.forEach(fv => {
        this.fieldValues[fv.ticket_field_id] = fv.valor;
      });
    }
  }

  /** Permisos por rol: si no es admin y no es Add, lectura */
  private applyRolePermissions(): void {
    const editable = (this.isAdmin && !this.isView) || this.action === 'Add';
    this.setEditableState(editable);
  }

  /** Habilita o deshabilita controles */
  private setEditableState(editable: boolean): void {
    const method = editable ? 'enable' : 'disable';
    this.ticketTypeIdControl[method]({ emitEvent: false });
    this.prioridadControl[method]({ emitEvent: false });
    this.estadoControl[method]({ emitEvent: false });
    this.comentariosControl[method]({ emitEvent: false });
    this.resolucionControl[method]({ emitEvent: false });
    this.clienteIdControl[method]({ emitEvent: false });
  }

  /** Inicializa los controles con los valores según acción */
  private initializeFormControls(): void {
    if ((this.action === 'Update' || this.action === 'View') && this.local_data?.id) {
      this.ticketTypeIdControl.setValue(this.local_data.ticket_type_id ?? null);
      this.clienteIdControl.setValue(this.local_data.clienteId ?? null);
      this.prioridadControl.setValue((this.local_data.prioridad as any) ?? 'media');
      this.estadoControl.setValue((this.local_data.estado as any) ?? 'pendiente');
      this.comentariosControl.setValue(this.local_data.comentarios_internos ?? '');
      this.resolucionControl.setValue(this.local_data.resolucion ?? '');
    } else if (this.action === 'Add') {
      this.local_data = this.local_data || {} as any;
      this.local_data.estado = 'pendiente';
      this.local_data.title = this.local_data.title || 'Nuevo Ticket';
    }
  }

  /** Carga tipos de ticket */
  private loadTicketTypes(): void {
    this.ticketService.getAllTicketTypes().subscribe({
      next: (types: TicketType[]) => {
        this.ticketTypes = types;
        // Si hay tipo preseleccionado, cargar sus campos
        if (this.local_data.ticket_type_id) {
          const selectedType = types.find(t => t.id === this.local_data.ticket_type_id);
          if (selectedType) this.onTicketTypeChange(selectedType.id);
        }
      },
      error: (err: any) => {
        console.error('Error al cargar tipos de ticket:', err);
        this.snackBar.open(this.translate.instant('error_cargar_tipos_ticket'), this.translate.instant('cerrar'), { duration: 5000 });
      }
    });
  }

  /** Carga historial de comentarios */
  private loadComments(): void {
    if (!this.local_data?.id) return;

    this.ticketService.getComments(this.local_data.id).subscribe({
      next: (list) => {
        const items = (list || []) as TicketComment[];
        // Orden descendente por fecha (fallback robusto si la propiedad varía)
        this.comments = items.sort((a, b) => {
          const da = new Date((a as any).created_at || (a as any).fecha || 0).getTime();
          const db = new Date((b as any).created_at || (b as any).fecha || 0).getTime();
          return db - da;
        });
      },
      error: () => {
        // Fallback: usar comentarios_internos como primer mensaje
        const base = (this.local_data.comentarios_internos || '').trim();
        this.comments = base ? [{
          autor: 'Sistema',
          mensaje: base,
          created_at: this.local_data.created_at || new Date().toISOString()
        } as any] : [];
      }
    });
  }

  /** Cambio de tipo de ticket: carga campos dinámicos */
  onTicketTypeChange(typeId: number): void {
    const selectedType = this.ticketTypes.find(t => t.id === typeId);
    if (!selectedType) return;

    this.selectedTicketType = selectedType;
    this.ticketFieldsForSelectedType = selectedType.fields || [];

    // Inicializa valores de campos dinámicos si no existen
    this.ticketFieldsForSelectedType.forEach(field => {
      if (!(field.id in this.fieldValues)) this.fieldValues[field.id] = '';
    });
  }

  /** Mensaje propio vs de otros */
  isOwn(c: TicketComment): boolean {
    const mine = (this.currentUserEmail || '').toLowerCase();
    const from = (c.autor || '').toLowerCase();
    if (mine && from) return mine === from;
    return (c.autor || '').toLowerCase() === 'tú';
  }

  /** Valida formulario: resolución obligatoria solo si estado === 'resuelto' */
  isFormValid(): boolean {
    const basic =
      this.ticketTypeIdControl.valid &&
      this.prioridadControl.valid;

    const needsResolution =
      (this.action === 'Update' || this.action === 'Add') &&
      this.estadoControl.value === 'resuelto';

    const resolutionValid = needsResolution ? this.resolucionControl.valid : true;

    const dynamicFieldsValid = this.ticketFieldsForSelectedType.every(field => {
      if (field.es_requerido) {
        const value = this.fieldValues[field.id];
        return value !== undefined && value !== null && value !== '';
      }
      return true;
    });

    return basic && resolutionValid && dynamicFieldsValid;
  }

  /** Clave de traducción para el título */
  getActionKey(): string {
    switch (this.action) {
      case 'Add': return 'accion_add';
      case 'Update': return 'accion_update';
      case 'View': return 'accion_view';
      case 'Delete': return 'accion_delete';
      default: return 'accion';
    }
  }

  /** Guardado único: crea/actualiza y, si hay comentario, lo añade */
  doAction(): void {
    if (this.action === 'Delete') {
      this.handleDelete();
      return;
    }

    if (!this.isFormValid()) {
      this.snackBar.open(
        this.translate.instant('completa_campos_requeridos'),
        this.translate.instant('cerrar'),
        { duration: 3000 }
      );
      return;
    }

    if (this.action === 'Add') {
      this.handleCreateWithOptionalComment();
    } else {
      this.handleUpdateWithOptionalComment();
    }
  }

  /** Crear ticket y añadir comentario si procede */
  private handleCreateWithOptionalComment(): void {
    const collectedFieldValues: FieldValue[] = this.ticketFieldsForSelectedType
      .filter(field => this.fieldValues[field.id] !== undefined && this.fieldValues[field.id] !== '')
      .map(field => ({
        ticket_field_id: field.id,
        valor: this.fieldValues[field.id]?.toString() || ''
      }));

    const ticketToSend: TicketElement = {
      id: 0,
      ticket_type_id: this.ticketTypeIdControl.value as number,
      clienteId: this.clienteIdControl.value as number,
      estado: this.estadoControl.value || 'pendiente',
      prioridad: this.prioridadControl.value as ('alta' | 'media' | 'baja'),
      comentarios_internos: this.comentariosControl.value || '',
      resolucion: this.resolucionControl.value || undefined,
      title: `Ticket ${this.selectedTicketType?.nombre || 'General'}`,
      Imgsrc: '/assets/images/tickets/default-ticket.jpg',
      created_at: new Date().toISOString(),
      fieldValues: collectedFieldValues
    };

    try {
      const createdId = this.ticketService.addTicket(ticketToSend); // si devuelve id, úsalo
      const comment = (this.newComment.value || '').trim();

      if (comment && createdId) {
        this.ticketService.addComment(createdId, comment).subscribe({
          next: () => this.afterSaveSuccess('ticket_creado_ok'),
          error: () => this.afterSaveSuccess('ticket_creado_ok') // no bloquea por fallo en comentario
        });
      } else {
        this.afterSaveSuccess('ticket_creado_ok');
      }
    } catch (error) {
      console.error('Error creando ticket:', error);
      this.snackBar.open(
        this.translate.instant('ticket_creado_error'),
        this.translate.instant('cerrar'),
        { duration: 3000 }
      );
    }
  }

  /** Actualizar ticket y añadir comentario si procede */
  private handleUpdateWithOptionalComment(): void {
    const updatedTicket: TicketElement = {
      ...this.local_data,
      ticket_type_id: this.ticketTypeIdControl.value as number,
      clienteId: this.clienteIdControl.value as number,
      prioridad: this.prioridadControl.value as ('alta' | 'media' | 'baja'),
      estado: this.estadoControl.value as ('pendiente' | 'en_proceso' | 'resuelto'),
      comentarios_internos: this.comentariosControl.value || '',
      resolucion: this.resolucionControl.value || undefined,
    };

    try {
      this.ticketService.updateTicket(updatedTicket);

      const comment = (this.newComment.value || '').trim();
      if (comment && updatedTicket.id) {
        this.ticketService.addComment(updatedTicket.id, comment).subscribe({
          next: () => this.afterSaveSuccess('ticket_actualizado_ok'),
          error: () => this.afterSaveSuccess('ticket_actualizado_ok') // no bloquea por fallo en comentario
        });
      } else {
        this.afterSaveSuccess('ticket_actualizado_ok');
      }
    } catch (error) {
      console.error('Error actualizando ticket:', error);
      this.snackBar.open(
        this.translate.instant('ticket_actualizado_error'),
        this.translate.instant('cerrar'),
        { duration: 3000 }
      );
    }
  }

  /** Tras guardar: snack, cerrar y refrescar lista */
  private afterSaveSuccess(i18nKey: string): void {
    this.snackBar.open(
      this.translate.instant(i18nKey),
      this.translate.instant('cerrar'),
      { duration: 3000 }
    );
    this.dialogRef.close(true);
    this.ticketService.refreshTickets();
  }

  /** Eliminar ticket */
  private handleDelete(): void {
    try {
      this.ticketService.deleteTicket(this.local_data.id);
      this.snackBar.open(
        this.translate.instant('ticket_eliminado_ok'),
        this.translate.instant('cerrar'),
        { duration: 3000 }
      );
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error eliminando ticket:', error);
      this.snackBar.open(
        this.translate.instant('ticket_eliminado_error'),
        this.translate.instant('cerrar'),
        { duration: 3000 }
      );
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  /** Etiqueta traducible para tipos conocidos */
  getTicketTypeLabel(nombre: string): string {
    switch (nombre) {
      case 'Incidencia': return 'ticket_type_incidencia';
      case 'Tareas logísticas': return 'ticket_type_tareas_logisticas';
      default: return nombre;
    }
  }
}