import { CommonModule } from '@angular/common';
import { Component, Optional, Inject, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';

interface UserDialogData {
  action: string; // 'Add' | 'Update'
  user?: any;
  tiendas: any[];
  roles: Array<{ value: string; label: string }>;
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  templateUrl: './user-dialog.component.html',
  styleUrls: ['./user-dialog.component.scss'],
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    TablerIconsModule
  ]
})
export class UserDialogComponent implements OnInit {
  action: string;
  local_data: any;
  tiendas: any[] = [];
  roles: Array<{ value: string; label: string }> = [];

  userForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    tienda_id: new FormControl('', [Validators.required]),
    role: new FormControl('client', [Validators.required])
  });

  constructor(
    public dialogRef: MatDialogRef<UserDialogComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: UserDialogData
  ) {
    this.action = data.action;
    this.tiendas = data.tiendas || [];
    this.roles = data.roles || [];
    this.local_data = data.user ? { ...data.user } : {};

    // Si es editar, cargar datos y hacer password opcional
    if (this.action === 'Update' && data.user) {
      this.userForm.patchValue({
        email: data.user.email,
        tienda_id: data.user.tienda_id,
        role: data.user.role
      });

      // Al editar, la contraseña es opcional
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
    }
  }

  ngOnInit(): void {}

  doAction(): void {
    if (this.userForm.invalid) {
      return;
    }

    const formData = this.userForm.value;

    // Si es Update y la contraseña está vacía, no la incluimos
    if (this.action === 'Update' && (!formData.password || formData.password.trim() === '')) {
      delete formData.password;
    }

    this.dialogRef.close({ event: this.action, data: formData });
  }

  closeDialog(): void {
    this.dialogRef.close({ event: 'Cancel' });
  }
}
