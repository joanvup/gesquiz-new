# Plan de instalación en producción — QuizColegio

**Aplicación:** QuizColegio  
**Dominio:** `https://quiz.colegiobilingue.edu.co`  
**Servidor:** Ubuntu 24.04.4 LTS  
**Proxy:** Nginx  
**TLS:** Certbot  
**Node.js:** v20.20.2  
**Gestor de procesos:** PM2  
**Base de datos:** MySQL local  
**Repositorio:** `https://github.com/joanvup/gesquiz-new`  
**Rama:** `main`  
**Directorio de la app:** `/var/www/quizcolegio/app`  
**Puerto interno:** `127.0.0.1:3015`  
**Administrador inicial:** `sistemas@colegiobilingue.edu.co`

---

## 1. Arquitectura propuesta

```text
Internet
   │
   ▼
Nginx :443  ──►  127.0.0.1:3015  ──►  Next.js (PM2)
   │                                      │
   │                                      ▼
   └──► otros dominios/apps          MySQL 8 local
                                      quizcolegio_prod
```

Para evitar interferir con las aplicaciones existentes:

- La app vivirá en `/var/www/quizcolegio/app`.
- Se usará un proceso PM2 exclusivo llamado `quizcolegio`.
- El puerto interno será `3015`, escuchando únicamente en `127.0.0.1`.
- Se creará una base de datos y un usuario MySQL exclusivos.
- Se añadirá un virtual host Nginx exclusivo para el subdominio.
- No se modificarán los virtual hosts ni los procesos PM2 de otras aplicaciones.

---

## 2. Consideración importante sobre PM2

Como el servidor ya tiene otras aplicaciones con PM2, hay dos escenarios:

1. **PM2 existente corre con un usuario de despliegue, no root:** se puede añadir el proceso `quizcolegio` a ese mismo PM2.
2. **PM2 existente corre como root:** no se recomienda agregar QuizColegio ahí. Lo más seguro es crear un PM2 dedicado para el usuario `quizcolegio`, con su propio servicio systemd.

Este plan usa la opción más segura: **PM2 dedicado bajo el usuario `quizcolegio`**, sin tocar los procesos existentes.

---

## 3. Comprobaciones previas

Ejecutar en el servidor:

```bash
node -v
npm -v
pm2 -v
pm2 list

sudo nginx -t
sudo certbot certificates

sudo ss -ltnp | grep -E ':(3015|3306)\b'
sudo mysql -e 'SELECT VERSION();'
```

Verificar:

- Que el puerto `3015` esté libre. Si está ocupado, usar `3016` y actualizar PM2 y Nginx.
- Que el dominio no tenga un virtual host conflictivo.
- Qué usuario ejecuta PM2:

```bash
ps -eo user,pid,cmd | grep '[P]M2'
```

Antes de tocar Nginx o PM2, respaldar la configuración actual:

```bash
sudo tar czf /root/nginx-backup-$(date +%F-%H%M).tar.gz /etc/nginx
```

Respaldar el dump actual de PM2 del usuario correspondiente:

```bash
cp ~/.pm2/dump.pm2 ~/dump.pm2.bak
```

---

## 4. DNS

Crear el registro DNS:

```text
Tipo: A
Nombre: quiz
Valor: IP pública del servidor
```

Si el servidor tiene IPv6, añadir también el registro `AAAA`.

Verificar la propagación:

```bash
dig +short A quiz.colegiobilingue.edu.co
```

Debe devolver la IP pública del servidor.

Como no se usa Cloudflare, Certbot podrá usar validación HTTP-01 sin configuraciones adicionales.

---

## 5. Base de datos MySQL

Entrar como root:

```bash
sudo mysql
```

Crear la base de datos y el usuario exclusivos:

```sql
CREATE DATABASE quizcolegio_prod
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'quizcolegio_app'@'127.0.0.1'
  IDENTIFIED BY 'CONTRASEÑA_GENERADA';

GRANT ALL PRIVILEGES ON quizcolegio_prod.*
  TO 'quizcolegio_app'@'127.0.0.1';

FLUSH PRIVILEGES;
```

Importante:

- **No** conceder `CREATE, DROP ON *.*` en producción.
- En producción se usará `prisma migrate deploy`, que no necesita shadow database.
- No modificar la configuración global de MySQL ni las bases de datos de otras aplicaciones.

Probar la conexión:

```bash
mysql \
  -h 127.0.0.1 \
  -u quizcolegio_app \
  -p \
  quizcolegio_prod \
  -e 'SELECT 1;'
```

---

## 6. Usuario y directorio de la aplicación

Crear un usuario de sistema dedicado:

```bash
sudo adduser --system --group --home /var/www/quizcolegio quizcolegio
sudo mkdir -p /var/www/quizcolegio/app
sudo chown -R quizcolegio:quizcolegio /var/www/quizcolegio
```

Clonar el repositorio:

```bash
sudo -u quizcolegio git clone \
  https://github.com/joanvup/gesquiz-new.git \
  /var/www/quizcolegio/app
```

Verificar la rama y el commit:

```bash
sudo -u quizcolegio git -C /var/www/quizcolegio/app branch --show-current
sudo -u quizcolegio git -C /var/www/quizcolegio/app log -1 --oneline
```

---

## 7. Variables de entorno

Crear `/var/www/quizcolegio/app/.env`:

```env
DATABASE_URL="mysql://quizcolegio_app:CONTRASEÑA_GENERADA@127.0.0.1:3306/quizcolegio_prod"

ADMIN_EMAIL="sistemas@colegiobilingue.edu.co"
ADMIN_PASSWORD="CONTRASEÑA_INICIAL_MUY_SEGURA"
ADMIN_NAME="Administrador QuizColegio"
```

Proteger el archivo:

```bash
sudo chown quizcolegio:quizcolegio /var/www/quizcolegio/app/.env
sudo chmod 600 /var/www/quizcolegio/app/.env
```

Notas:

- `ADMIN_PASSWORD` se usa solo para crear el administrador inicial.
- Después de ejecutar `npm run db:admin`, se puede retirar del `.env` o dejar el archivo protegido.
- **No ejecutar `npm run db:seed` en producción**: elimina todas las tablas y crea usuarios de demostración.
- El correo del administrador será `sistemas@colegiobilingue.edu.co`.

---

## 8. Instalación, migraciones y build

Ejecutar como el usuario `quizcolegio`:

```bash
sudo -u quizcolegio bash -lc '
  cd /var/www/quizcolegio/app

  npm ci --include=dev
  npx prisma generate
  npx prisma migrate deploy
  npm run db:admin
  npm run build
'
```

Puntos clave:

- `npm ci --include=dev` es necesario porque el build usa dependencias de desarrollo.
- `npx prisma generate` es obligatorio: `src/generated/prisma` está ignorado por Git y no se sube al repositorio.
- No copiar `node_modules` ni `.next` desde Windows. El build debe hacerse en Linux.
- No usar `npm run db:migrate` en producción, porque ejecuta `prisma migrate dev`.
- Si el build falla por memoria:

```bash
NODE_OPTIONS=--max-old-space-size=2048 npm run build
```

Comprobar el estado de las migraciones:

```bash
sudo -u quizcolegio bash -lc '
  cd /var/www/quizcolegio/app
  npx prisma migrate status
'
```

---

## 9. Arranque con PM2

Crear `/var/www/quizcolegio/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: "quizcolegio",
      cwd: "/var/www/quizcolegio/app",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3015",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      time: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
```

Asignar propietario:

```bash
sudo chown quizcolegio:quizcolegio /var/www/quizcolegio/ecosystem.config.cjs
```

Arrancar con el PM2 dedicado:

```bash
sudo -u quizcolegio -H pm2 start /var/www/quizcolegio/ecosystem.config.cjs
sudo -u quizcolegio -H pm2 save
sudo -u quizcolegio -H pm2 status
```

Configurar el arranque automático al reiniciar el servidor:

```bash
sudo env PATH=$PATH:/usr/bin \
  pm2 startup systemd \
  -u quizcolegio \
  --hp /var/www/quizcolegio
```

Ejecutar el comando que imprima `pm2 startup`, y después:

```bash
sudo -u quizcolegio -H pm2 save
```

Verificar la aplicación:

```bash
curl -I http://127.0.0.1:3015/login
```

Debe responder `200`.

Si falla:

```bash
sudo -u quizcolegio -H pm2 logs quizcolegio
```

No usar `pm2 kill` ni `pm2 delete all`, porque podría afectar otras aplicaciones si se comparte el daemon.

---

## 10. Nginx para el subdominio

Crear `/etc/nginx/sites-available/quiz-colegio`:

```nginx
server {
    listen 80;
    server_name quiz.colegiobilingue.edu.co;

    # La app limita la importación a 10 MB; dejamos margen para multipart.
    client_max_body_size 15m;

    location / {
        proxy_pass http://127.0.0.1:3015;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        proxy_connect_timeout 10s;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

Activar el sitio:

```bash
sudo ln -s \
  /etc/nginx/sites-available/quiz-colegio \
  /etc/nginx/sites-enabled/quiz-colegio

sudo nginx -t
sudo systemctl reload nginx
```

Probar el virtual host antes de emitir el certificado:

```bash
curl -I \
  -H 'Host: quiz.colegiobilingue.edu.co' \
  http://127.0.0.1/login
```

---

## 11. Certificado HTTPS

Como no hay Cloudflare y Certbot ya está instalado:

```bash
sudo certbot --nginx -d quiz.colegiobilingue.edu.co
```

Certbot añadirá el bloque HTTPS y la redirección desde HTTP.

Verificar la renovación automática:

```bash
sudo certbot renew --dry-run
```

Comprobar el sitio:

```bash
curl -I https://quiz.colegiobilingue.edu.co
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://quiz.colegiobilingue.edu.co/login
```

Si ya existe un certificado wildcard para `*.colegiobilingue.edu.co`, revisar primero:

```bash
sudo certbot certificates
```

En ese caso se puede reutilizar el certificado en lugar de emitir uno nuevo.

---

## 12. Validación funcional

1. Abrir `https://quiz.colegiobilingue.edu.co/login`.
2. Iniciar sesión con:
   - Email: `sistemas@colegiobilingue.edu.co`
   - Contraseña: la definida en `ADMIN_PASSWORD`.
3. En DevTools, verificar que la cookie `session` sea:
   - `Secure`
   - `HttpOnly`
   - `SameSite=Lax`
4. Crear un docente desde el panel de administración.
5. Iniciar sesión como docente.
6. Crear un quiz e importar un XML de `samples/`.
7. Verificar que las imágenes se sirven desde `/uploads/moodle/...`.
8. Reiniciar el proceso:

   ```bash
   sudo -u quizcolegio -H pm2 restart quizcolegio
   ```

9. Confirmar que las imágenes y la sesión siguen funcionando.
10. Probar el flujo de estudiante en una ventana incógnito.
11. Comprobar que las demás aplicaciones siguen respondiendo después del `nginx reload`.

Logs:

```bash
sudo -u quizcolegio -H pm2 logs quizcolegio
sudo tail -f /var/log/nginx/error.log
```

---

## 13. Respaldos — opción recomendada

La mejor opción para este servidor es:

- **Base de datos:** `mysqldump` diario.
- **Uploads:** archivo comprimido diario de `public/uploads`.
- **Copia externa:** Restic hacia un bucket S3-compatible o Backblaze B2.
- **Retención:** 14 diarios, 8 semanales y 6 mensuales.
- **Prueba de restauración:** mensual.

Restic aporta cifrado, deduplicación y versionado. Si no hay cuenta S3/B2 disponible, la alternativa es `rsync` a otro servidor o NAS, pero no dejar los respaldos solo en el mismo disco.

### Script de respaldo

`/usr/local/sbin/backup-quizcolegio.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/quizcolegio"
STAMP="$(date +%F-%H%M)"
mkdir -p "$BACKUP_DIR"

mysqldump \
  --defaults-extra-file=/etc/quizcolegio/backup.cnf \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  quizcolegio_prod \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

tar czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" \
  -C /var/www/quizcolegio/app/public uploads

export RESTIC_REPOSITORY="s3:https://s3.us-east-005.backblazeb2.com/quizcolegio-backups"
export RESTIC_PASSWORD_FILE="/etc/quizcolegio/restic-password"

restic backup "$BACKUP_DIR"
restic forget \
  --keep-daily 14 \
  --keep-weekly 8 \
  --keep-monthly 6 \
  --prune

find "$BACKUP_DIR" -type f -mtime +2 -delete
```

Archivo `/etc/quizcolegio/backup.cnf`:

```ini
[client]
host=127.0.0.1
user=quizcolegio_app
password=CONTRASEÑA_GENERADA
```

Permisos:

```bash
sudo chmod 700 /usr/local/sbin/backup-quizcolegio.sh
sudo chmod 600 /etc/quizcolegio/backup.cnf
sudo chmod 600 /etc/quizcolegio/restic-password
```

Cron diario:

```cron
30 2 * * * root /usr/local/sbin/backup-quizcolegio.sh >> /var/log/quizcolegio-backup.log 2>&1
```

Probar una restauración antes de dar el despliegue por terminado.

---

## 14. Actualizaciones

Antes de actualizar, respaldar base de datos y uploads.

```bash
cd /var/www/quizcolegio/app

sudo -u quizcolegio git pull origin main
sudo -u quizcolegio npm ci --include=dev
sudo -u quizcolegio npx prisma generate
sudo -u quizcolegio npx prisma migrate deploy
sudo -u quizcolegio npm run build

sudo -u quizcolegio -H pm2 restart quizcolegio --update-env
```

Después:

```bash
curl -I https://quiz.colegiobilingue.edu.co/login
sudo -u quizcolegio -H pm2 logs quizcolegio --lines 100
```

### Rollback

```bash
cd /var/www/quizcolegio/app
sudo -u quizcolegio git checkout <COMMIT_O_TAG_ANTERIOR>
sudo -u quizcolegio npm ci --include=dev
sudo -u quizcolegio npx prisma generate
sudo -u quizcolegio npm run build
sudo -u quizcolegio -H pm2 restart quizcolegio
```

Si la migración de base de datos fue incompatible o destructiva, restaurar el backup de MySQL.

---

## 15. Checklist final

- [ ] DNS `quiz.colegiobilingue.edu.co` apunta al servidor.
- [ ] Puerto `3015` libre y escuchando solo en `127.0.0.1`.
- [ ] Base `quizcolegio_prod` y usuario `quizcolegio_app` creados.
- [ ] `.env` con permisos `600`.
- [ ] `prisma generate` y `prisma migrate deploy` ejecutados.
- [ ] `npm run build` correcto.
- [ ] Administrador `sistemas@colegiobilingue.edu.co` creado.
- [ ] PM2 `quizcolegio` online y guardado con `pm2 save`.
- [ ] PM2 configurado para iniciar al reiniciar.
- [ ] Nginx configurado y `nginx -t` correcto.
- [ ] HTTPS activo y `certbot renew --dry-run` correcto.
- [ ] Login, cookies `Secure`, importación XML y uploads probados.
- [ ] Otras aplicaciones del servidor siguen funcionando.
- [ ] Backup local y externo configurados.
- [ ] Restauración de prueba realizada.

---

## 16. Datos pendientes para ejecutar

Solo faltan dos definiciones:

1. **Contraseña inicial del administrador** para `sistemas@colegiobilingue.edu.co`; puede generarse durante la ejecución.
2. **Destino de respaldo externo:** bucket S3/Backblaze B2 con sus credenciales, o un servidor/NAS alternativo para `rsync`.

---

## 17. Notas de seguridad y mantenimiento

- No exponer los puertos `3015` ni `3306` a Internet.
- No ejecutar `npm run db:seed` en producción.
- No ejecutar `npm run db:migrate` en producción; usar `npx prisma migrate deploy`.
- Mantener `.env` con permisos `600`.
- Revisar periódicamente `npm audit --omit=dev`.
- Revisar los logs de PM2 y Nginx.
- Probar la restauración de backups al menos una vez al mes.
- Si en el futuro se ejecuta más de una instancia de la app, revisar el rate limiting en memoria y considerar Redis o limitación en Nginx.
- Si se cambia la ubicación de los uploads, actualizar el parser y la configuración de respaldos.

---

## 18. Solución de problemas de conexión a MySQL

### Síntoma

Al entrar a `/login` aparece un mensaje como:

```text
Invalid `prisma.user.findUnique()` invocation: Database error.
Code: `45028`. Message: `pool failed to retrieve a connection from pool
(pool connections: active=0 idle=0 limit=10)`
```

`active=0 idle=0` significa que **no se logró abrir ni una sola conexión**. El
código `45028` es `ER_GET_CONNECTION_TIMEOUT` del driver `mariadb`, que oculta
la causa real en `err.cause`; desde la versión actual de la app ese detalle se
registra en el log del servidor y el navegador solo muestra un mensaje genérico:

```bash
sudo -u quizcolegio pm2 logs quizcolegio --lines 50 --nostream
```

### Diagnóstico rápido

```bash
sudo -u quizcolegio bash -lc 'cd /var/www/quizcolegio/app && npm run db:check'
```

El script imprime host, usuario y base de datos (nunca la contraseña), prueba la
conexión con la configuración de la app y con variantes, y muestra el código de
error real. Además comprueba del lado del servidor:

```bash
sudo mysql -e "SELECT user, host, plugin FROM mysql.user WHERE user = 'quizcolegio_app';"
sudo mysql -e "SHOW VARIABLES LIKE 'max_connections'; SHOW STATUS LIKE 'Threads_connected';"
sudo ss -ltnp | grep 3306
```

### Causa 1: contraseña con caracteres especiales sin codificar

`DATABASE_URL` es una URL: la contraseña debe ir **percent-encoded**.

| Carácter | Código |
| --- | --- |
| `@` | `%40` |
| `#` | `%23` |
| `%` | `%25` |
| `/` | `%2F` |
| `:` | `%3A` |
| `?` | `%3F` |
| `!` | `%21` (opcional) |

Un `#` sin codificar convierte el resto de la URL en fragmento y hace que el
host y la base de datos se pierdan sin ningún aviso. Lo más sencillo es generar
una contraseña solo con caracteres seguros:

```bash
openssl rand -hex 24
```

y usarla tal cual en `DATABASE_URL`. Si la contraseña ya existe, codifícala:

```bash
node -e 'console.log(encodeURIComponent(process.argv[1]))' 'Mi#Clave/2026'
```

### Causa 2: MySQL 8 con `caching_sha2_password`

MySQL 8 usa `caching_sha2_password` por defecto. El driver `mariadb` necesita
`allowPublicKeyRetrieval` o TLS para completar la autenticación, y falla con
`ER_CANNOT_RETRIEVE_RSA_KEY` cuando la caché SHA2 está vacía (por ejemplo, tras
reiniciar MySQL). La app ya envía `allowPublicKeyRetrieval: true`; si el
servidor exige TLS, activa:

```env
DB_SSL="true"
DB_SSL_REJECT_UNAUTHORIZED="true"
```

### Causa 3: conexiones agotadas o MySQL caído

```bash
sudo systemctl status mysql
sudo mysql -e "SHOW PROCESSLIST;"
```

Si `Threads_connected` está cerca de `max_connections` (otras aplicaciones del
servidor también consumen conexiones), reduce el pool de la app:

```env
DB_POOL_LIMIT="5"
```

### Causa 4: timeouts demasiado cortos

El driver `mariadb` usa `connectTimeout` de 1 segundo por defecto. La app lo
eleva a 10 segundos; se puede ajustar con:

```env
DB_CONNECT_TIMEOUT_MS="10000"
DB_ACQUIRE_TIMEOUT_MS="30000"
```

### Después de cambiar `.env`

```bash
sudo -u quizcolegio bash -lc 'cd /var/www/quizcolegio/app && npm run db:check'
sudo -u quizcolegio pm2 restart quizcolegio --update-env
sudo -u quizcolegio pm2 logs quizcolegio --lines 50 --nostream
```
