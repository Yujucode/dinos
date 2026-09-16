// Función de solo lectura para el panel: le muestra a Roberto el usuario fijo
// y la clave del día actual (generada a las 3am), para que sepa qué repartir
// a quien vaya a usar la app ese día. Usa la misma contraseña de panel
// (PANEL_PASSWORD) que ver-conteos — un solo login del panel desbloquea todo.

const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

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

function respuesta(body, statusCode) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-panel-password',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod === 'OPTIONS') {
    return respuesta({}, 204);
  }

  if (event.httpMethod !== 'GET') {
    return respuesta({ error: 'Método no permitido' }, 405);
  }

  const passwordEsperado = process.env.PANEL_PASSWORD;
  if (!passwordEsperado) {
    return respuesta(
      { error: 'El sitio no tiene configurada la variable de entorno PANEL_PASSWORD.' },
      500,
    );
  }

  const passwordRecibido =
    event.headers['x-panel-password'] || (event.queryStringParameters || {}).password || '';

  if (passwordRecibido !== passwordEsperado) {
    return respuesta({ error: 'Contraseña incorrecta' }, 401);
  }

  const usuario = process.env.GAME_USERNAME || null;

  try {
    const store = getStore('credenciales-juego');
    let actual = await store.get('actual', { type: 'json' });

    if (!actual) {
      actual = { clave: generarClaveAleatoria(), generadaEn: new Date().toISOString() };
      await store.setJSON('actual', actual);
    }

    return respuesta({ usuario, clave: actual.clave, generadaEn: actual.generadaEn }, 200);
  } catch (err) {
    console.error('ver-credenciales error:', err);
    return respuesta({ error: 'Error interno al leer las credenciales' }, 500);
  }
};
