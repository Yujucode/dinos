import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Jugador } from '../../models/jugador';
import { AvatarDino } from '../avatar-dino/avatar-dino';

@Component({
  selector: 'app-jugador-ficha',
  standalone: true,
  imports: [FormsModule, AvatarDino],
  templateUrl: './jugador-ficha.html',
  styleUrl: './jugador-ficha.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JugadorFicha {
  jugador = input.required<Jugador>();
  espaciosMeta = input<number>(8);
  esGanador = input<boolean>(false);

  renombrar = output<string>();

  // Ojo: son espaciosMeta() celdas (no +1). La ficha se mueve en pasos de
  // 1/espaciosMeta del alto de la pista (ver `porcentaje`), así que las
  // celdas decorativas tienen que dividirse en esa misma cantidad de partes
  // iguales para que cada límite de celda coincida con un paso de la ficha
  // — si no, se desalinean (después de 1 casillero parece que avanzó 1 y medio).
  readonly celdas = computed(() => Array.from({ length: this.espaciosMeta() }, (_, i) => i));

  readonly porcentaje = computed(
    () => (this.jugador().posicion / this.espaciosMeta()) * 100
  );

  onNombreChange(valor: string): void {
    this.renombrar.emit(valor);
  }
}
