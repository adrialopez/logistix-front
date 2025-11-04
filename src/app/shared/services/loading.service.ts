import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Lleva un contador de peticiones en curso para soportar concurrencia.
 * Exponemos loading$ para mostrar/ocultar el overlay global.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private pending = 0;
  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  readonly loading$ = this._loading$.asObservable();

  startRequest(): void {
    this.pending++;
    if (!this._loading$.value) this._loading$.next(true);
  }

  endRequest(): void {
    if (this.pending > 0) this.pending--;
    if (this.pending === 0 && this._loading$.value) this._loading$.next(false);
  }

  show(): void { this._loading$.next(true); }
  hide(): void { this._loading$.next(false); this.pending = 0; }
}
