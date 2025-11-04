import { Component, Inject, OnInit, Optional, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { Location } from 'src/app/model/entity/location';
import { HttpClient } from '@angular/common/http';
import { MessageService, SelectItem } from 'primeng/api';
import { LocationService } from 'src/app/shared/services/location.service';
import { MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CreateLocationPayload } from 'src/app/model/dto/create-location-payload';
import { UpdateLocationPayload } from 'src/app/model/dto/update-location-payload';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-locations',
  templateUrl: './locations.page.html',
  styleUrls: ['./locations.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule]
})
export class LocationsPage implements OnInit {

  shop = 'lotes-test.myshopify.com';
  locations: Location[] = [];

  localtionEditado: Location | null = null;
  mostrarModalEdicion: boolean = false;
  modoRelativo: boolean = false;
  observaciones: string = '';
  paginaActual = 0;
  locationsPorPagina = 5;

  searchTerm = '';
  showDeleted = false;

  errorMessage: string = '';
  toastActive: boolean = false;
  sortMode: any;

  selection: SelectionModel<Location> = new SelectionModel<Location>(true, []);
  locationOptions: SelectItem[] = [];

  @ViewChild(MatTable, { static: true }) table: MatTable<any> =
    Object.create(null);

  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;

  searchText: any;

  displayedColumns = [
    'select',
    'code',
    'name',
    'action'
  ]

  dataSource = new MatTableDataSource<Location>([]);

  constructor(
    public dialog: MatDialog,
    private locationService: LocationService) { }

  ngOnInit() {
    this.cargarLocations();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.paginator.pageSize = this.locationsPorPagina;
  }

  async cargarLocations() {
    this.locationService.getLocations(this.showDeleted)
    .subscribe(locations => {
        this.locations = locations.map(l => ({
          ...l
        }));
        this.dataSource.data = this.locations;
      });
  }

  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  masterToggle(): void {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.data.forEach((row) => this.selection.select(row));
  }

  isAllSelected(): any {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  checkboxLabel(row?: Location): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id + 1
      }`;
  }

  openDialog(action: string, location: Location | any, shop: string): void {
    const dialogRef = this.dialog.open(AppEmployeeDialogContentComponent, {
      data: { action, location, shop }, autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.cargarLocations();
      if (result && result.event === 'Refresh') {
        this.cargarLocations();
      }
    });
  }

  deleteSelected(): void {
    const selectedIds = this.selection.selected.map((item) => item.id);
    if (selectedIds.length > 0) {
      this.openDialog('Delete', selectedIds, this.shop);
    }
  }

}

interface DialogData {
  action: string;
  shop: string;
  location: Location;
}

@Component({
  // tslint:disable-next-line: component-selector
  selector: 'app-dialog-content',
  imports: [
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    TablerIconsModule,
    TranslateModule
  ],
  templateUrl: 'location-dialog-content.html',
})
export class AppEmployeeDialogContentComponent {


  action: string | any;
  local_data: any;
  selectedImage: any = '';
  joiningDate = new FormControl();
  modoRelativo = false;
  productoSeleccionado = 'todos';
  varianteSeleccionada = 'todas';
  selectedLocation = 0;
  shop: string = '';

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AppEmployeeDialogContentComponent>,
    private locationService: LocationService,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private translate: TranslateService, 
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.action = data.action;
    this.local_data = { ...data.location }
    this.shop = data.shop;
  }

  closeDialog(): void {
    this.dialogRef.close({ event: 'Cancel' });
  }

  async doAction(): Promise<void> {
    if (this.action === 'Add') {
      const payload: CreateLocationPayload = {
        shop: this.shop,
        code: this.local_data.code,
        name: this.local_data.name
      }
      try {
        await this.locationService.addLocation(payload);
        this.openSnackBar(
          this.translate.instant('almacen_creado_ok'),
          this.translate.instant('cerrar')
        );
        this.dialogRef.close({ event: 'Refresh' });
      } catch (err: any) {
        console.error('Error al guardar el almacén:', err);
        this.openSnackBar(
          this.translate.instant('error_crear_almacen'),
          this.translate.instant('cerrar')
        );
      }
    } else if (this.action === 'Update') {
      const payload: UpdateLocationPayload = {
        id: this.local_data.id,
        shop: this.shop,
        code: this.local_data.code,
        name: this.local_data.name
      }
      try {
        await this.locationService.updateLocation(payload).subscribe((responseData: any) => {
          this.dialogRef.close({ event: 'Update' });
          this.openSnackBar(
            this.translate.instant('almacen_actualizado_ok'),
            this.translate.instant('cerrar')
          );
        });
      } catch (err) {
        console.error('Error al actualizar el almacén', err);
        this.openSnackBar(
          this.translate.instant('error_actualizar_almacen'),
          this.translate.instant('cerrar')
        );
      }
    } else if (this.action === 'Delete') {
      try {
        this.locationService.deleteLocation(this.local_data.id).subscribe((responseData: any) => {});
        this.dialogRef.close({ event: 'Delete' });
        this.openSnackBar(
          this.translate.instant('almacen_eliminado_ok'),
          this.translate.instant('cerrar')
        );
      } catch (err) {
        console.error('Error al eliminar el almacén', err);
        this.openSnackBar(
          this.translate.instant('error_eliminar_almacen'),
          this.translate.instant('cerrar')
        );
      }
    }
  }

  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}