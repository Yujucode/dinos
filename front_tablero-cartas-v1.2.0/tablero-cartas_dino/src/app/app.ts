import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SesionService } from './services/sesion';
import { VERSION, VERSION_NOTA } from './version';

/** Cada cuánto se revisa si el acceso fue suspendido desde el panel,
 *  mientras hay una sesión abierta. No es instantáneo a propósito: es un
 *  balance entre sacar a la gente rápido y no llenar de pedidos al backend. */
const INTERVALO_REVISION_ACCESO_MS = 20_000;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly version = VERSION;

  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private intervaloAcceso: ReturnType<typeof setInterval> | null = null;

  constructor() {
    console.log(`%cRaceDinos — v${VERSION}`, 'font-weight: bold; color: #FFD23F;');
    console.log(VERSION_NOTA);

    // Mientras haya sesión abierta, se revisa cada cierto tiempo si el
    // acceso fue suspendido desde el panel — así se saca también a quien
    // ya estaba adentro jugando, no solo a los que intentan entrar de nuevo.
    effect(() => {
      if (this.sesion.estaLogueado()) {
        this.iniciarVigilanciaAcceso();
      } else {
        this.detenerVigilanciaAcceso();
      }
    });
  }

  private iniciarVigilanciaAcceso(): void {
    if (this.intervaloAcceso) return;
    this.intervaloAcceso = setInterval(() => this.verificarAcceso(), INTERVALO_REVISION_ACCESO_MS);
  }

  private detenerVigilanciaAcceso(): void {
    if (this.intervaloAcceso) {
      clearInterval(this.intervaloAcceso);
      this.intervaloAcceso = null;
    }
  }

  private async verificarAcceso(): Promise<void> {
    try {
      const respuesta = await fetch('/api/estado-acceso');
      if (!respuesta.ok) return;
      const datos = await respuesta.json();
      if (datos.suspendido === true) {
        this.sesion.forzarSalidaPorSuspension();
        this.router.navigateByUrl('/login');
      }
    } catch {
      // Sin conexión momentánea — se reintenta en el próximo ciclo, no se
      // saca a nadie por un problema de red pasajero.
    }
  }
}
