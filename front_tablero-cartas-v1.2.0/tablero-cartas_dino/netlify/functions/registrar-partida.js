// Función serverless (Netlify Functions) que registra, para el streamer/anfitrión
// que terminó de jugar, UNA partida más en el conteo remoto guardado en Netlify
// Blobs. La llama el propio juego (ver TableroService) apenas se resuelve una
// carrera REAL — nunca desde el modo "🧪 Pruebas", que jamás toca `primerGanador`.
//
// No requiere login real (el juego tampoco lo tiene): el "streamer" es el mismo
// nombre libre que el anfitrión escribe al entrar (SesionService.nombreUsuario),
// usado acá solo como identificador para separar los conteos de cada instancia
// alquilada. Si dos personas usan el mismo nombre, comparten conteo — el usuario
// (Roberto) es quien reparte los nombres a cada streamer, así que en la práctica
// no se pisan.

const { getStore } = require('@netlify/blobs');

const MAX_RECIENTES = 15;

function respuesta(body, statusCode) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-panel-password',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return respuesta({}, 204);
  }

  if (event.httpMethod !== 'POST') {
    return respuesta({ error: 'Método no permitido' }, 405);
  }

  let datos;
  try {
    datos = JSON.parse(event.body || '{}');
  } catch {
    return respuesta({ error: 'JSON inválido' }, 400);
  }

  const streamerOriginal = typeof datos.streamer === 'string' ? datos.streamer.trim() : '';
  const dinoGanador = typeof datos.dinoGanador === 'string' ? datos.dinoGanador.trim() : '';
  const filasJugadas = Number(datos.filasJugadas) || 0;
  const valorPuesto = Number(datos.valorPuesto) || 0;
  const premioPorCelda = Number(datos.premioPorCelda) || 0;
  const fecha = typeof datos.fecha === 'string' ? datos.fecha : new Date().toISOString();

  if (!streamerOriginal || !dinoGanador) {
    return respuesta({ error: 'Falta streamer o dinoGanador' }, 400);
  }

  try {
    const store = getStore('conteos-streamers');
    const clave = encodeURIComponent(streamerOriginal.toLowerCase());

    const actual = (await store.get(clave, { type: 'json' })) || {
      nombre: streamerOriginal,
      totalPartidas: 0,
      primeraPartida: null,
      ultimaPartida: null,
      recientes: [],
    };

    actual.nombre = streamerOriginal; // por si cambió mayúsculas/espacios desde la última vez
    actual.totalPartidas += 1;
    actual.ultimaPartida = fecha;
    if (!actual.primeraPartida) actual.primeraPartida = fecha;
    actual.recientes = [
      { fecha, dinoGanador, filasJugadas, valorPuesto, premioPorCelda },
      ...actual.recientes,
    ].slice(0, MAX_RECIENTES);

    await store.setJSON(clave, actual);

    return respuesta({ ok: true, totalPartidas: actual.totalPartidas }, 200);
  } catch (err) {
    console.error('registrar-partida error:', err);
    return respuesta({ error: 'Error interno al guardar el conteo' }, 500);
  }
};
