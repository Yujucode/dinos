import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Especie } from '../../models/jugador';

const IMAGEN_POR_ESPECIE: Record<Especie, string> = {
  triceratops: 'dinos/rayo.png',
  trex: 'dinos/mack.png',
  braquiosaurio: 'dinos/tex.png',
  estegosaurio: 'dinos/chick.png',
  pterodactilo: 'dinos/King.png',
  velociraptor: 'dinos/doc.png',
  anquilosaurio: 'dinos/sally.png',
};

@Component({
  selector: 'app-avatar-dino',
  standalone: true,
  templateUrl: './avatar-dino.html',
  styleUrl: './avatar-dino.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarDino {
  especie = input.required<Especie>();
  color = input.required<string>();
  colorClaro = input<string>('');
  size = input<number>(34);

  readonly src = computed(() => IMAGEN_POR_ESPECIE[this.especie()]);
}
