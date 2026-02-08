# Sigantara File Manager

A modern, team-based file manager with Cloudflare R2 storage, automated queue processing, and file optimization.

## Features

- 🔐 **Role-Based Access Control**: Admin and Team member roles
- ☁️ **Cloudflare R2 Storage**: Scalable, permanent file storage
- 🔄 **Queue Processing**: Automated file optimization with retry logic
- 🖼️ **Image Optimization**: Automatic WebP conversion (quality 80, max 2560px)
- 📄 **PDF Support**: Embedded PDF viewer
- 📦 **Archive Support**: ZIP/RAR file handling
- 🔗 **Permanent Links**: Direct, non-expiring file URLs
- 🎨 **Modern UI**: Dark theme with glassmorphism and smooth animations
- 📱 **Responsive Design**: Works on desktop and mobile

## Tech Stack

### Frontend
- **Next.js 15** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React 19** for UI components

### Backend
- **Cloudflare Workers** for serverless API
- **Cloudflare Queues** for async processing
- **Cloudflare R2** for object storage
- **PostgreSQL** for database
- **Hono** for routing
- **Jose** for JWT authentication

### Processing
- **Sharp** for image optimization
- Support for PDF and archive processing

## Project Structure

```
sigantara-filemanager/
├── app/                      # Next.js app directory
│   ├── login/               # Login page
│   ├── dashboard/           # Main dashboard
│   ├── globals.css          # Global styles
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── FileUpload.tsx       # File upload with drag-and-drop
│   ├── FileList.tsx         # File list with actions
│   └── FilePreview.tsx      # File preview modal
├── lib/                     # Utility libraries
│   ├── auth.ts              # Authentication service
│   └── api.ts               # API client
├── workers/                 # Cloudflare Workers
│   ├── api/                 # API worker
│   │   ├── src/
│   │   │   ├── index.ts     # Main API routes
│   │   │   ├── db.ts        # Database connection
│   │   │   └── middleware/
│   │   │       └── auth.ts  # JWT middleware
│   │   ├── package.json
│   │   └── wrangler.toml
│   └── queue-processor/     # Queue worker
│       ├── src/
│       │   ├── index.ts     # Queue consumer
│       │   └── processors/
│       │       ├── image.ts # Image processing
│       │       ├── pdf.ts   # PDF processing
│       │       └── archive.ts # Archive processing
│       ├── package.json
│       └── wrangler.toml
├── migrations/              # Database migrations
│   └── 001_initial_schema.sql
└── package.json
```

## 🐳 Quick Start dengan Docker (Recommended untuk Testing)

Cara tercepat untuk testing lokal:

```bash
# Start semua services
./start.sh

# Atau manual
docker-compose up -d

# Akses aplikasi
open http://localhost:3000
```

Login dengan:
- **Admin**: `admin / admin`
- **Team**: `tim / tim`

**Lihat panduan lengkap**: [DOCKER_TESTING.md](DOCKER_TESTING.md)

---

## Setup Instructions

### Prerequisites

1. **Cloudflare Account** with:
   - R2 storage enabled (requires paid plan)
   - Workers enabled
   - Queues enabled

2. **PostgreSQL Database**:
   - Neon, Supabase, Railway, or self-hosted
   - PostgreSQL 14+

3. **Node.js** 18+ and npm

### Step 1: Database Setup

1. Create a PostgreSQL database
2. Run the migration:

```bash
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

This creates:
- Tables: `teams`, `users`, `files`, `processing_logs`
- Default teams: Team Alpha, Team Beta, Team Gamma
- Default users: `admin/admin`, `tim/tim`

### Step 2: Cloudflare R2 Setup

1. Create an R2 bucket named `sigantara-files`
2. Configure public access (or use presigned URLs)
3. Get your R2 credentials:
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Public URL

### Step 3: Cloudflare Queue Setup

1. Create a queue named `file-processing-queue`:

```bash
cd workers/api
wrangler queues create file-processing-queue
```

### Step 4: Configure Workers

#### API Worker

1. Navigate to the API worker:

```bash
cd workers/api
npm install
```

2. Update `wrangler.toml` with your values:

```toml
[vars]
DATABASE_URL = "postgresql://user:pass@host:5432/db"
JWT_SECRET = "your-secret-key-change-this"
R2_PUBLIC_URL = "https://your-bucket.r2.cloudflarestorage.com"
```

3. Deploy:

```bash
npm run deploy
```

#### Queue Processor Worker

1. Navigate to the queue processor:

```bash
cd workers/queue-processor
npm install
```

2. Update `wrangler.toml` with your values:

```toml
[vars]
DATABASE_URL = "postgresql://user:pass@host:5432/db"
R2_PUBLIC_URL = "https://your-bucket.r2.cloudflarestorage.com"
```

3. Deploy:

```bash
npm run deploy
```

### Step 5: Configure Frontend

1. Navigate to the project root:

```bash
cd ../..
npm install
```

2. Create `.env.local`:

```bash
cp .env.example .env.local
```

3. Update `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-api-worker.workers.dev
```

4. Run development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Usage

### Login

Use the development credentials:
- **Admin**: `admin / admin` (access all teams)
- **Team Member**: `tim / tim` (access Team Alpha only)

### Upload Files

1. Drag and drop files or click to browse
2. Files are uploaded to R2 temp storage
3. Queue processing begins automatically
4. Status updates in real-time (polling every 5s)

### File Processing

- **Images**: Converted to WebP, max 2560px width, quality 80
- **PDFs**: Optimized (placeholder - requires external service)
- **Archives**: Recompressed (placeholder - requires external service)
- **Other files**: Uploaded without processing

### File States

- `PENDING_UPLOAD`: Initial state
- `UPLOADED`: File uploaded to temp storage
- `PROCESSING`: Queue worker processing
- `DONE`: Processing complete, permanent link available
- `FAILED`: Processing failed after 3 retries

### Permanent Links

Once processing is complete (`DONE` status), files have permanent direct links that never expire.

## API Endpoints

### Authentication

- `POST /auth/login` - Login with username/password

### Files

- `POST /files/presign` - Get presigned upload URL
- `POST /files/finalize` - Finalize upload and enqueue processing
- `GET /files` - List files (filtered by team for non-admin)
- `GET /files/:id` - Get single file
- `DELETE /files/:id` - Delete file

## Development

### Frontend Development

```bash
npm run dev
```

### API Worker Development

```bash
cd workers/api
npm run dev
```

### Queue Processor Development

```bash
cd workers/queue-processor
npm run dev
```

## Production Deployment

### Frontend

Deploy to Vercel, Netlify, or Cloudflare Pages:

```bash
npm run build
```

### Workers

Both workers are deployed via Wrangler:

```bash
cd workers/api && npm run deploy
cd workers/queue-processor && npm run deploy
```

## Security Notes

⚠️ **IMPORTANT**: The current authentication uses hardcoded credentials for development only.

For production:
1. Implement proper password hashing (bcrypt)
2. Use environment variables for credentials
3. Implement proper session management
4. Add rate limiting
5. Enable CORS restrictions
6. Use HTTPS only

## Troubleshooting

### Files stuck in PROCESSING

- Check queue worker logs: `wrangler tail queue-processor`
- Verify R2 bucket permissions
- Check database connectivity

### Upload fails

- Verify presigned URL generation
- Check R2 bucket configuration
- Ensure CORS is configured on R2

### Authentication issues

- Verify JWT_SECRET matches between API and frontend
- Check token expiration (24h default)
- Clear localStorage and re-login

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
