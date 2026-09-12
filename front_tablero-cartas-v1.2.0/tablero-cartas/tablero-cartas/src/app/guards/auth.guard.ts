import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionService } from '../services/sesion';

/** Protege rutas que requieren sesión iniciada (ej. /juego). */
export const authGuard: CanActivateFn = () => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  return sesion.estaLogueado() || router.parseUrl('/login');
};

/** Protege /login: si ya hay sesión, va directo al juego. */
export const soloInvitadosGuard: CanActivateFn = () => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  return !sesion.estaLogueado() || router.parseUrl('/juego');
};
