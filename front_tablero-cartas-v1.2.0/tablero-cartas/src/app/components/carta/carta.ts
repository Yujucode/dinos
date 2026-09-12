import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CartaCantada } from '../../models/jugador';

const SIMBOLOS: Record<CartaCantada['palo'], string> = {
  corazones: '♥',
  diamante: '♦',
  trebol: '♣',
  picas: '♠',
};

const VALORES: Record<number, string> = { 1: 'A' };

@Component({
  selector: 'app-carta',
  standalone: true,
  templateUrl: './carta.html',
  styleUrl: './carta.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Carta {
  carta = input<CartaCantada | null>(null);

  readonly esRoja = computed(
    () => this.carta()?.palo === 'corazones' || this.carta()?.palo === 'diamante'
  );

  readonly simbolo = computed(() =>
    this.carta() ? SIMBOLOS[this.carta()!.palo] : ''
  );

  readonly etiquetaValor = computed(() => {
    const c = this.carta();
    if (!c) return '';
    return VALORES[c.valor] ?? String(c.valor);
  });
}
