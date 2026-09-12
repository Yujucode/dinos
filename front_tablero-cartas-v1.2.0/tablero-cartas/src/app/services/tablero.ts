import { Injectable, signal, computed, effect } from '@angular/core';
import { Jugador, CartaCantada, Especie, Inscripcion } from '../models/jugador';

const PALETA: { color: string; colorClaro: string; especie: Especie; nombre: string }[] = [
  { color: '#E8397F', colorClaro: '#FBC7DE', especie: 'triceratops', nombre: 'Cornelio' },
  { color: '#F2872E', colorClaro: '#FBD3AE', especie: 'trex', nombre: 'Goodzilla' },
  { color: '#E8C21A', colorClaro: '#F7E8A6', especie: 'braquiosaurio', nombre: 'Cuellolargo' },
  { color: '#4FA83D', colorClaro: '#BFE3B4', especie: 'estegosaurio', nombre: 'Espinoso' },
  { color: '#2E9DCC', colorClaro: '#B7E1F2', especie: 'pterodactilo', nombre: 'Alitas' },
  { color: '#7A4FD1', colorClaro: '#D3C2F2', especie: 'velociraptor', nombre: 'Manchitas' },
  { color: '#D1393B', colorClaro: '#F2B9BA', especie: 'anquilosaurio', nombre: 'Puas' },
];

const PALOS: CartaCantada['palo'][] = ['corazones', 'trebol', 'diamante', 'picas'];

const ESPACIOS_META = 8;
const MAX_DORSOS_VISIBLES = 2;
const VALOR_PUESTO_INICIAL = 5;
// premio por celda ganadora = valorPuesto x CUOTA_FIJA (ver fórmula acordada).
const CUOTA_FIJA = 6;
const LLAVE_LOCALSTORAGE = 'tablero-cartas:ganancias';

function jugadoresIniciales(): Jugador[] {
  return PALETA.map((p, i) => ({
    id: i + 1,
    nombre: p.nombre,
    especie: p.especie,
    color: p.color,
    colorClaro: p.colorClaro,
    posicion: 0,
  }));
}

/**
 * Mazo fijo de 56 cartas: para cada valor del 1 al 7, las 4 pintas,
 * repetido 2 veces (7 x 4 x 2 = 56). No se baraja de entrada — cada
 * tirada elige un índice al azar de lo que queda (ver cantarCarta()).
 */
function cartasFijas(): CartaCantada[] {
  const cartas: CartaCantada[] = [];
  for (let valor = 1; valor <= 7; valor++) {
    for (let copia = 0; copia < 2; copia++) {
      for (const palo of PALOS) {
        cartas.push({ valor, palo });
      }
    }
  }
  return cartas;
}

function cargarGananciasGuardadas(): Record<string, number> {
  try {
    const crudo = localStorage.getItem(LLAVE_LOCALSTORAGE);
    return crudo ? JSON.parse(crudo) : {};
  } catch {
    return {};
  }
}

export interface ResultadoInscripcion {
  nombre: string;
  celdas: number;
  premio: number;
}

export interface ResumenParticipante {
  nombre: string;
  puestos: number;
}

export interface ResumenGanancia {
  nombre: string;
  puntos: number;
}

@Injectable({ providedIn: 'root' })
export class TableroService {
  readonly espaciosMeta = ESPACIOS_META;

  private readonly mazo = signal<CartaCantada[]>(cartasFijas());

  readonly jugadores = signal<Jugador[]>(jugadoresIniciales());
  readonly cartaActual = signal<CartaCantada | null>(null);
  readonly historial = signal<CartaCantada[]>([]);
  readonly rondas = signal<number>(0);

  readonly cartasRestantes = computed(() => this.mazo().length);
  readonly mazoVacio = computed(() => this.mazo().length === 0);

  /**
   * true solo mientras la carrera está efectivamente en curso: desde que sale
   * la primera carta hasta que se acaba el mazo. Entre presionar "Jugar" y que
   * salga la primera carta todavía NO cuenta como "en curso" — en esa ventana
   * el botón Registro se mantiene habilitado por si se quiere volver a editar.
   */
  readonly carreraEnCurso = computed(() => this.historial().length > 0 && !this.mazoVacio());

  /** Cuántos "dorsos" de adorno mostrar detrás de la carta actual (máx. 2). */
  readonly dorsosVisibles = computed(() =>
    Array.from({ length: Math.min(MAX_DORSOS_VISIBLES, this.mazo().length) }, (_, i) => i)
  );

  /** El primer jugador que llegó a la meta, cronológicamente (queda fijo, no cambia). */
  readonly primerGanador = signal<Jugador | null>(null);

  readonly jugadoresEnMeta = computed(
    () => this.jugadores().filter((j) => j.posicion >= ESPACIOS_META).length
  );

  // --- Inscripciones / apuestas de la carrera actual ---

  readonly cuotaFija = CUOTA_FIJA;
  readonly valorPuesto = signal<number>(VALOR_PUESTO_INICIAL);
  readonly bloqueado = signal<boolean>(false);
  readonly inscripciones = signal<Inscripcion[]>([]);

  /**
   * Todo el Registro (inscripciones, Participantes y Acumuladas) queda
   * "congelado" (solo lectura, nada de arrastrar/editar) mientras la carrera
   * está activa (bloqueado === true) Y TAMBIÉN una vez que el mazo se agota,
   * hasta que se presione "Reiniciar" — momento en el que `reiniciar()` limpia
   * todo de una. Antes de iniciar la carrera (o si se reabre el Registro a
   * mitad de carrera con `desbloquearInscripciones`) queda editable.
   */
  readonly inscripcionesCongeladas = computed(() => this.bloqueado() || this.mazoVacio());
  private gananciasAplicadas = false;

  /** Resumen para la sección "Participantes": solo nombre y cuántos puestos tiene esta carrera. */
  readonly resumenParticipantes = computed<ResumenParticipante[]>(() => {
    const conteo: Record<string, number> = {};
    for (const insc of this.inscripciones()) {
      conteo[insc.nombre] = (conteo[insc.nombre] ?? 0) + 1;
    }
    return Object.entries(conteo).map(([nombre, puestos]) => ({ nombre, puestos }));
  });

  /** Cuando ya hay ganador, agrupa por nombre dentro de esa columna y calcula el premio. */
  readonly resultadosFinales = computed<ResultadoInscripcion[]>(() => {
    const ganador = this.primerGanador();
    if (!ganador) return [];

    const conteoPorNombre: Record<string, number> = {};
    for (const insc of this.inscripciones()) {
      if (insc.dinosaurioId === ganador.id) {
        conteoPorNombre[insc.nombre] = (conteoPorNombre[insc.nombre] ?? 0) + 1;
      }
    }

    const premioPorCelda = this.valorPuesto() * CUOTA_FIJA;
    return Object.entries(conteoPorNombre)
      .map(([nombre, celdas]) => ({ nombre, celdas, premio: celdas * premioPorCelda }))
      .sort((a, b) => b.premio - a.premio);
  });

  /** Cuántas celdas tiene cada dino — para validar la regla de "todos iguales". */
  private readonly conteoPorDino = computed(() =>
    this.jugadores().map((j) => this.inscripciones().filter((i) => i.dinosaurioId === j.id).length)
  );

  /** Nombres con Acumulado en negativo (deben corregirse a mano antes de poder jugar). */
  readonly nombresConAcumuladoNegativo = computed(() =>
    Object.entries(this.ganancias())
      .filter(([, valor]) => valor < 0)
      .map(([nombre]) => nombre)
  );

  /** No se puede iniciar si hay algún acumulado negativo, no hay inscritos, o los 7 dinos no tienen la misma cantidad. */
  readonly puedeIniciar = computed(() => {
    if (this.nombresConAcumuladoNegativo().length > 0) return false;
    const conteos = this.conteoPorDino();
    if (conteos.some((c) => c === 0)) return false;
    return conteos.every((c) => c === conteos[0]);
  });

  readonly motivoNoPuedeIniciar = computed(() => {
    const negativos = this.nombresConAcumuladoNegativo();
    if (negativos.length > 0) {
      return `neg: ${negativos.join(', ')}`;
    }
    return '';
  });

  /** Todas las celdas (nombres, sin agrupar — se repiten si alguien tiene varios puestos) por dino. */
  readonly celdasPorDino = computed<Partial<Record<number, string[]>>>(() => {
    const resultado: Record<number, string[]> = {};
    for (const insc of this.inscripciones()) {
      if (!resultado[insc.dinosaurioId]) resultado[insc.dinosaurioId] = [];
      resultado[insc.dinosaurioId].push(insc.nombre);
    }
    return resultado;
  });

  // --- Ganancias acumuladas (persistidas en localStorage entre partidas) ---

  readonly ganancias = signal<Record<string, number>>(cargarGananciasGuardadas());

  /** Se muestran TODOS los registrados en Acumuladas, incluido 0 y negativo (para "eliminar" ser la única forma de sacarlos de la lista). */
  readonly resumenGanancias = computed<ResumenGanancia[]>(() =>
    Object.entries(this.ganancias()).map(([nombre, puntos]) => ({ nombre, puntos }))
  );

  constructor() {
    // Persistir ganancias en localStorage cada vez que cambian.
    effect(() => {
      const datos = this.ganancias();
      try {
        localStorage.setItem(LLAVE_LOCALSTORAGE, JSON.stringify(datos));
      } catch {
        // localStorage no disponible (modo incógnito, etc.) — se ignora.
      }
    });

    // Apenas se resuelve la carrera, se acreditan los premios una sola vez.
    effect(() => {
      const resultados = this.resultadosFinales();
      if (resultados.length === 0 || this.gananciasAplicadas) return;

      this.ganancias.update((g) => {
        const copia = { ...g };
        for (const r of resultados) {
          copia[r.nombre] = (copia[r.nombre] ?? 0) + r.premio;
        }
        return copia;
      });
      this.gananciasAplicadas = true;
    });
  }

  inscribir(nombre: string, dinosaurioId: number, pagadoConGanancias = false): void {
    const limpio = nombre.trim();
    if (!limpio) return;
    this.inscripciones.update((lista) => [
      ...lista,
      { nombre: limpio, dinosaurioId, pagadoConGanancias },
    ]);
  }

  /**
   * Inscribe un puesto y descuenta el valor/puesto del Acumulado de esa
   * persona — siempre, sin bloquear aunque no le alcance (puede quedar en
   * negativo; eso se avisa aparte y traba el botón "Jugar" hasta corregirlo,
   * ver `puedeIniciar`/`nombresConAcumuladoNegativo`).
   */
  inscribirConDescuento(nombre: string, dinosaurioId: number): void {
    if (this.inscripcionesCongeladas()) return;
    const limpio = nombre.trim();
    if (!limpio) return;
    const costo = this.valorPuesto();
    this.ganancias.update((g) => ({ ...g, [limpio]: (g[limpio] ?? 0) - costo }));
    this.inscribir(limpio, dinosaurioId, true);
  }

  /**
   * Suma (no sobrescribe) un monto al acumulado de alguien — para cargarle
   * saldo nuevo (incluido 0, para solo darlo de alta) o para guardarle lo que
   * le sobró de un monto ofrecido y no llegó a jugar. Crea la entrada si esa
   * persona todavía no aparecía. No admite montos negativos.
   */
  sumarGanancia(nombre: string, monto: number): void {
    if (this.inscripcionesCongeladas()) return;
    const limpio = nombre.trim();
    if (!limpio || monto < 0) return;
    this.ganancias.update((g) => ({ ...g, [limpio]: (g[limpio] ?? 0) + monto }));
  }

  /** Quita una inscripción y siempre devuelve el valor/puesto a esa persona (todo puesto se paga con Acumulado). */
  quitarInscripcion(indiceGlobal: number): void {
    if (this.inscripcionesCongeladas()) return;
    const eliminada = this.inscripciones()[indiceGlobal];
    if (!eliminada) return;

    this.inscripciones.update((lista) => lista.filter((_, i) => i !== indiceGlobal));

    const costo = this.valorPuesto();
    this.ganancias.update((g) => ({ ...g, [eliminada.nombre]: (g[eliminada.nombre] ?? 0) + costo }));
  }

  ajustarValorPuesto(nuevoValor: number): void {
    if (this.inscripcionesCongeladas() || nuevoValor <= 0) return;
    this.valorPuesto.set(nuevoValor);
  }

  /** Se llama al presionar "Jugar": valida la regla de inscripción y bloquea. */
  jugar(): boolean {
    if (!this.puedeIniciar()) return false;
    this.bloqueado.set(true);
    return true;
  }

  /**
   * Reabre las inscripciones a mitad (o al final) de la carrera para poder
   * modificar cualquier cosa a último momento — no toca el mazo, las
   * posiciones ni el historial, solo desbloquea el modal. Hay que volver a
   * presionar "Jugar" para retomar.
   */
  desbloquearInscripciones(): void {
    this.bloqueado.set(false);
  }

  /** Edición manual de ganancias (ej. para regalarle puntos a alguien). Sobrescribe el total. */
  editarGanancia(nombre: string, nuevoValor: number): void {
    if (nuevoValor < 0) return;
    this.ganancias.update((g) => ({ ...g, [nombre]: nuevoValor }));
  }

  /**
   * Botón "sumar": suma un incremento (puede ser negativo, para restar) al
   * acumulado YA EXISTENTE de alguien, en vez de sobrescribirlo. El resultado
   * puede quedar en negativo — se corrige después a mano si hace falta.
   */
  ajustarGananciaSumando(nombre: string, incremento: number): void {
    if (this.inscripcionesCongeladas()) return;
    const limpio = nombre.trim();
    if (!limpio || Number.isNaN(incremento)) return;
    this.ganancias.update((g) => ({ ...g, [limpio]: (g[limpio] ?? 0) + incremento }));
  }

  /**
   * Botón "Upd": actualiza nombre y/o monto de una fila de Acumuladas de una.
   * Si el nombre cambia, también se renombra en sus puestos activos del
   * Registro, para no dejarlos huérfanos bajo el nombre viejo.
   */
  actualizarAcumulado(nombreOriginal: string, nuevoNombre: string, nuevoMonto: number): void {
    if (this.inscripcionesCongeladas()) return;
    const limpio = nuevoNombre.trim();
    if (!limpio || Number.isNaN(nuevoMonto)) return;

    this.ganancias.update((g) => {
      const copia = { ...g };
      delete copia[nombreOriginal];
      copia[limpio] = nuevoMonto;
      return copia;
    });

    if (limpio !== nombreOriginal) {
      this.inscripciones.update((lista) =>
        lista.map((i) => (i.nombre === nombreOriginal ? { ...i, nombre: limpio } : i))
      );
    }
  }

  /**
   * Limpia la lista de participantes de esta carrera, devolviendo a cada uno
   * el valor/puesto que se le había descontado por cada uno de sus puestos
   * (todo puesto se paga con Acumulado, así que se le reembolsa todo).
   */
  borrarParticipantes(): void {
    if (this.inscripcionesCongeladas()) return;
    const costo = this.valorPuesto();
    this.ganancias.update((g) => {
      const copia = { ...g };
      for (const insc of this.inscripciones()) {
        copia[insc.nombre] = (copia[insc.nombre] ?? 0) + costo;
      }
      return copia;
    });
    this.inscripciones.set([]);
  }

  /**
   * Elimina a UNA sola persona: la saca de Acumuladas (localStorage incluido,
   * vía el effect de persistencia) y, si tenía puestos activos en el Registro
   * de esta carrera, también se los quita — para que no quede un puesto sin
   * dueño. No afecta a nadie más.
   */
  eliminarDeGanancias(nombre: string): void {
    if (this.inscripcionesCongeladas()) return;
    this.ganancias.update((g) => {
      const copia = { ...g };
      delete copia[nombre];
      return copia;
    });
    this.inscripciones.update((lista) => lista.filter((i) => i.nombre !== nombre));
  }

  /** Borra TODAS las ganancias acumuladas, incluido lo guardado en localStorage. */
  borrarTodoElHistorial(): void {
    if (this.inscripcionesCongeladas()) return;
    this.ganancias.set({});
    try {
      localStorage.removeItem(LLAVE_LOCALSTORAGE);
    } catch {
      // se ignora si no hay localStorage disponible
    }
  }

  cantarCarta(): void {
    const mazoActual = this.mazo();
    if (mazoActual.length === 0) return; // ya no quedan cartas — nada más que hacer

    // Random adicional sobre lo que queda, en cada tirada.
    const indice = Math.floor(Math.random() * mazoActual.length);
    const carta = mazoActual[indice];
    const restante = [...mazoActual.slice(0, indice), ...mazoActual.slice(indice + 1)];
    this.mazo.set(restante);

    this.cartaActual.set(carta);
    this.historial.update((h) => [...h, carta]);
    this.rondas.update((r) => r + 1);

    let jugadorQueLlego: Jugador | null = null;
    this.jugadores.update((jugadores) =>
      jugadores.map((j) => {
        if (j.id === carta.valor && j.posicion < ESPACIOS_META) {
          const actualizado = { ...j, posicion: j.posicion + 1 };
          if (actualizado.posicion >= ESPACIOS_META) {
            jugadorQueLlego = actualizado;
          }
          return actualizado;
        }
        return j;
      })
    );

    if (jugadorQueLlego && this.primerGanador() === null) {
      this.primerGanador.set(jugadorQueLlego);
    }
  }

  renombrar(id: number, nuevoNombre: string): void {
    const limpio = nuevoNombre.trim();
    if (!limpio) return;
    this.jugadores.update((jugadores) =>
      jugadores.map((j) => (j.id === id ? { ...j, nombre: limpio } : j))
    );
  }

  reiniciar(): void {
    this.mazo.set(cartasFijas());
    this.jugadores.set(jugadoresIniciales());
    this.cartaActual.set(null);
    this.historial.set([]);
    this.rondas.set(0);
    this.primerGanador.set(null);
    this.inscripciones.set([]);
    this.bloqueado.set(false);
    this.gananciasAplicadas = false;
  }
}
