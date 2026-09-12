using System.Collections.Concurrent;
using TableroCartas.Api.Models;

namespace TableroCartas.Api.Services;

/// <summary>
/// Implementación en memoria de <see cref="IChatRoomStore"/>. Se pierde todo si
/// reinicias el proceso o si escalas a más de una instancia del App Service
/// (ver README: para eso existe Azure SignalR Service más adelante).
/// Registrada como singleton en Program.cs.
/// </summary>
public class InMemoryChatRoomStore : IChatRoomStore
{
    // connectionId -> usuario
    private readonly ConcurrentDictionary<string, ConnectedUser> _usuarios = new();

    // roomCode -> lista de mensajes (en orden de llegada)
    private readonly ConcurrentDictionary<string, List<ChatMessage>> _mensajesPorSala = new();
    private readonly object _lockMensajes = new();

    public void AgregarUsuario(ConnectedUser usuario) => _usuarios[usuario.ConnectionId] = usuario;

    public void QuitarUsuario(string connectionId) => _usuarios.TryRemove(connectionId, out _);

    public ConnectedUser? ObtenerUsuario(string connectionId) =>
        _usuarios.TryGetValue(connectionId, out var usuario) ? usuario : null;

    public IReadOnlyCollection<ConnectedUser> ObtenerUsuariosDeSala(string roomCode) =>
        _usuarios.Values.Where(u => u.RoomCode == roomCode).ToList();

    public void AgregarMensaje(ChatMessage mensaje)
    {
        lock (_lockMensajes)
        {
            var lista = _mensajesPorSala.GetOrAdd(mensaje.RoomCode, _ => new List<ChatMessage>());
            lista.Add(mensaje);
        }
    }

    public IReadOnlyList<ChatMessage> ObtenerHistorial(string roomCode, int cantidad)
    {
        lock (_lockMensajes)
        {
            if (!_mensajesPorSala.TryGetValue(roomCode, out var lista))
                return Array.Empty<ChatMessage>();

            return lista.Where(m => !m.Eliminado)
                        .TakeLast(cantidad)
                        .ToList();
        }
    }

    public bool MarcarMensajeEliminado(string roomCode, Guid mensajeId)
    {
        lock (_lockMensajes)
        {
            if (!_mensajesPorSala.TryGetValue(roomCode, out var lista))
                return false;

            var mensaje = lista.FirstOrDefault(m => m.Id == mensajeId);
            if (mensaje is null) return false;

            mensaje.Eliminado = true;
            return true;
        }
    }
}
