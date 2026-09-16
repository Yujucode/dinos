// Función del panel: prende o apaga la suspensión de acceso al juego.
// Protegida con la misma contraseña del panel (PANEL_PASSWORD) que ya usan
// ver-conteos y ver-credenciales. El estado se guarda en Netlify Blobs y lo
// lee tanto login.js (bloquea logins nuevos) como estado-acceso.js (revisión
// periódica de la app, para sacar a quienes ya estaban adentro).

const { getStore, connectLambda } = require('@netlify/blobs');

function respuesta(body, statusCode) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-panel-password',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod === 'OPTIONS') {
    return respuesta({}, 204);
  }

  if (event.httpMethod !== 'POST') {
    return respuesta({ error: 'Método no permitido' }, 405);
  }

  const passwordEsperado = process.env.PANEL_PASSWORD;
  if (!passwordEsperado) {
    return respuesta(
      { error: 'El sitio no tiene configurada la variable de entorno PANEL_PASSWORD.' },
      500,
    );
  }

  const passwordRecibido = event.headers['x-panel-password'] || '';
  if (passwordRecibido !== passwordEsperado) {
    return respuesta({ error: 'Contraseña incorrecta' }, 401);
  }

  let datos;
  try {
    datos = JSON.parse(event.body || '{}');
  } catch {
    return respuesta({ error: 'JSON inválido' }, 400);
  }

  if (typeof datos.suspendido !== 'boolean') {
    return respuesta({ error: 'Falta el campo "suspendido" (true/false)' }, 400);
  }

  try {
    const store = getStore('credenciales-juego');
    await store.setJSON('estado', {
      suspendido: datos.suspendido,
      actualizadoEn: new Date().toISOString(),
    });
    return respuesta({ ok: true, suspendido: datos.suspendido }, 200);
  } catch (err) {
    console.error('panel-suspender error:', err);
    return respuesta({ error: 'Error interno al guardar el estado' }, 500);
  }
};
