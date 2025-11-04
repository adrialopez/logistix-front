import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../material.module';
import { BrandingComponent } from './branding.component';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../shared/services/auth.service';
import { ToastrService, ToastrModule } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ReactiveFormsModule, MaterialModule, BrandingComponent,
    ToastrModule, TranslateModule
  ]
})
export class LoginPage {
  errorMessage = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private auth: AuthService,
    private toastr: ToastrService,
    private translate: TranslateService
  ) {}
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.minLength(6), Validators.email]),
    password: new FormControl('', [Validators.required]),
    remember: new FormControl(false)
  });

  get f() {
    return this.form.controls;
  }

  submit() {
    if (this.form.invalid) return;
    const { email, password, remember } = this.form.value;
    this.auth.login({
      email: email!,
      password: password!,
      remember: remember!
    }).subscribe({
      next: () => this.router.navigate(['/']),
      error: err => {
        const msg = err.error?.message || this.translate.instant('credenciales_invalidas');
        this.errorMessage = msg;
        this.toastr.error(msg, this.translate.instant('error_autenticacion'), {
          timeOut: 3500,
          positionClass: 'toast-top-center'
        });
      }
    });
  }
}
