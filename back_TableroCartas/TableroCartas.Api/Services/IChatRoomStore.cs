using TableroCartas.Api.Models;

namespace TableroCartas.Api.Services;

/// <summary>
/// Guarda el estado del chat (usuarios conectados y mensajes) por sala.
/// La interfaz existe para que el día que quieras persistir el historial en
/// SQL Server / Azure SQL, solo tengas que escribir una implementación nueva
/// (ej. SqlChatRoomStore) y cambiar un registro en Program.cs — el ChatHub
/// no se entera del cambio.
/// </summary>
public interface IChatRoomStore
{
    void AgregarUsuario(ConnectedUser usuario);
    void QuitarUsuario(string connectionId);
    ConnectedUser? ObtenerUsuario(string connectionId);
    IReadOnlyCollection<ConnectedUser> ObtenerUsuariosDeSala(string roomCode);

    void AgregarMensaje(ChatMessage mensaje);
    IReadOnlyList<ChatMessage> ObtenerHistorial(string roomCode, int cantidad);
    bool MarcarMensajeEliminado(string roomCode, Guid mensajeId);
}
