namespace TableroCartas.Api.Models;

/// <summary>
/// Un usuario conectado al hub (jugador, espectador o anfitrión).
/// Vive solo en memoria mientras dura la conexión — no es una entidad de base de datos.
/// </summary>
public class ConnectedUser
{
    public required string ConnectionId { get; init; }
    public required string RoomCode { get; init; }
    public required string DisplayName { get; set; }
    public bool IsHost { get; set; }
    public DateTimeOffset JoinedAtUtc { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Timestamps de los últimos mensajes mandados, para el rate limit.</summary>
    public Queue<DateTimeOffset> RecentMessageTimestamps { get; } = new();

    public DateTimeOffset? MutedUntilUtc { get; set; }

    public bool EstaMuteado => MutedUntilUtc.HasValue && MutedUntilUtc.Value > DateTimeOffset.UtcNow;
}

/// <summary>Un mensaje de chat, tal cual se manda a los clientes.</summary>
public class ChatMessage
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string RoomCode { get; init; }
    public required string SenderConnectionId { get; init; }
    public required string SenderDisplayName { get; init; }
    public bool SenderIsHost { get; init; }
    public required string Text { get; init; }
    public DateTimeOffset SentAtUtc { get; init; } = DateTimeOffset.UtcNow;
    public bool Eliminado { get; set; }
}

/// <summary>Lo que ve el cliente cuando pide la lista de usuarios conectados en la sala.</summary>
public record UsuarioConectadoDto(string ConnectionId, string DisplayName, bool IsHost);
