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

/** Velocidades disponibles para el modo automático (tanto en carrera real como en la demo "🧪 Pruebas"), en ms. */
const VELOCIDADES_MS = [2000, 1000, 700, 500] as const;

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
  readonly velocidades = VELOCIDADES_MS;
  readonly modoAutomatico = signal(false);
  readonly eligiendoVelocidadReal = signal(false);
  readonly mostrarInscripciones = signal(true);
  readonly mostrarApuestas = signal(false);
  private intervaloId: ReturnType<typeof setInterval> | null = null;

  // --- Demo "🧪 Pruebas": elegir modo/velocidad antes de arrancar, y llevar
  // el intervalo del modo automático de la demo (separado del real). ---
  readonly panelPruebas = signal<'inactivo' | 'eligiendo-modo' | 'eligiendo-velocidad'>('inactivo');
  readonly modoDemoAutomatico = signal(false);
  private intervaloDemoId: ReturnType<typeof setInterval> | null = null;

  /** Qué dinos mostrar en la pista: los de la demo mientras está activa, si no los reales. */
  readonly jugadoresMostrados = computed(() =>
    this.servicio.demoActivo() ? this.servicio.jugadoresDemo() : this.servicio.jugadores()
  );

  /** Ganador a mostrar en el banner de arriba: el de la demo, si está activa, o el real. */
  readonly ganadorMostrado = computed(() =>
    this.servicio.demoActivo() ? this.servicio.primerGanadorDemo() : this.servicio.primerGanador()
  );

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

  /** Widget del mazo: mientras la demo está activa muestra sus propias cartas (sin navegación hacia atrás). */
  readonly cartaMostradaFinal = computed(() =>
    this.servicio.demoActivo() ? this.servicio.cartaActualDemo() : this.cartaMostrada()
  );
  readonly cartasRestantesMostradas = computed(() =>
    this.servicio.demoActivo() ? this.servicio.cartasRestantesDemo() : this.servicio.cartasRestantes()
  );
  readonly dorsosVisiblesMostrados = computed(() =>
    this.servicio.demoActivo() ? this.servicio.dorsosVisiblesDemo() : this.servicio.dorsosVisibles()
  );

  constructor(
    readonly servicio: TableroService,
    readonly sesion: SesionService,
    private readonly router: Router
  ) {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.detenerAutomatico();
      this.detenerAutomaticoDemo();
    });

    // Se detiene solo cuando ya no quedan cartas por sacar (no al primer ganador,
    // así se puede seguir jugando para comprobar que todos lleguen a la meta).
    effect(() => {
      if (this.servicio.mazoVacio()) {
        this.detenerAutomatico();
      }
    });

    // La demo sí se detiene apenas hay ganador (o si por algún motivo se acaba el mazo).
    effect(() => {
      if (this.servicio.primerGanadorDemo() || this.servicio.mazoVacioDemo()) {
        this.detenerAutomaticoDemo();
      }
    });
  }

  cantarCarta(): void {
    this.servicio.cantarCarta();
  }

  /** Botón "Modo automático": ya no arranca directo — primero pide elegir velocidad (igual que en Pruebas). */
  alternarAutomatico(): void {
    if (this.modoAutomatico()) {
      this.detenerAutomatico();
    } else if (!this.servicio.mazoVacio()) {
      this.eligiendoVelocidadReal.set(true);
    }
  }

  elegirVelocidadReal(velocidadMs: number): void {
    if (this.servicio.mazoVacio()) return; // salvaguarda: no arrancar si ya no quedan cartas
    this.eligiendoVelocidadReal.set(false);
    this.modoAutomatico.set(true);
    this.intervaloId = setInterval(() => this.servicio.cantarCarta(), velocidadMs);
  }

  private detenerAutomatico(): void {
    if (this.intervaloId !== null) {
      clearInterval(this.intervaloId);
      this.intervaloId = null;
    }
    this.modoAutomatico.set(false);
    this.eligiendoVelocidadReal.set(false);
  }

  renombrarJugador(id: number, nuevoNombre: string): void {
    // Durante la demo se muestran los dinos de prueba, no los reales — no tiene
    // sentido renombrar ahí (el cambio ni siquiera se vería reflejado en pantalla).
    if (this.servicio.demoActivo()) return;
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
    if (this.servicio.carreraEnCurso() || this.servicio.demoActivo()) return;
    this.detenerAutomatico();
    this.servicio.desbloquearInscripciones();
    this.mostrarInscripciones.set(true);
  }

  // --- Demo "🧪 Pruebas" ---
  // Corre una carrera de mentira sobre el mismo tablero, solo para enseñar
  // cómo funciona. No toca Registro/Acumuladas/Historial reales.

  /**
   * Botón "🧪 Pruebas": pasa a elegir Manual/Automático. Bloqueado desde que
   * se presiona "Jugar" (bloqueado === true) hasta que termina la carrera real
   * (mazoVacio) — no hace falta esperar a la primera carta ni a "Reiniciar".
   */
  abrirPruebas(): void {
    if (this.servicio.bloqueado() && !this.servicio.mazoVacio()) return;
    this.panelPruebas.set('eligiendo-modo');
  }

  cancelarPruebas(): void {
    this.panelPruebas.set('inactivo');
  }

  elegirManualDemo(): void {
    this.servicio.iniciarDemo();
    this.modoDemoAutomatico.set(false);
    this.panelPruebas.set('inactivo');
  }

  irAVelocidadesDemo(): void {
    this.panelPruebas.set('eligiendo-velocidad');
  }

  elegirVelocidadDemo(velocidadMs: number): void {
    this.detenerAutomaticoDemo();
    this.servicio.iniciarDemo();
    this.modoDemoAutomatico.set(true);
    this.panelPruebas.set('inactivo');
    this.intervaloDemoId = setInterval(() => this.servicio.cantarCartaDemo(), velocidadMs);
  }

  cantarCartaDemo(): void {
    this.servicio.cantarCartaDemo();
  }

  detenerAutomaticoDemo(): void {
    if (this.intervaloDemoId !== null) {
      clearInterval(this.intervaloDemoId);
      this.intervaloDemoId = null;
    }
    this.modoDemoAutomatico.set(false);
  }

  /** Botón "Listo" tras ver al ganador de la demo: la deja como recién arrancada (como un F5). */
  finalizarDemo(): void {
    this.detenerAutomaticoDemo();
    this.servicio.finalizarDemo();
    this.panelPruebas.set('inactivo');
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
    this.detenerAutomaticoDemo();
    this.sesion.cerrarSesion();
    this.router.navigateByUrl('/login');
  }
}
