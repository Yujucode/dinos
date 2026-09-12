import { Injectable, computed, effect, signal } from '@angular/core';

const LLAVE_LOCALSTORAGE = 'tablero-cartas:sesion';

function cargarSesionGuardada(): string | null {
  try {
    return localStorage.getItem(LLAVE_LOCALSTORAGE);
  } catch {
    return null;
  }
}

/**
 * Sesión del anfitrión que organiza la partida (no es un jugador del juego).
 * Se guarda en localStorage de forma indefinida para que un F5 no obligue
 * a loguearse de nuevo — solo "Cerrar sesión" la borra.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  readonly nombreUsuario = signal<string | null>(cargarSesionGuardada());
  readonly estaLogueado = computed(() => this.nombreUsuario() !== null);

  constructor() {
    effect(() => {
      const nombre = this.nombreUsuario();
      try {
        if (nombre) {
          localStorage.setItem(LLAVE_LOCALSTORAGE, nombre);
        } else {
          localStorage.removeItem(LLAVE_LOCALSTORAGE);
        }
      } catch {
        // localStorage no disponible (modo incógnito, etc.) — se ignora.
      }
    });
  }

  iniciarSesion(nombre: string): void {
    const limpio = nombre.trim();
    if (!limpio) return;
    this.nombreUsuario.set(limpio);
  }

  cerrarSesion(): void {
    this.nombreUsuario.set(null);
  }
}
