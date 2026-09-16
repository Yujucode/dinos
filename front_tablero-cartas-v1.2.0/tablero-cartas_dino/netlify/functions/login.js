// Función serverless que valida el login de acceso al juego. El USUARIO es
// fijo (variable de entorno GAME_USERNAME) y la CONTRASEÑA es la que se
// regenera sola cada día a las 3am (ver generar-clave.js), guardada en
// Netlify Blobs. Si todavía no existe ninguna clave guardada (por ejemplo,
// recién publicado el sitio, antes de la primera corrida programada de las
// 3am), esta función genera una de una vez para no dejar a nadie bloqueado.

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
      'Access-Control-Allow-Headers': 'Content-Type',
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

  const usuarioEsperado = process.env.GAME_USERNAME;
  if (!usuarioEsperado) {
    return respuesta(
      { error: 'El sitio no tiene configurada la variable de entorno GAME_USERNAME.' },
      500,
    );
  }

  try {
    const storeEstado = getStore('credenciales-juego');
    const estado = await storeEstado.get('estado', { type: 'json' });
    if (estado?.suspendido === true) {
      return respuesta({ error: 'Acceso temporalmente suspendido.' }, 403);
    }
  } catch (err) {
    console.error('login: error al revisar el estado de suspensión:', err);
    // Si falla la lectura del estado, no se bloquea el login por un error nuestro.
  }

  let datos;
  try {
    datos = JSON.parse(event.body || '{}');
  } catch {
    return respuesta({ error: 'JSON inválido' }, 400);
  }

  const usuario = typeof datos.usuario === 'string' ? datos.usuario.trim() : '';
  const contrasena = typeof datos.contrasena === 'string' ? datos.contrasena.trim() : '';

  if (!usuario || !contrasena) {
    return respuesta({ error: 'Ingresa usuario y contraseña' }, 400);
  }

  try {
    const store = getStore('credenciales-juego');
    let actual = await store.get('actual', { type: 'json' });

    if (!actual) {
      // Todavía no corrió la generación programada de las 3am — se crea una
      // ahora mismo para no dejar a nadie sin poder entrar.
      actual = { clave: generarClaveAleatoria(), generadaEn: new Date().toISOString() };
      await store.setJSON('actual', actual);
    }

    if (usuario !== usuarioEsperado || contrasena !== actual.clave) {
      return respuesta({ error: 'Usuario o contraseña incorrectos' }, 401);
    }

    return respuesta({ ok: true }, 200);
  } catch (err) {
    console.error('login error:', err);
    return respuesta({ error: 'Error interno al validar el acceso' }, 500);
  }
};
