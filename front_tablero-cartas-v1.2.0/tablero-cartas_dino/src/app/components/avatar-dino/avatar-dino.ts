import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Especie } from '../../models/jugador';

const IMAGEN_POR_ESPECIE: Record<Especie, string> = {
  triceratops: 'dinos/cornelio.png',
  trex: 'dinos/goodzilla.png',
  braquiosaurio: 'dinos/cuellolargo.png',
  estegosaurio: 'dinos/espinoso.png',
  pterodactilo: 'dinos/alitas.png',
  velociraptor: 'dinos/manchitas.png',
  anquilosaurio: 'dinos/puas.png',
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
