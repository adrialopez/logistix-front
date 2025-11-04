import { Component } from '@angular/core';
import { CoreService } from 'libreria_componentes/src/app/services/core.service';

@Component({
  selector: 'app-branding',
  imports: [],
  template: `
    <a href="/" class="logodark">
      <img
        src="https://logistix.es/wp-content/uploads/LOGOS_Mesa-de-trabajo-1.png#133"
        class="align-middle m-2"
        alt="logo"
      />
    </a>

    <a href="/" class="logolight">
      <img
        src="https://logistix.es/wp-content/uploads/LOGOS_Mesa-de-trabajo-1.png#133"
        class="align-middle m-2"
        alt="logo"
      />
    </a>
  `,
})
export class BrandingComponent {
  options = this.settings.getOptions();
  constructor(private settings: CoreService) {}
}
