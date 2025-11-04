import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { SettingsService } from 'src/app/shared/services/settings.service';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/shared/services/auth.service';

@Component({
  selector: 'app-ajustes',
  templateUrl: './ajustes.page.html',
  styleUrls: ['./ajustes.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, ReactiveFormsModule, FormsModule, MaterialModule]
})
export class AjustesPage implements OnInit {

  generalForm!: FormGroup;
  shopifyForm!: FormGroup;
  billingForm!: FormGroup;
  shopifyEnabled = false;
  isNewShopify = true;
  role: string | null = 'client';
  notifsForm!: FormGroup;


  constructor(
    private fb: FormBuilder,
    private settingsSvc: SettingsService,
    private auth: AuthService
  ) {
    this.auth.role$.subscribe(role => {
      this.role = role;
    });
  }

  ngOnInit() {
    // Formularios reactivos
    this.generalForm = this.fb.group({
      default_sort_mode: ['FEFO', Validators.required],
      warning_days: [0, [Validators.required, Validators.min(0)]],
      critical_days: [0, [Validators.required, Validators.min(0)]]
    });

    this.shopifyForm = this.fb.group({
      dominio_shopify: ['', Validators.required],
      token_acceso: ['', Validators.required],
      shopify_enabled: [false],
      sendcloud_integration_id: [null]
    });

    this.notifsForm = this.fb.group({
      items: this.fb.array([])  // cada fila: { key, label, description, enabled, emails }
    });

    this.billingForm = this.fb.group({
      nombre_fiscal: [''],
      cif: [''],
      direccion_fiscal: [''],
      codigo_postal_fiscal: [''],
      telefono_fiscal: [''],
      email_fiscal: ['', Validators.email]
    });

    this.loadSettings();
    this.loadNotifications();
  }

  get itemsFA(): FormArray {
    return this.notifsForm.get('items') as FormArray;
  }

  private buildNotifRow(n: any): FormGroup {
    return this.fb.group({
      key: [n.key],
      label: [n.label],
      description: [n.description],
      enabled: [!!n.enabled],
      emails: [n.emails || '', [this.commaEmailsValidator()]]
    });
  }

  private loadNotifications() {
    this.settingsSvc.getNotifications().subscribe(list => {
      const fa = this.itemsFA;
      fa.clear();
      list.forEach(n => fa.push(this.buildNotifRow(n)));
    });
  }

  saveNotifications() {
    const payload = (this.itemsFA.value as any[]).map(v => ({
      key: v.key,
      enabled: !!v.enabled,
      emails: String(v.emails || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .join(',') // normaliza
    }));
    this.settingsSvc.updateNotifications(payload).subscribe(() => {
      // feedback si quieres (snackbar)
    });
  }

  // Validador de lista coma-separada de emails
  private commaEmailsValidator(): ValidatorFn {
    const EMAIL =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    return (control: AbstractControl) => {
      const v = (control.value || '').trim();
      if (!v) return null; // opcional
      const parts = v.split(',').map((s: string) => s.trim()).filter(Boolean);
      const invalid = parts.find((e: string) => !EMAIL.test(e));
      return invalid ? { invalidEmails: true } : null;
    };
  }
  async loadSettings() {
    const cfg = await this.settingsSvc.getSettings().subscribe(cfg => {
      this.generalForm.patchValue({
        default_sort_mode: cfg.defaultSort,
        warning_days: cfg.warningDays,
        critical_days: cfg.criticalDays
      });

      this.shopifyEnabled = cfg.shopifyEnabled;
      this.isNewShopify = !this.shopifyEnabled;
      this.shopifyForm.patchValue({
        dominio_shopify: cfg.dominioShopify || '',
        token_acceso: cfg.tokenAcceso || '',
        shopify_enabled: this.shopifyEnabled,
        sendcloud_integration_id: cfg.sendcloudIntegrationId || null
      });

      this.billingForm.patchValue({
        nombre_fiscal: cfg.nombreFiscal || '',
        cif: cfg.cif || '',
        direccion_fiscal: cfg.direccionFiscal || '',
        codigo_postal_fiscal: cfg.codigoPostalFiscal || '',
        telefono_fiscal: cfg.telefonoFiscal || '',
        email_fiscal: cfg.emailFiscal || ''
      });
    });

  }

  async saveGeneral() {
    const warningDays = this.generalForm.get('warning_days')?.value;
    const criticalDays = this.generalForm.get('critical_days')?.value;

    const sendcloudIntegrationId = this.generalForm.get('sendcloudIntegrationId')?.value || 0;

    const payload = {
      defaultSort: this.generalForm.get('default_sort_mode')?.value,
      warningDays,
      criticalDays,
      sendcloudIntegrationId
    };

    try {
      await this.settingsSvc.updateGeneral(payload).subscribe(() => {
        // Actualizar los valores en el servicio
        this.settingsSvc.setWarningDays(warningDays);
        this.settingsSvc.setCriticalDays(criticalDays);
      });
    } catch (error) {
      console.error('Error al guardar ajustes:', error);
    }
  }

  async enableShopify() {
    this.shopifyEnabled = true;
    this.shopifyForm.get('shopify_enabled')!.setValue(true);
  }


  async toggleShopify() {
    await this.settingsSvc.disableShopify().subscribe(responseData => {
      this.shopifyEnabled = false;
    });
  }


  async importShopifyProducts() {
    const { dominio_shopify, token_acceso } = this.shopifyForm.value;
    await this.settingsSvc.updateShopifyProducts({ dominioShopify: dominio_shopify, tokenAcceso: token_acceso }).subscribe(responseData => {
      this.shopifyEnabled = true;
    })
    // mostrar confirmación
  }

  async saveBillingData() {
    if (!this.billingForm.valid) {
      return;
    }

    const billingData = {
      nombreFiscal: this.billingForm.get('nombre_fiscal')?.value,
      cif: this.billingForm.get('cif')?.value,
      direccionFiscal: this.billingForm.get('direccion_fiscal')?.value,
      codigoPostalFiscal: this.billingForm.get('codigo_postal_fiscal')?.value,
      telefonoFiscal: this.billingForm.get('telefono_fiscal')?.value,
      emailFiscal: this.billingForm.get('email_fiscal')?.value
    };

    try {
      await this.settingsSvc.updateBillingData(billingData).subscribe(() => {
        // Feedback (snackbar o similar)
        console.log('Datos de facturación guardados correctamente');
      });
    } catch (error) {
      console.error('Error al guardar datos de facturación:', error);
    }
  }
}
