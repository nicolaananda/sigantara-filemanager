# Local Development Guide

This guide helps you run the Sigantara File Manager locally for development and testing.

## Quick Start

### 1. Install Dependencies

```bash
# Frontend
npm install

# API Worker
cd workers/api
npm install

# Queue Processor
cd ../queue-processor
npm install
cd ../..
```

### 2. Set Up Local Database

#### Using Docker (Recommended)

```bash
# Start PostgreSQL
docker run -d \
  --name sigantara-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sigantara \
  -p 5432:5432 \
  postgres:14

# Run migration
psql postgresql://postgres:postgres@localhost:5432/sigantara -f migrations/001_initial_schema.sql
```

#### Using Local PostgreSQL

```bash
# Create database
createdb sigantara

# Run migration
psql sigantara -f migrations/001_initial_schema.sql
```

### 3. Configure Local Environment

#### Frontend (.env.local)

```bash
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8787
EOF
```

#### API Worker (.dev.vars)

```bash
cd workers/api
cat > .dev.vars << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sigantara
JWT_SECRET=dev-secret-key-change-in-production
R2_PUBLIC_URL=http://localhost:8787/r2
EOF
cd ../..
```

#### Queue Processor (.dev.vars)

```bash
cd workers/queue-processor
cat > .dev.vars << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sigantara
R2_PUBLIC_URL=http://localhost:8787/r2
EOF
cd ../..
```

### 4. Start Development Servers

Open 3 terminal windows:

#### Terminal 1: Frontend

```bash
npm run dev
# Runs on http://localhost:3000
```

#### Terminal 2: API Worker

```bash
cd workers/api
npm run dev
# Runs on http://localhost:8787
```

#### Terminal 3: Queue Processor

```bash
cd workers/queue-processor
npm run dev
# Runs in background, processes queue
```

### 5. Access the Application

1. Open [http://localhost:3000](http://localhost:3000)
2. Login with:
   - **Admin**: `admin / admin`
   - **Team**: `tim / tim`

## Development Workflow

### Making Changes

#### Frontend Changes

1. Edit files in `app/`, `components/`, or `lib/`
2. Next.js will auto-reload
3. Check browser console for errors

#### API Worker Changes

1. Edit files in `workers/api/src/`
2. Wrangler will auto-reload
3. Check terminal for errors

#### Queue Processor Changes

1. Edit files in `workers/queue-processor/src/`
2. Restart the dev server
3. Check terminal for errors

### Testing File Upload Locally

> [!WARNING]
> **R2 Local Development Limitation**
> 
> Cloudflare R2 doesn't have a local emulator. For local development, you have two options:

#### Option 1: Use Real R2 (Recommended)

1. Create a development R2 bucket
2. Update `.dev.vars` with real R2 credentials
3. Files will be uploaded to real R2

#### Option 2: Mock R2 (For Testing)

Create a mock R2 service:

```typescript
// workers/api/src/mock-r2.ts
export class MockR2Bucket {
  private storage = new Map<string, ArrayBuffer>();

  async put(key: string, value: ArrayBuffer) {
    this.storage.set(key, value);
    return { key };
  }

  async get(key: string) {
    const data = this.storage.get(key);
    if (!data) return null;
    return {
      arrayBuffer: async () => data,
    };
  }

  async delete(key: string) {
    this.storage.delete(key);
  }

  async createPresignedUrl(key: string, options: any) {
    return `http://localhost:8787/mock-upload/${key}`;
  }
}
```

### Database Management

#### View Data

```bash
# Connect to database
psql postgresql://postgres:postgres@localhost:5432/sigantara

# List files
SELECT id, filename, status, created_at FROM files;

# List users
SELECT id, username, role FROM users;

# View processing logs
SELECT * FROM processing_logs ORDER BY created_at DESC LIMIT 10;
```

#### Reset Database

```bash
# Drop and recreate
dropdb sigantara
createdb sigantara
psql sigantara -f migrations/001_initial_schema.sql
```

### Debugging

#### Frontend Debugging

1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab for API calls
4. Use React DevTools extension

#### API Worker Debugging

```bash
cd workers/api
npm run dev

# In another terminal, watch logs
wrangler tail --local
```

#### Queue Processor Debugging

```bash
cd workers/queue-processor
npm run dev

# Add console.log statements in src/index.ts
# Logs will appear in terminal
```

#### Database Debugging

```bash
# Enable query logging
export DEBUG=postgres:*

# Or use pgAdmin/DBeaver for GUI
```

## Common Development Tasks

### Add a New API Endpoint

1. Edit `workers/api/src/index.ts`
2. Add route:

```typescript
app.post('/files/my-endpoint', authMiddleware, async (c) => {
  // Your logic here
  return c.json({ success: true });
});
```

3. Add to API service in `lib/api.ts`:

```typescript
async myEndpoint(): Promise<any> {
  const response = await fetch(`${API_URL}/files/my-endpoint`, {
    method: 'POST',
    headers: this.getHeaders(),
  });
  return response.json();
}
```

### Add a New Component

1. Create file in `components/MyComponent.tsx`
2. Use TypeScript and Framer Motion:

```typescript
'use client';

import { motion } from 'framer-motion';

export default function MyComponent() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card"
    >
      {/* Your content */}
    </motion.div>
  );
}
```

3. Import in page or other component

### Add a New File Processor

1. Create file in `workers/queue-processor/src/processors/mytype.ts`
2. Implement processor:

```typescript
export async function processMyType(buffer: ArrayBuffer): Promise<{
  buffer: Buffer;
  extension: string;
} | null> {
  // Your processing logic
  return {
    buffer: processedBuffer,
    extension: 'newext',
  };
}
```

3. Add to main processor in `workers/queue-processor/src/index.ts`

### Add Database Migration

1. Create new file `migrations/002_my_changes.sql`
2. Write SQL:

```sql
-- Add new column
ALTER TABLE files ADD COLUMN my_field VARCHAR(255);

-- Create index
CREATE INDEX idx_files_my_field ON files(my_field);
```

3. Run migration:

```bash
psql sigantara -f migrations/002_my_changes.sql
```

## Testing

### Manual Testing Checklist

- [ ] Login as admin
- [ ] Login as team member
- [ ] Upload image (< 1MB)
- [ ] Upload image (> 10MB)
- [ ] Upload PDF
- [ ] Upload ZIP
- [ ] Upload unknown file type
- [ ] Delete file
- [ ] Preview image
- [ ] Preview PDF
- [ ] Copy permanent link
- [ ] Logout and login again
- [ ] Test on mobile viewport

### Automated Testing (Future)

To add tests:

```bash
# Install testing libraries
npm install -D @testing-library/react @testing-library/jest-dom jest

# Create test file
# components/__tests__/FileUpload.test.tsx
```

## Performance Optimization

### Frontend

- Use Next.js Image component for images
- Implement virtual scrolling for large file lists
- Add pagination for file list
- Use React.memo for expensive components

### Backend

- Add database connection pooling
- Implement caching for file list
- Use database indexes effectively
- Optimize SQL queries

### Queue Processing

- Process multiple files in parallel
- Implement batch processing
- Add progress tracking
- Optimize image processing settings

## Troubleshooting

### "Module not found" errors

```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### "Database connection failed"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Or for local PostgreSQL
pg_isready
```

### "Wrangler errors"

```bash
# Update Wrangler
npm install -g wrangler@latest

# Clear Wrangler cache
rm -rf .wrangler
```

### "Port already in use"

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

## Code Style

### TypeScript

- Use strict mode
- Define interfaces for all data structures
- Avoid `any` type
- Use async/await over promises

### React

- Use functional components
- Use hooks (useState, useEffect, etc.)
- Implement proper error boundaries
- Add loading states

### CSS

- Use Tailwind utility classes
- Define custom classes in globals.css
- Use CSS variables for theming
- Keep styles consistent

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add my feature"

# Push to remote
git push origin feature/my-feature

# Create pull request
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

## Getting Help

1. Check the [README.md](file:///home/nicola/SE/sigantara-filemanager/sigantara-filemanager/README.md)
2. Review the [walkthrough.md](file:///home/nicola/.gemini/antigravity/brain/add50c12-4915-4758-a3f2-60dd3ea2b158/walkthrough.md)
3. Check worker logs with `wrangler tail`
4. Review database with `psql`
5. Check browser console for frontend errors
