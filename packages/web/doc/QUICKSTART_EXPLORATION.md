# Quick Start Guide: Exploration Feature

## Prerequisites

1. **Migrated Data**: Run the migration script first if you haven't:
```bash
cd /Users/bjornpjo/Developer/apps/kromosynth-recommend/migration
node scripts/migrate-firestore-favourites-to-kuzudb.js --firebase-config path/to/config.json
```

2. **Services Running**: You need both services running

## Step-by-Step Instructions

### 1. Start kromosynth-recommend Service

```bash
cd /Users/bjornpjo/Developer/apps/kromosynth-recommend

# Make sure KuzuDB is accessible (check .env settings)
# Start the service
npm start
```

Expected output:
```
kromosynth-recommend server running on port 3004
User API: http://localhost:3004/api/user
Internal API: http://localhost:3004/api/internal
Exploration API: http://localhost:3004/api/exploration
✓ Database connection established
```

### 2. Start kromosynth-desktop

```bash
cd /Users/bjornpjo/Developer/apps/kromosynth-desktop

# Start the Vite dev server
npm run dev
```

Expected output:
```
  VITE vX.X.X  ready in XXX ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### 3. Access the Feature

1. **Open Browser**: Navigate to http://localhost:3000
2. **Sign In**: Click "Sign In" or "Create Account" (or continue as anonymous)
3. **Navigate**: Click "Explore Favorites" in the navigation bar (Compass icon)
4. **Explore**: 
   - Browse the sound grid
   - Click Play buttons to hear sounds
   - Click user avatars to see their profiles
   - Use search and filters

## Troubleshooting

### Problem: No sounds appear

**Check 1: Is kromosynth-recommend running?**
```bash
curl http://localhost:3004/health
```
Should return: `{"status":"healthy",...}`

**Check 2: Are there sounds in KuzuDB?**
```bash
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3004/api/exploration/stats
```
Should show counts > 0

**Check 3: Browser console errors?**
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed API calls

### Problem: Authentication errors

**Check localStorage:**
```javascript
// In browser console
localStorage.getItem('kromosynth_token')
```

**Try clearing and re-authenticating:**
```javascript
localStorage.clear()
// Then sign in again
```

### Problem: Sound won't play

**Check 1: Genome service accessible?**
- The ExplorationView fetches genomes from REST_ENDPOINTS.GENOME
- Default: http://localhost:3004/evoruns/{folder}/genome/{id}

**Check 2: CORS issues?**
- Check browser console for CORS errors
- kromosynth-recommend should allow localhost:3000

**Check 3: Audio context issues?**
- Some browsers block audio without user interaction
- Click Play button (don't try to auto-play)

## Environment Variables

### kromosynth-recommend (.env)
```env
PORT=3004
NODE_ENV=development

# KuzuDB configuration
KUZU_DATABASE_PATH=./data/kuzu_db

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Auth service (if using real auth)
AUTH_SERVICE_URL=http://localhost:3002

# Optional: Vector extension
KUZU_VECTOR_EXTENSION_PATH=./data/kuzu_extension/libvector.kuzu_extension
```

### kromosynth-desktop (.env)
```env
# API endpoints
VITE_RECOMMEND_SERVICE_URL=http://localhost:3004
VITE_AUTH_SERVICE_URL=http://localhost:3002
VITE_DEFAULT_REST_SERVICE_HOST=http://localhost:3004

# Rendering service
VITE_RENDERING_SOCKET_SERVER=ws://localhost:3000
```

## Verify Installation

### 1. Check API Endpoints

```bash
# Health check
curl http://localhost:3004/health

# Exploration stats
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3004/api/exploration/stats

# List adopted sounds
curl -H "Authorization: Bearer mock-jwt-token" \
  "http://localhost:3004/api/exploration/adopted-sounds?limit=5"
```

### 2. Check Frontend

1. Open: http://localhost:3000/exploration
2. Open DevTools > Network tab
3. Should see API calls to /api/exploration/adopted-sounds
4. Should see sounds displayed in grid

## Development Tips

### Mock Data Mode

If the API isn't working, the ExplorationView will automatically fall back to mock data. Look for this in the console:
```
Failed to load adopted sounds. Using mock data for development.
```

### Adding Debug Logging

In ExplorationView.jsx, uncomment debug logs:
```javascript
console.log('Loaded sounds:', sounds);
console.log('Current user:', user);
console.log('Rendering sound:', sound.id);
```

### Database Inspection

To inspect KuzuDB data directly:
```javascript
// In migration scripts or Node REPL
const { getDatabase } = require('./src/config/database');
const db = getDatabase();

await db.connect();

// Check sound count
const result = await db.query('MATCH (s:sounds) RETURN count(s) as count');
console.log('Total sounds:', result[0].count);

// Check relationships
const result2 = await db.query('MATCH ()-[a:adopted]->() RETURN count(a) as count');
console.log('Total adoptions:', result2[0].count);
```

## Next Steps

Once everything is working:

1. **Explore the Data**: Click around, play sounds, navigate user profiles
2. **Check Stats**: Look at the statistics dashboard to understand your data
3. **Test Search**: Try searching for different sound classes
4. **Profile Navigation**: Click user avatars to explore relationships
5. **Monitor Performance**: Watch API response times in Network tab

## Getting Help

- Check EXPLORATION_FEATURE.md for detailed documentation
- Review console logs in both frontend and backend
- Inspect Network tab for API call details
- Check KuzuDB logs if database queries are slow

## Success Indicators

✅ ExplorationView loads without errors
✅ Statistics show actual numbers (not 0s)
✅ Sounds display in grid with metadata
✅ Play button renders and plays audio
✅ User avatars are clickable
✅ Search and filters work
✅ No CORS or authentication errors in console

If you see all these ✅, congratulations - the feature is working! 🎉
