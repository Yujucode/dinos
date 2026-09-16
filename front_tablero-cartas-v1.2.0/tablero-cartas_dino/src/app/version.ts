// Se actualiza cada vez que se entrega una nueva versión del proyecto.
export const VERSION = '1.18.0';
export const VERSION_NOTA = 'El login ahora valida de verdad contra el backend: el usuario es fijo (variable GAME_USERNAME) y la clave se regenera sola todos los dias a las 3am hora de Peru. El panel (/panel) ahora tambien muestra el usuario y la clave del dia para repartirla. Cambios fuera de src/: netlify.toml, netlify/functions (login.js, ver-credenciales.js, generar-clave.js nuevos), public/panel — se entregan aparte del zip.';
