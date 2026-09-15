import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { PartidaHistorial, TableroService } from '../../services/tablero';

interface PartidaNumerada extends PartidaHistorial {
  numero: number;
}

/**
 * Se usa embebido como pestaña "📊 Historial" dentro del modal Registro (ver
 * `Inscripciones`) — ya no es su propio modal, por eso no tiene fondo/panel
 * ni botón de cerrar propios.
 */
@Component({
  selector: 'app-historial',
  standalone: true,
  templateUrl: './historial.html',
  styleUrl: './historial.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Historial {
  constructor(readonly servicio: TableroService) {}

  /** Numeradas en orden cronológico real (#1 = la más vieja), pero mostradas más reciente primero. */
  readonly partidasNumeradas = computed<PartidaNumerada[]>(() =>
    this.servicio
      .historialPartidas()
      .map((p, i) => ({ ...p, numero: i + 1 }))
      .reverse()
  );

  formatearFecha(fechaIso: string): string {
    try {
      return new Date(fechaIso).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fechaIso;
    }
  }

  /** Arma el .txt en orden cronológico (la más vieja primero, como un log) y lo descarga. */
  descargarTxt(): void {
    const partidas = this.servicio.historialPartidas();
    if (partidas.length === 0) {
      alert('Todavía no hay ninguna partida registrada en el historial.');
      return;
    }

    const lineas: string[] = [];
    lineas.push('RaceDinos — historial de partidas');
    lineas.push(`Generado: ${this.formatearFecha(new Date().toISOString())}`);
    lineas.push('='.repeat(50));
    lineas.push('');

    partidas.forEach((p, i) => {
      lineas.push(`--- Partida #${i + 1} — ${this.formatearFecha(p.fecha)} ---`);
      lineas.push(`Dino ganador: ${p.dinoGanador}`);
      lineas.push(`Filas jugadas: ${p.filasJugadas}`);
      lineas.push(`Valor/puesto: ${p.valorPuesto} | Premio por celda: ${p.premioPorCelda}`);
      if (p.ganadores.length === 0) {
        lineas.push('Ganadores: nadie se inscribió al dino ganador — nada que pagar.');
      } else {
        lineas.push('Ganadores:');
        for (const g of p.ganadores) {
          lineas.push(`  - ${g.nombre}: ${g.celdas} x ${p.premioPorCelda} = ${g.premio}`);
        }
      }
      lineas.push('');
    });

    const contenido = lineas.join('\n');
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    const fechaArchivo = new Date().toISOString().slice(0, 10);
    enlace.download = `racedinos-historial-${fechaArchivo}.txt`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  borrarConfirmando(): void {
    const confirmado = confirm(
      '¿Seguro que quieres borrar TODO el historial de partidas? Esta acción no se puede deshacer. Descarga el .txt antes si quieres guardarlo.'
    );
    if (!confirmado) return;
    this.servicio.borrarHistorialPartidas();
  }
}
