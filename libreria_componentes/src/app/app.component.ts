import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'Modernize Angular Admin Tempplate';
  private htmlElement!: HTMLHtmlElement;
  constructor() {

    this.htmlElement = document.querySelector('html')!;
    this.htmlElement.classList.add('light-theme');
  }
}
