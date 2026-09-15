// Función serverless (Netlify Functions) de solo lectura para el panel de
// administración: devuelve el conteo de partidas de TODOS los streamers
// guardados en Netlify Blobs. Protegida con una contraseña simple que se
// configura como variable de entorno PANEL_PASSWORD en el sitio de Netlify
// (Site settings → Environment variables) — así Roberto puede cambiarla
// cuando quiera desde el dashboard, sin tocar código ni tener que republicar.

const { getStore } = require('@netlify/blobs');

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

  try {
    const store = getStore('conteos-streamers');
    const { blobs } = await store.list();

    const streamers = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));

    streamers.sort((a, b) => (b?.totalPartidas ?? 0) - (a?.totalPartidas ?? 0));

    return respuesta({ streamers: streamers.filter(Boolean) }, 200);
  } catch (err) {
    console.error('ver-conteos error:', err);
    return respuesta({ error: 'Error interno al leer los conteos' }, 500);
  }
};
