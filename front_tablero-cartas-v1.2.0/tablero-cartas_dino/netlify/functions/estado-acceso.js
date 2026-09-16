// Función pública (no pide contraseña) que dice si el acceso al juego está
// suspendido en este momento. La usan dos partes distintas:
//   1. login.js, para no dejar entrar a nadie nuevo mientras está suspendido.
//   2. La propia app del juego (revisión periódica cada cierto tiempo),
//      para sacar también a quienes ya habían entrado antes de suspenderlo.
// No lleva contraseña porque cualquier cliente del juego ya logueado
// necesita poder preguntarlo sin tener la clave del panel.

const { getStore, connectLambda } = require('@netlify/blobs');

function respuesta(body, statusCode) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
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

  try {
    const store = getStore('credenciales-juego');
    const estado = await store.get('estado', { type: 'json' });
    return respuesta({ suspendido: estado?.suspendido === true }, 200);
  } catch (err) {
    console.error('estado-acceso error:', err);
    // Si falla la lectura, no se bloquea a nadie por un error interno nuestro.
    return respuesta({ suspendido: false }, 200);
  }
};
