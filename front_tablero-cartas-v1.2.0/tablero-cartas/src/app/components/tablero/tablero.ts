import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TableroService } from '../../services/tablero';
import { SesionService } from '../../services/sesion';
import { JugadorFicha } from '../jugador-ficha/jugador-ficha';
import { Carta } from '../carta/carta';
import { Inscripciones } from '../inscripciones/inscripciones';
import { AvatarDino } from '../avatar-dino/avatar-dino';
import { VERSION } from '../../version';

const INTERVALO_AUTOMATICO_MS = 700;

@Component({
  selector: 'app-tablero',
  standalone: true,
  imports: [JugadorFicha, Carta, Inscripciones, AvatarDino],
  templateUrl: './tablero.html',
  styleUrl: './tablero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tablero {
  readonly version = VERSION;
  readonly modoAutomatico = signal(false);
  readonly mostrarInscripciones = signal(true);
  readonly mostrarApuestas = signal(false);
  private intervaloId: ReturnType<typeof setInterval> | null = null;

  // --- Decoración: bosque cerca de la meta y público de dinosaurios a los costados ---
  // El público reutiliza las especies/colores reales de los jugadores (vía
  // avatar-dino) en vez de emoji planos, para que se vea más "de bulto".
  readonly arboles = ['🌴', '🌳', '🌲', '🌳', '🌴', '🌲', '🌳', '🌴', '🌲', '🌳', '🌴', '🌲'];
  readonly publicoIzq = computed(() => this.ciclarPublico(8, 0));
  readonly publicoDer = computed(() => this.ciclarPublico(8, 3));

  private ciclarPublico(cantidad: number, offset: number) {
    const jugadores = this.servicio.jugadores();
    if (jugadores.length === 0) return [];
    return Array.from({ length: cantidad }, (_, i) => jugadores[(i + offset) % jugadores.length]);
  }

  // --- Navegación del historial de cartas (marco con flechas) ---
  // `verEnVivo` en true = el marco sigue automáticamente la última carta cantada.
  // Al ir "atrás" se congela en esa carta hasta volver a la última.
  readonly verEnVivo = signal(true);
  private readonly indiceManual = signal(0);

  readonly indiceMostrado = computed(() =>
    this.verEnVivo() ? this.servicio.historial().length - 1 : this.indiceManual()
  );

  readonly cartaMostrada = computed(() => {
    const historial = this.servicio.historial();
    const i = this.indiceMostrado();
    return i >= 0 && i < historial.length ? historial[i] : null;
  });

  readonly puedeIrAtras = computed(() => this.indiceMostrado() > 0);
  readonly puedeIrAdelante = computed(
    () => !this.verEnVivo() && this.indiceMostrado() < this.servicio.historial().length - 1
  );

  constructor(
    readonly servicio: TableroService,
    readonly sesion: SesionService,
    private readonly router: Router
  ) {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.detenerAutomatico());

    // Se detiene solo cuando ya no quedan cartas por sacar (no al primer ganador,
    // así se puede seguir jugando para comprobar que todos lleguen a la meta).
    effect(() => {
      if (this.servicio.mazoVacio()) {
        this.detenerAutomatico();
      }
    });
  }

  cantarCarta(): void {
    this.servicio.cantarCarta();
  }

  alternarAutomatico(): void {
    if (this.modoAutomatico()) {
      this.detenerAutomatico();
    } else if (!this.servicio.mazoVacio()) {
      // Salvaguarda: no arrancar el intervalo si ya no quedan cartas
      // (el botón ya está oculto en ese caso, pero por las dudas).
      this.modoAutomatico.set(true);
      this.intervaloId = setInterval(() => this.servicio.cantarCarta(), INTERVALO_AUTOMATICO_MS);
    }
  }

  private detenerAutomatico(): void {
    if (this.intervaloId !== null) {
      clearInterval(this.intervaloId);
      this.intervaloId = null;
    }
    this.modoAutomatico.set(false);
  }

  renombrarJugador(id: number, nuevoNombre: string): void {
    this.servicio.renombrar(id, nuevoNombre);
  }

  reiniciar(): void {
    this.detenerAutomatico();
    this.servicio.reiniciar();
    this.verEnVivo.set(true);
    this.indiceManual.set(0);
  }

  /**
   * Botón "Registro" del panel lateral: reabre el modal. Se deshabilita (ver
   * template) recién cuando sale la primera carta y hasta que termina la
   * carrera (`carreraEnCurso`) — entre presionar "Jugar" y esa primera carta
   * todavía se puede volver a entrar. Este chequeo es una salvaguarda extra
   * por si se invoca de otra forma. Al terminar la carrera (mazo vacío) se
   * puede volver a abrir, aunque su contenido queda solo-lectura (ver
   * `inscripcionesCongeladas`).
   */
  abrirInscripciones(): void {
    if (this.servicio.carreraEnCurso()) return;
    this.detenerAutomatico();
    this.servicio.desbloquearInscripciones();
    this.mostrarInscripciones.set(true);
  }

  cartaAnterior(): void {
    const nuevo = Math.max(0, this.indiceMostrado() - 1);
    this.indiceManual.set(nuevo);
    this.verEnVivo.set(false);
  }

  cartaSiguiente(): void {
    const ultimo = this.servicio.historial().length - 1;
    const nuevo = this.indiceMostrado() + 1;
    if (nuevo >= ultimo) {
      this.verEnVivo.set(true);
    } else {
      this.indiceManual.set(nuevo);
      this.verEnVivo.set(false);
    }
  }

  irALaUltima(): void {
    this.verEnVivo.set(true);
  }

  cerrarSesion(): void {
    this.detenerAutomatico();
    this.sesion.cerrarSesion();
    this.router.navigateByUrl('/login');
  }
}
