namespace TableroCartas.Api.Options;

/// <summary>
/// Configuración del chat, leída desde la sección "Chat" de appsettings.json.
/// </summary>
public class ChatOptions
{
    public const string SectionName = "Chat";

    /// <summary>
    /// Código secreto que el cliente debe mandar para conectarse como anfitrión.
    /// En producción, cámbialo por variable de entorno / App Service configuration,
    /// nunca lo dejes hardcodeado ni subido a git con un valor real.
    /// </summary>
    public string HostSecret { get; set; } = "cambia-este-secreto";

    /// <summary>
    /// Cuántos mensajes puede mandar un usuario en la ventana de tiempo de abajo,
    /// antes de que se le empiece a bloquear (antispam simple).
    /// </summary>
    public int MaxMessagesPerWindow { get; set; } = 5;

    /// <summary>
    /// Tamaño de la ventana deslizante (en segundos) para el límite de arriba.
    /// </summary>
    public int RateLimitWindowSeconds { get; set; } = 10;

    /// <summary>
    /// Cantidad máxima de caracteres por mensaje.
    /// </summary>
    public int MaxMessageLength { get; set; } = 300;

    /// <summary>
    /// Cuántos mensajes de historial se mandan a alguien que recién entra a la sala.
    /// </summary>
    public int HistorySize { get; set; } = 50;

    /// <summary>
    /// Lista simple de palabras a censurar. Es un filtro básico, no una solución
    /// robusta de moderación — para eso, más adelante conviene algo más serio.
    /// </summary>
    public string[] BannedWords { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Orígenes permitidos por CORS para conectarse al hub (tu Angular en dev y prod).
    /// </summary>
    public string[] AllowedOrigins { get; set; } = Array.Empty<string>();
}
