export type Especie =
  | 'triceratops'
  | 'trex'
  | 'braquiosaurio'
  | 'estegosaurio'
  | 'pterodactilo'
  | 'velociraptor'
  | 'anquilosaurio';

export interface Jugador {
  id: number;
  nombre: string;
  especie: Especie;
  color: string;
  colorClaro: string;
  posicion: number; // 0 = partida, 8 = meta
}

export interface CartaCantada {
  valor: number; // 1 al 7 (As = 1)
  palo: 'corazones' | 'trebol' | 'diamante' | 'picas';
}

export interface Inscripcion {
  nombre: string;
  dinosaurioId: number;
  pagadoConGanancias?: boolean;
}
