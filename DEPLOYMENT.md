# Quick Deployment Guide

This guide will help you deploy the Sigantara File Manager to production.

## Prerequisites Checklist

- [ ] Cloudflare account with Workers, R2, and Queues enabled
- [ ] PostgreSQL database (Neon, Supabase, Railway, or self-hosted)
- [ ] Node.js 18+ installed
- [ ] Wrangler CLI installed (`npm install -g wrangler`)

## Step-by-Step Deployment

### 1. Database Setup (5 minutes)

#### Option A: Neon (Recommended)

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Run migration:

```bash
psql "your-connection-string" -f migrations/001_initial_schema.sql
```

#### Option B: Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database → Connection string
4. Run migration using the connection string

### 2. Cloudflare R2 Setup (3 minutes)

```bash
# Login to Cloudflare
wrangler login

# Create R2 bucket
wrangler r2 bucket create sigantara-files

# Get your account ID
wrangler whoami
```

Note your:
- Account ID
- R2 bucket name: `sigantara-files`
- R2 public URL (or configure custom domain)

### 3. Cloudflare Queue Setup (2 minutes)

```bash
cd workers/api
wrangler queues create file-processing-queue
```

### 4. Deploy API Worker (5 minutes)

```bash
cd workers/api
npm install

# Edit wrangler.toml and update:
# - DATABASE_URL
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - R2_PUBLIC_URL

# Deploy
npm run deploy
```

Note the deployed URL (e.g., `https://sigantara-api.your-subdomain.workers.dev`)

### 5. Deploy Queue Processor (5 minutes)

```bash
cd ../queue-processor
npm install

# Edit wrangler.toml and update:
# - DATABASE_URL
# - R2_PUBLIC_URL

# Deploy
npm run deploy
```

### 6. Deploy Frontend (5 minutes)

#### Option A: Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Create .env.local
echo "NEXT_PUBLIC_API_URL=https://your-api-worker.workers.dev" > .env.local

# Deploy
vercel
```

#### Option B: Cloudflare Pages

```bash
# Build the app
npm install
npm run build

# Deploy to Pages
wrangler pages deploy out
```

### 7. Test the Deployment

1. Open your deployed frontend URL
2. Login with `admin/admin`
3. Upload a test image
4. Verify it converts to WebP
5. Check the permanent link works

## Environment Variables Reference

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=https://your-api-worker.workers.dev
```

### API Worker (wrangler.toml)

```toml
[vars]
DATABASE_URL = "postgresql://user:pass@host:5432/db"
JWT_SECRET = "your-generated-secret-key"
R2_PUBLIC_URL = "https://pub-xxxxx.r2.dev"
```

### Queue Processor (wrangler.toml)

```toml
[vars]
DATABASE_URL = "postgresql://user:pass@host:5432/db"
R2_PUBLIC_URL = "https://pub-xxxxx.r2.dev"
```

## Troubleshooting

### "R2 bucket not found"

Make sure the bucket name in `wrangler.toml` matches the created bucket:

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "sigantara-files"  # Must match your bucket
```

### "Database connection failed"

- Verify DATABASE_URL is correct
- Check if database allows connections from Cloudflare IPs
- For Neon/Supabase, ensure connection pooling is enabled

### "Queue not found"

Make sure queue name matches in both workers:

```toml
# API worker
[[queues.producers]]
binding = "FILE_QUEUE"
queue = "file-processing-queue"

# Queue processor
[[queues.consumers]]
queue = "file-processing-queue"
```

### "CORS errors"

Add CORS headers to R2 bucket or use presigned URLs (already implemented).

## Production Checklist

Before going to production:

- [ ] Change JWT_SECRET to a strong random value
- [ ] Implement proper password hashing (bcrypt)
- [ ] Set up custom domain for R2 bucket
- [ ] Enable HTTPS only
- [ ] Add rate limiting to API
- [ ] Set up monitoring and alerts
- [ ] Configure backup for PostgreSQL
- [ ] Test all file types (images, PDFs, archives)
- [ ] Test with large files (>100MB)
- [ ] Load test with multiple concurrent uploads

## Monitoring

### View API Worker Logs

```bash
cd workers/api
wrangler tail
```

### View Queue Processor Logs

```bash
cd workers/queue-processor
wrangler tail
```

### Check Queue Status

```bash
wrangler queues list
```

## Updating the Application

### Update API Worker

```bash
cd workers/api
git pull
npm install
npm run deploy
```

### Update Queue Processor

```bash
cd workers/queue-processor
git pull
npm install
npm run deploy
```

### Update Frontend

```bash
git pull
npm install
npm run build
vercel --prod  # or your deployment method
```

## Cost Estimation

### Cloudflare (Pay-as-you-go)

- **Workers**: $5/month for 10M requests
- **R2 Storage**: $0.015/GB/month
- **R2 Operations**: Class A $4.50/million, Class B $0.36/million
- **Queues**: Included in Workers plan

### Database

- **Neon**: Free tier (0.5GB), $19/month for 3GB
- **Supabase**: Free tier (500MB), $25/month for 8GB

### Total Estimated Cost

- Small team (< 1000 files/month): **~$10-20/month**
- Medium team (< 10000 files/month): **~$30-50/month**

## Support

For issues:
1. Check the [README.md](file:///home/nicola/SE/sigantara-filemanager/sigantara-filemanager/README.md)
2. Review worker logs with `wrangler tail`
3. Check database connectivity
4. Verify all environment variables are set correctly
