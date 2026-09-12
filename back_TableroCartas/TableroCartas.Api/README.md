# TableroCartas.Api

Backend en ASP.NET Core 8 para el juego del tablero. Por ahora solo trae el **chat en
vivo** (vía SignalR); la lógica del mazo/turnos se queda en Angular hasta que decidas
migrarla también al servidor (cuando llegue ese momento, este mismo proyecto es donde va).

## Cómo correrlo en tu máquina (Visual Studio 2022)

1. Abre la carpeta `TableroCartas.Api` como proyecto en VS2022 (o `dotnet run` desde la terminal).
2. La primera vez que compiles vas a tener internet normal, así que NuGet restaura sin problema
   (acá en el sandbox donde lo armé no tenía salida a nuget.org, por eso el `NuGet.Config` con
   `<clear/>` — lo puedes borrar sin miedo, no rompe nada).
3. Corre el proyecto. Por defecto Kestrel levanta en un puerto que ves en la consola (algo como
   `http://localhost:5031`). Puedes fijarlo tú en `Properties/launchSettings.json` si prefieres
   uno fijo.
4. Prueba `GET /health` — debería devolver `200 OK`.

## Qué hay armado

- **`Hubs/ChatHub.cs`** — el hub de SignalR. Ahí están todos los métodos y, en el comentario de
  arriba de la clase, la lista de eventos que el cliente recibe.
- **`Services/IChatRoomStore.cs` + `InMemoryChatRoomStore.cs`** — guarda usuarios conectados y
  mensajes en memoria (`ConcurrentDictionary`), por sala (`roomCode`). Está atrás de una
  interfaz a propósito: el día que quieras persistir el historial en Azure SQL, escribes una
  `SqlChatRoomStore : IChatRoomStore` y cambias una línea en `Program.cs` — el hub no se entera.
- **`Options/ChatOptions.cs`** — toda la configuración del chat (código de anfitrión, límites
  de rate-limit, palabras baneadas, orígenes de CORS) sale de la sección `"Chat"` de
  `appsettings.json` / `appsettings.Development.json`.

## Cómo funciona el chat (resumen)

- Cualquiera entra con `JoinRoom(roomCode, displayName)`.
- Tú, como anfitrión, entras con `JoinAsHost(roomCode, displayName, hostSecret)` — el
  `hostSecret` tiene que matchear el de `appsettings` (en dev es `"dev-secret-123"`, cámbialo).
  **Esto es lo que evita que cualquiera se autodeclare anfitrión desde la consola del navegador**
  — el mismo problema que ya habías detectado con la lógica del juego corriendo solo en el
  frontend.
- Todos mandan mensajes con `SendMessage(text)`. Hay rate-limit (5 mensajes cada 10 segundos por
  defecto) y un filtro simple de palabras baneadas (configurable, vacío por ahora).
- Solo el anfitrión puede `DeleteMessage(id)`, `MuteUser(connectionId, segundos)` y
  `KickUser(connectionId)` — si alguien que no es anfitrión los llama, el hub tira un error.

## Cuando estés listo para conectar el Angular (no lo toqué, como pediste)

Vas a necesitar el paquete cliente:

```bash
npm install @microsoft/signalr
```

Y algo así en un servicio (ejemplo, ajústalo a como organizas tus servicios en Angular):

```typescript
import * as signalR from '@microsoft/signalr';

const connection = new signalR.HubConnectionBuilder()
  .withUrl('https://localhost:5031/hubs/chat') // o la URL de Azure cuando despliegues
  .withAutomaticReconnect()
  .build();

connection.on('MensajeRecibido', (mensaje) => { /* pintarlo en pantalla */ });
connection.on('HistorialRecibido', (mensajes) => { /* cargar historial al entrar */ });
connection.on('UsuariosActualizados', (usuarios) => { /* lista de conectados */ });
connection.on('FuisteMuteado', (segundos) => { /* avisar al usuario */ });
connection.on('FuisteExpulsado', () => connection.stop()); // importante: el kick es "soft"
connection.on('ErrorDeChat', (msg) => { /* mostrar error */ });

await connection.start();
await connection.invoke('JoinRoom', 'sala-1', 'Cornelio');
// o, si eres tú el anfitrión:
// await connection.invoke('JoinAsHost', 'sala-1', 'Roberto', 'dev-secret-123');

await connection.invoke('SendMessage', 'hola a todos');
```

## Antes de desplegar a Azure

- Cambia `Chat:HostSecret` a algo real — no lo dejes commiteado en `appsettings.Development.json`
  con un valor real; en local usa `dotnet user-secrets`, en Azure App Service ponlo en
  Configuración de la aplicación (igual que hiciste con la connection string del ecommerce).
- Llena `Chat:AllowedOrigins` con la URL real donde quede publicado tu Angular (Static Web Apps
  o el dominio que uses) — si no, el navegador va a bloquear la conexión por CORS aunque el
  backend esté sano.
- El store en memoria se pierde si el App Service reinicia o si algún día corres más de una
  instancia. Para una sola instancia (que es lo normal a tu escala) no es problema.
