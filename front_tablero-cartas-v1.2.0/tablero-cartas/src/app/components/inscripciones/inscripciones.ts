import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableroService } from '../../services/tablero';
import { AvatarDino } from '../avatar-dino/avatar-dino';

@Component({
  selector: 'app-inscripciones',
  standalone: true,
  imports: [FormsModule, AvatarDino],
  templateUrl: './inscripciones.html',
  styleUrl: './inscripciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inscripciones {
  cerrar = output<void>();

  editandoGanancia = signal<string | null>(null);
  valorEdicion = signal<number>(0);

  // --- Botón "Upd": edita nombre y monto de una fila de Acumuladas a la vez ---
  editandoUpd = signal<string | null>(null);
  nombreUpdEdicion = signal('');
  montoUpdEdicion = signal<number>(0);

  ocultarParticipantes = signal(false);
  ocultarGanancias = signal(false);

  // --- Editar el multiplicador Valor/puesto (queda bloqueado salvo que se edite) ---
  editandoValorPuesto = signal(false);
  valorPuestoEdicion = signal<number>(0);

  // --- Agregar saldo nuevo a alguien en Acumuladas (persona nueva o "vuelto") ---
  nombreNuevoAcumulado = signal('');
  montoNuevoAcumulado = signal<number>(0);

  constructor(readonly servicio: TableroService) {}

  nombresDe(dinosaurioId: number): string[] {
    return this.servicio
      .inscripciones()
      .filter((i) => i.dinosaurioId === dinosaurioId)
      .map((i) => i.nombre);
  }

  /**
   * Crea el puesto (llamado al arrastrar, ver `onDrop`). Ya no hay forma de
   * escribir un nombre directo en una columna — todos los nombres nacen en
   * Acumuladas y de ahí se arrastran a los dinos. Cada puesto descuenta el
   * valor/puesto del Acumulado de esa persona (puede quedar en negativo; eso
   * se corrige a mano en Acumuladas y traba "Jugar" hasta hacerlo).
   */
  private registrarPuesto(nombre: string, dinosaurioId: number): void {
    if (this.servicio.inscripcionesCongeladas()) return;
    const limpio = nombre.trim();
    if (!limpio) return;
    this.servicio.inscribirConDescuento(limpio, dinosaurioId);
  }

  /** true si ese nombre ya tiene fila en Acumuladas — para no crear dos filas iguales ahí. */
  private existeEnAcumulado(nombre: string): boolean {
    const limpio = nombre.trim().toLowerCase();
    return Object.keys(this.servicio.ganancias()).some((n) => n.toLowerCase() === limpio);
  }

  onValorPuestoChange(valor: string): void {
    const nuevo = Number(valor);
    if (!Number.isNaN(nuevo)) {
      this.servicio.ajustarValorPuesto(nuevo);
    }
  }

  empezarEdicionValorPuesto(): void {
    this.valorPuestoEdicion.set(this.servicio.valorPuesto());
    this.editandoValorPuesto.set(true);
  }

  guardarValorPuesto(): void {
    this.onValorPuestoChange(String(this.valorPuestoEdicion()));
    this.editandoValorPuesto.set(false);
  }

  /**
   * Da de alta a alguien en Acumuladas. El monto tiene que ser 0 (para solo
   * registrarlo, sin saldo) o un múltiplo positivo del valor/puesto actual —
   * nunca negativo.
   */
  agregarAcumulado(): void {
    const nombre = this.nombreNuevoAcumulado().trim();
    const monto = Number(this.montoNuevoAcumulado());
    if (!nombre || Number.isNaN(monto)) return;

    if (monto < 0) {
      alert('El monto no puede ser negativo.');
      return;
    }

    const valor = this.servicio.valorPuesto();
    if (monto % valor !== 0) {
      alert(`El monto debe ser 0 o un múltiplo del valor/puesto actual (${valor}).`);
      return;
    }

    if (this.existeEnAcumulado(nombre)) {
      alert(`"${nombre}" ya existe en Acumuladas. Para sumarle más, usa "editar" en su fila.`);
      return;
    }

    this.servicio.sumarGanancia(nombre, monto);
    this.nombreNuevoAcumulado.set('');
    this.montoNuevoAcumulado.set(0);
  }

  quitar(dinosaurioId: number, nombreIndiceLocal: number): void {
    const todas = this.servicio.inscripciones();
    let contador = -1;
    for (let i = 0; i < todas.length; i++) {
      if (todas[i].dinosaurioId === dinosaurioId) {
        contador++;
        if (contador === nombreIndiceLocal) {
          this.servicio.quitarInscripcion(i);
          return;
        }
      }
    }
  }

  jugar(): void {
    if (this.servicio.jugar()) {
      this.cerrar.emit();
    }
  }

  jugarDeNuevo(): void {
    this.servicio.reiniciar();
  }

  // --- Botón "sumar": suma (o resta, si es negativo) un monto al acumulado ya existente ---

  empezarSuma(nombre: string): void {
    this.editandoGanancia.set(nombre);
    this.valorEdicion.set(0);
  }

  guardarSuma(nombre: string): void {
    this.servicio.ajustarGananciaSumando(nombre, this.valorEdicion());
    this.editandoGanancia.set(null);
  }

  // --- Botón "Upd": edita nombre y monto de una fila a la vez, con confirmación ---

  empezarUpd(nombre: string, valorActual: number): void {
    this.editandoUpd.set(nombre);
    this.nombreUpdEdicion.set(nombre);
    this.montoUpdEdicion.set(valorActual);
  }

  guardarUpd(nombreOriginal: string): void {
    const nuevoNombre = this.nombreUpdEdicion().trim();
    const nuevoMonto = Number(this.montoUpdEdicion());
    if (!nuevoNombre || Number.isNaN(nuevoMonto)) return;

    if (
      nuevoNombre.toLowerCase() !== nombreOriginal.toLowerCase() &&
      this.existeEnAcumulado(nuevoNombre)
    ) {
      alert(`"${nuevoNombre}" ya existe en Acumuladas. Elige otro nombre.`);
      return;
    }

    const confirmado = confirm(
      `¿Actualizar "${nombreOriginal}" a nombre "${nuevoNombre}" con acumulado ${nuevoMonto}?`
    );
    if (!confirmado) return;

    this.servicio.actualizarAcumulado(nombreOriginal, nuevoNombre, nuevoMonto);
    this.editandoUpd.set(null);
  }

  // --- Borrar todo el localStorage, con doble confirmación ---

  borrarTodoConfirmando(): void {
    const primero = confirm(
      '¿Seguro que quieres borrar TODAS las ganancias acumuladas? Esto afecta a todos los jugadores del historial.'
    );
    if (!primero) return;

    const segundo = confirm(
      'Última confirmación: esta acción no se puede deshacer y se borrará también del almacenamiento del navegador. ¿Continuar?'
    );
    if (!segundo) return;

    this.servicio.borrarTodoElHistorial();
  }

  // --- Eliminar a una sola persona de Acumuladas ---
  // Para jugadores que ya no van a seguir jugando: se borra solo a esa
  // persona (no todo el historial), y si tenía puestos activos en el
  // Registro también se le quitan, para que no quede huérfano.

  eliminarGanancia(nombre: string): void {
    const confirmado = confirm(
      `¿Seguro que quieres eliminar a "${nombre}" de Acumuladas? Si tiene puestos activos en el Registro también se le quitarán. Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;
    this.servicio.eliminarDeGanancias(nombre);
  }

  // --- Arrastrar y soltar ---
  // Única forma de poner un nombre en un dino: arrastrando (desde Acumuladas,
  // o desde una celda ya existente para repetir a la misma persona en otro
  // dino). Un mismo dino sí puede tener varias celdas de la misma persona,
  // por eso acá no se valida duplicado.

  onDragStartCelda(evento: DragEvent, nombre: string): void {
    evento.dataTransfer?.setData('text/plain', nombre);
  }

  onDragStartGanancia(evento: DragEvent, nombre: string): void {
    evento.dataTransfer?.setData('text/plain', nombre);
  }

  onDrop(evento: DragEvent, dinosaurioId: number): void {
    evento.preventDefault();
    const nombre = evento.dataTransfer?.getData('text/plain');
    if (!nombre) return;
    this.registrarPuesto(nombre, dinosaurioId);
  }

  onDragOver(evento: DragEvent): void {
    evento.preventDefault();
  }
}
