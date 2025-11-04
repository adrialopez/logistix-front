import { Injectable } from '@angular/core';

export interface Country {
  code: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class CountryService {
  private countries: Country[] = [
    { code: 'ES', name: 'España' },
    { code: 'DE', name: 'Alemania' },
    { code: 'FR', name: 'Francia' },
    { code: 'IT', name: 'Italia' },
    { code: 'PT', name: 'Portugal' },
    { code: 'GB', name: 'Reino Unido' },
    { code: 'US', name: 'Estados Unidos' },
    { code: 'MX', name: 'México' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' },
    { code: 'PE', name: 'Perú' },
    { code: 'VE', name: 'Venezuela' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'DO', name: 'República Dominicana' },
    { code: 'PA', name: 'Panamá' },
    { code: 'CU', name: 'Cuba' },
    { code: 'HN', name: 'Honduras' },
    { code: 'NI', name: 'Nicaragua' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'BR', name: 'Brasil' },
    { code: 'CA', name: 'Canadá' },
    { code: 'CN', name: 'China' },
    { code: 'JP', name: 'Japón' },
    { code: 'KR', name: 'Corea del Sur' },
    { code: 'IN', name: 'India' },
    { code: 'AU', name: 'Australia' },
    { code: 'NZ', name: 'Nueva Zelanda' },
    { code: 'ZA', name: 'Sudáfrica' },
    { code: 'MA', name: 'Marruecos' },
    { code: 'EG', name: 'Egipto' },
    { code: 'SA', name: 'Arabia Saudí' },
    { code: 'AE', name: 'Emiratos Árabes Unidos' },
    { code: 'TR', name: 'Turquía' },
    { code: 'RU', name: 'Rusia' },
  ];

  getCountries(): Country[] {
    return this.countries;
  }
}
