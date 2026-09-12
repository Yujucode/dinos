using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using TableroCartas.Api.Models;
using TableroCartas.Api.Options;
using TableroCartas.Api.Services;

namespace TableroCartas.Api.Hubs;

/// <summary>
/// Hub de chat en vivo para una partida. Cada sala es un "grupo" de SignalR
/// identificado por <c>roomCode</c> — así, si el día de mañana corres dos
/// partidas al mismo tiempo, los mensajes de una no se mezclan con los de la otra.
///
/// Eventos que el cliente (Angular) va a recibir — nombres para cuando conectes
/// el frontend, ver README.md:
///   - "HistorialRecibido"  (al entrar: lista de ChatMessage recientes)
///   - "UsuariosActualizados" (lista de usuarios conectados en la sala)
///   - "MensajeRecibido"    (ChatMessage nuevo)
///   - "MensajeEliminado"   (Guid del mensaje que el anfitrión borró)
///   - "FuisteMuteado"      (segundos que dura el mute)
///   - "FuisteExpulsado"    (el cliente debe llamar connection.stop() al recibir esto)
///   - "ErrorDeChat"        (string con un mensaje de error para mostrar al usuario)
/// </summary>
public class ChatHub : Hub
{
    private readonly IChatRoomStore _store;
    private readonly ChatOptions _options;
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(IChatRoomStore store, IOptions<ChatOptions> options, ILogger<ChatHub> logger)
    {
        _store = store;
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>Entrar a una sala como jugador/espectador normal.</summary>
    public async Task JoinRoom(string roomCode, string displayName)
    {
        await UnirseInternoAsync(roomCode, displayName, esAnfitrion: false);
    }

    /// <summary>Entrar a una sala como anfitrión, validando el código secreto.</summary>
    public async Task JoinAsHost(string roomCode, string displayName, string hostSecret)
    {
        if (!string.Equals(hostSecret, _options.HostSecret, StringComparison.Ordinal))
        {
            _logger.LogWarning("Intento fallido de conectarse como anfitrión en sala {RoomCode}", roomCode);
            throw new HubException("Código de anfitrión inválido.");
        }

        await UnirseInternoAsync(roomCode, displayName, esAnfitrion: true);
    }

    private async Task UnirseInternoAsync(string roomCode, string displayName, bool esAnfitrion)
    {
        roomCode = Normalizar(roomCode, maxLength: 30);
        displayName = Normalizar(displayName, maxLength: 40);

        if (string.IsNullOrWhiteSpace(roomCode) || string.IsNullOrWhiteSpace(displayName))
            throw new HubException("Código de sala y nombre son obligatorios.");

        var usuario = new ConnectedUser
        {
            ConnectionId = Context.ConnectionId,
            RoomCode = roomCode,
            DisplayName = displayName,
            IsHost = esAnfitrion,
        };

        _store.AgregarUsuario(usuario);
        await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);

        // al que entra: le mandamos el historial reciente y la lista de usuarios, solo a él
        var historial = _store.ObtenerHistorial(roomCode, _options.HistorySize);
        await Clients.Caller.SendAsync("HistorialRecibido", historial);

        await NotificarUsuariosActualizadosAsync(roomCode);

        _logger.LogInformation("{DisplayName} entró a la sala {RoomCode} (anfitrión: {EsAnfitrion})",
            displayName, roomCode, esAnfitrion);
    }

    /// <summary>Mandar un mensaje a la sala donde está el que llama.</summary>
    public async Task SendMessage(string text)
    {
        var usuario = ObtenerUsuarioActualONotificarError();
        if (usuario is null) return;

        if (usuario.EstaMuteado)
        {
            await Clients.Caller.SendAsync("ErrorDeChat", "Estás muteado por el anfitrión todavía.");
            return;
        }

        if (!PasaRateLimit(usuario))
        {
            await Clients.Caller.SendAsync("ErrorDeChat", "Estás enviando mensajes muy rápido, espera un momento.");
            return;
        }

        text = Normalizar(text, _options.MaxMessageLength);
        if (string.IsNullOrWhiteSpace(text))
            return;

        text = AplicarFiltroDePalabras(text);

        var mensaje = new ChatMessage
        {
            RoomCode = usuario.RoomCode,
            SenderConnectionId = usuario.ConnectionId,
            SenderDisplayName = usuario.DisplayName,
            SenderIsHost = usuario.IsHost,
            Text = text,
        };

        _store.AgregarMensaje(mensaje);
        await Clients.Group(usuario.RoomCode).SendAsync("MensajeRecibido", mensaje);
    }

    /// <summary>Solo anfitrión: borra un mensaje (soft-delete) para todos en la sala.</summary>
    public async Task DeleteMessage(Guid messageId)
    {
        var anfitrion = ObtenerAnfitrionActualONotificarError();
        if (anfitrion is null) return;

        if (_store.MarcarMensajeEliminado(anfitrion.RoomCode, messageId))
            await Clients.Group(anfitrion.RoomCode).SendAsync("MensajeEliminado", messageId);
    }

    /// <summary>Solo anfitrión: mutea a alguien de la sala por N segundos.</summary>
    public async Task MuteUser(string targetConnectionId, int seconds)
    {
        var anfitrion = ObtenerAnfitrionActualONotificarError();
        if (anfitrion is null) return;

        var objetivo = _store.ObtenerUsuario(targetConnectionId);
        if (objetivo is null || objetivo.RoomCode != anfitrion.RoomCode) return;

        objetivo.MutedUntilUtc = DateTimeOffset.UtcNow.AddSeconds(Math.Max(1, seconds));
        await Clients.Client(targetConnectionId).SendAsync("FuisteMuteado", seconds);
    }

    /// <summary>Solo anfitrión: le pide al cliente objetivo que se desconecte.</summary>
    public async Task KickUser(string targetConnectionId)
    {
        var anfitrion = ObtenerAnfitrionActualONotificarError();
        if (anfitrion is null) return;

        var objetivo = _store.ObtenerUsuario(targetConnectionId);
        if (objetivo is null || objetivo.RoomCode != anfitrion.RoomCode) return;

        // Nota: SignalR no deja "cortar" la conexión de otro cliente directamente
        // desde el hub. Le avisamos al cliente y es SU código (Angular, más adelante)
        // el que debe llamar a connection.stop() al recibir este evento.
        await Clients.Client(targetConnectionId).SendAsync("FuisteExpulsado");
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var usuario = _store.ObtenerUsuario(Context.ConnectionId);
        if (usuario is not null)
        {
            _store.QuitarUsuario(Context.ConnectionId);
            await NotificarUsuariosActualizadosAsync(usuario.RoomCode);
            _logger.LogInformation("{DisplayName} salió de la sala {RoomCode}", usuario.DisplayName, usuario.RoomCode);
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ---- helpers privados ----

    private async Task NotificarUsuariosActualizadosAsync(string roomCode)
    {
        var usuarios = _store.ObtenerUsuariosDeSala(roomCode)
            .Select(u => new UsuarioConectadoDto(u.ConnectionId, u.DisplayName, u.IsHost))
            .ToList();

        await Clients.Group(roomCode).SendAsync("UsuariosActualizados", usuarios);
    }

    private ConnectedUser? ObtenerUsuarioActualONotificarError()
    {
        var usuario = _store.ObtenerUsuario(Context.ConnectionId);
        if (usuario is null)
            throw new HubException("Primero tienes que unirte a una sala (JoinRoom / JoinAsHost).");

        return usuario;
    }

    private ConnectedUser? ObtenerAnfitrionActualONotificarError()
    {
        var usuario = ObtenerUsuarioActualONotificarError();
        if (usuario is null) return null;

        if (!usuario.IsHost)
            throw new HubException("Solo el anfitrión puede hacer esto.");

        return usuario;
    }

    private bool PasaRateLimit(ConnectedUser usuario)
    {
        var ahora = DateTimeOffset.UtcNow;
        var limiteInferior = ahora.AddSeconds(-_options.RateLimitWindowSeconds);

        var timestamps = usuario.RecentMessageTimestamps;
        while (timestamps.Count > 0 && timestamps.Peek() < limiteInferior)
            timestamps.Dequeue();

        if (timestamps.Count >= _options.MaxMessagesPerWindow)
            return false;

        timestamps.Enqueue(ahora);
        return true;
    }

    private string AplicarFiltroDePalabras(string text)
    {
        foreach (var palabra in _options.BannedWords)
        {
            if (string.IsNullOrWhiteSpace(palabra)) continue;
            text = System.Text.RegularExpressions.Regex.Replace(
                text, System.Text.RegularExpressions.Regex.Escape(palabra),
                new string('*', palabra.Length),
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        }
        return text;
    }

    private static string Normalizar(string? value, int maxLength)
    {
        value = (value ?? string.Empty).Trim();
        return value.Length > maxLength ? value[..maxLength] : value;
    }
}
