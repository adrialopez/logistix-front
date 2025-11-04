import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

/** Muestra el loading al iniciar una petición y lo oculta al finalizar (éxito o error). */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  loading.startRequest();
  return next(req).pipe(finalize(() => loading.endRequest()));
};
