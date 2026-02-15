# Emby to Jellyfin Downloader

Descarga contenido de un servidor Emby a carpetas de Jellyfin.

## Requisitos

- Docker y Docker Compose
- Acceso a servidor Emby con API Key

## Configuración

1. Copiar `.env.example` a `.env` y configurar:
   - `EMBY_HOST`: URL del servidor Emby (ej: `http://192.168.1.100:8096`)
   - `EMBY_API_KEY`: API Key de Emby
   - `DOWNLOAD_BASE_PATH`: Ruta base para descargas

2. Configurar volúmenes en `docker-compose.yml`:
   - `/media` debe apuntar a la carpeta de medios de Jellyfin

## Ejecutar

```bash
docker-compose up -d --build
```

Acceder a `http://localhost:3030`

## Notas

- Las películas se guardan en `{DOWNLOAD_BASE_PATH}/movies/{Nombre} ({Año})/{Nombre} ({Año}).{ext}`
- Las series se guardan en `{DOWNLOAD_BASE_PATH}/series/{Nombre}/Season {XX}/{Nombre} - S{XX}E{YY}.{ext}`
- La base de datos SQLite se guarda en `./data/downloads.db`
