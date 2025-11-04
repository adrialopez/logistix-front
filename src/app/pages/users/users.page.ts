import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UsersService } from 'src/app/shared/services/users.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { UserDialogComponent } from './user-dialog.component';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    TablerIconsModule
  ]
})
export class UsersPage implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['id', 'email', 'tienda_nombre', 'role', 'created_at', 'actions'];
  dataSource = new MatTableDataSource<any>([]);

  users: any[] = [];
  tiendas: any[] = [];
  roles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'tier1', label: 'Tier 1' },
    { value: 'client', label: 'Cliente' },
    { value: 'picker', label: 'Preparador' }
  ];

  constructor(
    private usersService: UsersService,
    private toastr: ToastrService,
    private translate: TranslateService,
    public dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.loadTiendas();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadUsers() {
    this.usersService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.dataSource.data = data;
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        this.toastr.error('Error al cargar usuarios', 'Error');
      }
    });
  }

  loadTiendas() {
    this.usersService.getTiendas().subscribe({
      next: (data) => {
        this.tiendas = data;
      },
      error: (err) => {
        console.error('Error al cargar tiendas:', err);
      }
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  openAddDialog() {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '500px',
      data: {
        action: 'Add',
        tiendas: this.tiendas,
        roles: this.roles
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.event === 'Add') {
        this.usersService.createUser(result.data).subscribe({
          next: () => {
            this.toastr.success('Usuario creado correctamente', 'Éxito');
            this.loadUsers();
          },
          error: (err) => {
            console.error('Error al crear usuario:', err);
            this.toastr.error(err.error?.message || 'Error al crear usuario', 'Error');
          }
        });
      }
    });
  }

  editUser(user: any) {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '500px',
      data: {
        action: 'Update',
        user: user,
        tiendas: this.tiendas,
        roles: this.roles
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.event === 'Update') {
        this.usersService.updateUser(user.id, result.data).subscribe({
          next: () => {
            this.toastr.success('Usuario actualizado correctamente', 'Éxito');
            this.loadUsers();
          },
          error: (err) => {
            console.error('Error al actualizar usuario:', err);
            this.toastr.error(err.error?.message || 'Error al actualizar usuario', 'Error');
          }
        });
      }
    });
  }

  deleteUser(user: any) {
    if (!confirm(`¿Estás seguro de eliminar al usuario ${user.email}?`)) {
      return;
    }

    this.usersService.deleteUser(user.id).subscribe({
      next: () => {
        this.toastr.success('Usuario eliminado correctamente', 'Éxito');
        this.loadUsers();
      },
      error: (err) => {
        console.error('Error al eliminar usuario:', err);
        this.toastr.error('Error al eliminar usuario', 'Error');
      }
    });
  }

  getRoleLabel(role: string): string {
    const found = this.roles.find(r => r.value === role);
    return found ? found.label : role;
  }
}
