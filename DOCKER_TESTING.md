# 🐳 Testing Lokal dengan Docker

Panduan lengkap untuk menjalankan Sigantara File Manager di lokal menggunakan Docker.

## Prerequisites

- Docker Desktop atau Docker Engine
- Docker Compose
- 4GB RAM minimum
- 10GB disk space

## Quick Start (5 Menit)

### 1. Clone & Navigate

```bash
cd /home/nicola/SE/sigantara-filemanager/sigantara-filemanager
```

### 2. Start Semua Services

```bash
docker-compose up -d
```

Ini akan menjalankan:
- ✅ PostgreSQL (port 5432)
- ✅ MinIO/S3 (port 9000, 9001)
- ✅ Redis (port 6379)
- ✅ API Server (port 8787)
- ✅ Frontend (port 3000)

### 3. Tunggu Services Ready

```bash
# Check status
docker-compose ps

# Watch logs
docker-compose logs -f
```

### 4. Akses Aplikasi

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8787
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **Database**: localhost:5432 (postgres/postgres)

### 5. Login

Gunakan kredensial development:
- **Admin**: `admin / admin`
- **Team**: `tim / tim`

---

## Arsitektur Docker

```
┌─────────────────────────────────────────────────┐
│                  Frontend (Next.js)             │
│              http://localhost:3000              │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│              API Server (Node.js)               │
│              http://localhost:8787              │
└─────┬──────────┬──────────┬─────────────────────┘
      │          │          │
      ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐
│PostgreSQL│ │ MinIO  │ │ Redis  │
│  :5432   │ │ :9000  │ │ :6379  │
└──────────┘ └────────┘ └────────┘
```

---

## Services Detail

### 1. PostgreSQL

**Container**: `sigantara-db`
**Port**: 5432
**Credentials**: postgres/postgres
**Database**: sigantara

```bash
# Connect ke database
docker exec -it sigantara-db psql -U postgres -d sigantara

# View files
SELECT id, filename, status FROM files;

# View users
SELECT * FROM users;
```

### 2. MinIO (S3-Compatible Storage)

**Container**: `sigantara-minio`
**API Port**: 9000
**Console Port**: 9001
**Credentials**: minioadmin/minioadmin
**Bucket**: sigantara-files

**Akses Console**:
1. Buka http://localhost:9001
2. Login: minioadmin/minioadmin
3. Browse bucket `sigantara-files`

```bash
# List files in bucket
docker exec sigantara-minio mc ls myminio/sigantara-files
```

### 3. Redis (Queue Simulation)

**Container**: `sigantara-redis`
**Port**: 6379

```bash
# Connect to Redis
docker exec -it sigantara-redis redis-cli

# Check queue
LLEN file-processing-queue

# View queue items
LRANGE file-processing-queue 0 -1
```

### 4. API Server

**Container**: `sigantara-api`
**Port**: 8787

```bash
# View logs
docker logs -f sigantara-api

# Restart API
docker-compose restart api

# Test API
curl http://localhost:8787
```

### 5. Frontend

**Container**: `sigantara-frontend`
**Port**: 3000

```bash
# View logs
docker logs -f sigantara-frontend

# Restart frontend
docker-compose restart frontend
```

---

## Testing Workflow

### Test 1: Upload Image

1. Login sebagai admin
2. Drag & drop image file
3. Lihat progress bar
4. Tunggu status berubah ke "DONE"
5. Verify WebP conversion di MinIO Console
6. Copy permanent link
7. Buka link di browser baru

### Test 2: Role-Based Access

1. Login sebagai `admin/admin`
   - Harus bisa lihat semua files dari semua team
2. Logout
3. Login sebagai `tim/tim`
   - Hanya bisa lihat files dari Team Alpha

### Test 3: File Preview

1. Upload image → Preview harus tampil
2. Upload PDF → Embedded viewer harus tampil
3. Upload ZIP → Metadata only harus tampil

### Test 4: Delete File

1. Pilih file
2. Click Delete
3. Confirm
4. Verify file hilang dari list
5. Check di MinIO Console (harus terhapus)

---

## Development Workflow

### Edit Code

Semua perubahan akan auto-reload:

```bash
# Edit frontend
nano app/dashboard/page.tsx
# Frontend akan auto-reload

# Edit API
nano workers/api/src/index.ts
# API akan auto-reload
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific
docker-compose restart api
docker-compose restart frontend
```

### Stop Services

```bash
# Stop all
docker-compose down

# Stop and remove volumes (reset data)
docker-compose down -v
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port
lsof -i :3000
lsof -i :8787
lsof -i :5432

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

### MinIO Not Accessible

```bash
# Check MinIO status
docker-compose ps minio

# Recreate bucket
docker-compose restart minio-init

# View logs
docker-compose logs minio
```

### Frontend Build Errors

```bash
# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend

# Clear Next.js cache
docker exec sigantara-frontend rm -rf .next
docker-compose restart frontend
```

### API Errors

```bash
# View detailed logs
docker-compose logs -f api

# Check environment variables
docker exec sigantara-api env | grep DATABASE

# Restart API
docker-compose restart api
```

---

## Database Management

### Reset Database

```bash
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d

# Database akan auto-migrate
```

### Manual Migration

```bash
# Run migration
docker exec -i sigantara-db psql -U postgres -d sigantara < migrations/001_initial_schema.sql
```

### Backup Database

```bash
# Backup
docker exec sigantara-db pg_dump -U postgres sigantara > backup.sql

# Restore
docker exec -i sigantara-db psql -U postgres -d sigantara < backup.sql
```

---

## Performance Tips

### Optimize Docker

```bash
# Prune unused resources
docker system prune -a

# Increase Docker memory (Docker Desktop)
# Settings → Resources → Memory: 4GB minimum
```

### Speed Up Builds

```bash
# Use BuildKit
export DOCKER_BUILDKIT=1

# Build with cache
docker-compose build --parallel
```

---

## Advanced Usage

### Run Specific Services

```bash
# Only database and MinIO
docker-compose up -d postgres minio redis

# Run API and frontend locally (outside Docker)
cd workers/api && npm run dev:local
cd ../.. && npm run dev
```

### Custom Environment

Create `.env` file:

```env
# Database
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydb

# MinIO
MINIO_ROOT_USER=myadmin
MINIO_ROOT_PASSWORD=mypassword

# API
JWT_SECRET=my-super-secret-key
```

Then:

```bash
docker-compose --env-file .env up -d
```

### Scale Services

```bash
# Run multiple API instances
docker-compose up -d --scale api=3
```

---

## Monitoring

### Resource Usage

```bash
# Check resource usage
docker stats

# Specific container
docker stats sigantara-api
```

### Health Checks

```bash
# Check all health
docker-compose ps

# API health
curl http://localhost:8787

# Database health
docker exec sigantara-db pg_isready -U postgres
```

---

## Cleanup

### Stop Everything

```bash
# Stop containers
docker-compose down

# Remove volumes (data will be lost)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

### Remove All Docker Resources

```bash
# Nuclear option (removes ALL Docker data)
docker system prune -a --volumes
```

---

## Production Deployment

Docker setup ini **HANYA untuk development**. Untuk production:

1. Deploy frontend ke Vercel/Netlify
2. Deploy API ke Cloudflare Workers (bukan Docker)
3. Use managed PostgreSQL (Neon/Supabase)
4. Use real Cloudflare R2 (bukan MinIO)
5. Use Cloudflare Queues (bukan Redis)

Lihat [DEPLOYMENT.md](file:///home/nicola/SE/sigantara-filemanager/sigantara-filemanager/DEPLOYMENT.md) untuk panduan production.

---

## FAQ

**Q: Kenapa pakai MinIO bukan R2?**
A: R2 tidak bisa dijalankan lokal. MinIO adalah S3-compatible storage yang cocok untuk development.

**Q: Kenapa pakai Redis bukan Cloudflare Queues?**
A: Cloudflare Queues hanya bisa di production. Redis digunakan untuk simulasi queue lokal.

**Q: Apakah data akan hilang jika restart?**
A: Tidak, data disimpan di Docker volumes. Kecuali jika run `docker-compose down -v`.

**Q: Bisa run tanpa Docker?**
A: Bisa, lihat [DEVELOPMENT.md](file:///home/nicola/SE/sigantara-filemanager/sigantara-filemanager/DEVELOPMENT.md) untuk setup manual.

**Q: Kenapa build lama?**
A: First build akan download semua dependencies. Selanjutnya akan lebih cepat karena cache.

---

## Cheat Sheet

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild
docker-compose build

# Reset everything
docker-compose down -v && docker-compose up -d

# Check status
docker-compose ps

# Access database
docker exec -it sigantara-db psql -U postgres -d sigantara

# Access MinIO console
open http://localhost:9001

# Access app
open http://localhost:3000
```

---

## Next Steps

1. ✅ Start Docker services
2. ✅ Access http://localhost:3000
3. ✅ Login dengan admin/admin
4. ✅ Upload test file
5. ✅ Verify WebP conversion
6. ✅ Test file preview
7. ✅ Test delete file
8. ✅ Test role-based access

Selamat testing! 🚀
