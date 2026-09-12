using TableroCartas.Api.Hubs;
using TableroCartas.Api.Options;
using TableroCartas.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ---- Configuración fuertemente tipada (sección "Chat" de appsettings.json) ----
builder.Services.Configure<ChatOptions>(builder.Configuration.GetSection(ChatOptions.SectionName));

// ---- Controllers: por ahora no hay ninguno (el chat vive todo en el Hub), pero lo dejamos
//      listo para cuando agregues endpoints REST normales (ej. crear/validar una sala) ----
builder.Services.AddControllers();

// ---- SignalR: incluido en el framework compartido de ASP.NET Core, sin paquete NuGet aparte ----
builder.Services.AddSignalR();

// ---- Store del chat en memoria (ver Services/IChatRoomStore.cs para cambiarlo por uno con BD) ----
builder.Services.AddSingleton<IChatRoomStore, InMemoryChatRoomStore>();

// ---- Health check simple, mismo patrón /health que ya usas en tu proyecto de ecommerce ----
builder.Services.AddHealthChecks();

// ---- CORS: el navegador bloquea por defecto que Angular (otro origen) llame a esta API/hub.
//      Los orígenes permitidos salen de appsettings.json -> "Chat:AllowedOrigins".
//      AllowCredentials es obligatorio para que funcione la conexión de SignalR. ----
var chatOptions = builder.Configuration.GetSection(ChatOptions.SectionName).Get<ChatOptions>() ?? new ChatOptions();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularApp", policy =>
    {
        policy.WithOrigins(chatOptions.AllowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ---- Swagger: lo dejamos afuera a propósito en este scaffold (ver TableroCartas.Api.csproj
//      y README.md — es un solo comando agregarlo de vuelta cuando tengas internet en VS2022) ----
// builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // app.UseSwagger();
    // app.UseSwaggerUI();
}
else
{
    // En producción sí o sí detrás de HTTPS (Azure App Service ya te da esto gratis).
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseCors("AngularApp");

app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
