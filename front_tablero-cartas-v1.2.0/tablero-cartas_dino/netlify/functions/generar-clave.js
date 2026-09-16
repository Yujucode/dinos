// Función PROGRAMADA (Netlify Scheduled Functions) que genera una CLAVE
// nueva al azar todos los días a las 3:00am hora de Perú (08:00 UTC) y la
// guarda en Netlify Blobs. El USUARIO no rota — es fijo, configurado en la
// variable de entorno GAME_USERNAME (Site settings → Environment variables)
// — solo la CLAVE cambia sola cada día. Así Roberto controla el acceso
// diario sin tocar código: cada mañana hay una clave nueva que reparte a
// quien vaya a usar la app ese día, y la de ayer deja de servir sola.
//
// Nota técnica: las funciones programadas de Netlify necesitan el formato
// moderno (export default + export const config), a diferencia de
// registrar-partida.js/ver-conteos.js/login.js que usan el formato clásico
// "exports.handler" — por eso esta función se ve un poco distinta a las
// demás. El siguiente horario de corrida llega en el propio evento, pero acá
// no hace falta leerlo.

import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

// Sin 0/O/1/l/I para que la clave sea fácil de leer y escribir a mano.
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const LARGO_CLAVE = 8;

function generarClaveAleatoria() {
  const bytes = crypto.randomBytes(LARGO_CLAVE);
  let clave = '';
  for (let i = 0; i < LARGO_CLAVE; i++) {
    clave += CHARSET[bytes[i] % CHARSET.length];
  }
  return clave;
}

export default async () => {
  const store = getStore('credenciales-juego');
  const clave = generarClaveAleatoria();

  await store.setJSON('actual', {
    clave,
    generadaEn: new Date().toISOString(),
  });

  console.log('Clave del día regenerada correctamente.');
};

export const config = {
  // 08:00 UTC = 3:00am hora de Perú (UTC-5, Perú no usa horario de verano).
  schedule: '0 8 * * *',
};
