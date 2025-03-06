# X-Replier Bot

Bot que responde automáticamente a tweets de cuentas específicas.

## Configuración Automática con Docker

Este bot está configurado para ejecutarse automáticamente al inicio del sistema usando solo Docker.

### Requisitos previos

- Docker instalado
- Ubuntu (o cualquier distribución Linux)
- Node.js y npm (para usar los scripts npm)

### Instalación y Configuración

1. Asegúrate de que el archivo `.env` esté configurado correctamente con tus credenciales:

```
XAI_API_KEY=tu_clave_api_xai
CONSUMER_KEY=tu_clave_consumidor_twitter
CONSUMER_SECRET=tu_secreto_consumidor_twitter
ACCESS_TOKEN=tu_token_acceso_twitter
ACCESS_TOKEN_SECRET=tu_secreto_token_acceso_twitter
```

2. Ejecuta el script de instalación:

```bash
./update.sh
```

O usando npm:

```bash
npm run docker:update
```

Esto construirá la imagen Docker, creará y ejecutará el contenedor con la opción `--restart=always`, lo que garantiza que se inicie automáticamente cuando arranque el sistema.

### Sistema de Caché

El bot utiliza un sistema de caché para reducir las llamadas a las APIs y evitar alcanzar los límites de tasa:

- **Caché de tweets**: Almacena los tweets obtenidos de cada usuario para usarlos en caso de error o límite de tasa.
- **Caché de respuestas**: Almacena las respuestas generadas para evitar llamadas repetidas al modelo de lenguaje.
- **Persistencia**: Los datos en caché se almacenan en el directorio `./cache` y persisten entre reinicios.

Los tiempos de expiración predeterminados son:
- Tweets: 1 hora
- Respuestas generadas: 7 días

La caché se limpia automáticamente de elementos expirados durante cada ejecución del bot.

### Actualización del código

Cuando necesites actualizar el código:

1. Realiza tus cambios en el código
2. Ejecuta el mismo script de actualización:

```bash
./update.sh
```

O usando npm:

```bash
npm run docker:update
```

### Scripts npm disponibles

Para facilitar la gestión de la aplicación, se han incluido varios scripts npm que puedes ejecutar con `npm run`:

| Comando | Descripción |
|---------|-------------|
| `npm run docker:build` | Construye la imagen Docker |
| `npm run docker:start` | Inicia el contenedor Docker |
| `npm run docker:stop` | Detiene el contenedor Docker |
| `npm run docker:restart` | Reinicia el contenedor Docker |
| `npm run docker:logs` | Muestra los logs del contenedor |
| `npm run docker:logs:follow` | Muestra los logs en tiempo real |
| `npm run docker:remove` | Detiene y elimina el contenedor |
| `npm run docker:update` | Actualiza y reinicia el contenedor (ejecuta update.sh) |
| `npm run docker:shell` | Abre una terminal dentro del contenedor |
| `npm run docker:status` | Muestra el estado del contenedor |
| `npm run docker:clean-cache` | Limpia manualmente la caché expirada |

### Comandos Docker directos

Si prefieres usar Docker directamente:

#### Ver logs del contenedor:
```bash
sudo docker logs x-replier
```

#### Ver logs en tiempo real:
```bash
sudo docker logs -f x-replier
```

#### Detener el bot:
```bash
sudo docker stop x-replier
```

#### Iniciar el bot manualmente (si está detenido):
```bash
sudo docker start x-replier
```

#### Eliminar el contenedor (para reinstalación):
```bash
sudo docker stop x-replier
sudo docker rm x-replier
``` 