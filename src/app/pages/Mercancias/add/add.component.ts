import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-add',
    imports: [MatDialogModule, MatButtonModule, TranslateModule],
    templateUrl: './add.component.html'
})
export class AppAddEmployeeComponent {
  constructor() {}
}
