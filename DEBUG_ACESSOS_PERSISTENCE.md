# 🐛 Debugging Acessos Persistence Issue

## Issue

- ✅ Filters persist correctly
- ✅ Produtividade data persists
- ❌ Acessos data disappears when navigating away

## What I Added

Enhanced debugging and error handling in `usePersistentState.ts`:

1. **Save logging** - Shows when acessos are saved, how many records, and file size
2. **Load logging** - Shows when acessos are loaded from storage
3. **Error handling** - Better handling of storage quota errors
4. **Size warnings** - Warns if data is > 2MB

## How to Debug

### Step 1: Open Browser Console

1. Open your app: http://localhost:5175
2. Press **F12** to open DevTools
3. Go to **Console** tab

### Step 2: Test and Watch Console

1. **Go to Dashboard**
2. **Apply filters and click "Buscar Acessos"**
3. **Watch console for:**
   ```
   ✅ Saved dashboard_acessos: 1234 records, 567.89 KB
   ```

4. **Navigate to another tab** (e.g., "Escalas Médicas")
5. **Navigate back to Dashboard**
6. **Watch console for:**
   ```
   📥 Loaded dashboard_acessos from storage: 1234 records
   ```

### Step 3: Check sessionStorage Directly

In console, run:
```javascript
// Check if acessos are in storage
const acessos = sessionStorage.getItem('dashboard_acessos');
if (acessos) {
  const parsed = JSON.parse(acessos);
  console.log(`Found ${parsed.length} acessos in storage`);
} else {
  console.log('No acessos in storage!');
}

// Check all dashboard keys and sizes
Object.keys(sessionStorage)
  .filter(k => k.startsWith('dashboard_'))
  .forEach(k => {
    const size = (sessionStorage.getItem(k)?.length || 0) / 1024;
    console.log(`${k}: ${size.toFixed(2)} KB`);
  });
```

## Possible Issues & Solutions

### Issue 1: Quota Exceeded Error

**Console shows:**
```
❌ SessionStorage quota exceeded!
```

**Solution:**
- Browser limit is ~5-10MB total
- If you load too many records, it might exceed this
- Try using smaller date ranges
- The hook will automatically try to clear old data and retry

### Issue 2: Data Not Saving

**Console shows:**
```
📭 No dashboard_acessos found in sessionStorage
```

**Meaning:**
- Data was never saved in the first place
- Check if you saw the "✅ Saved" message earlier
- If not, there was an error during save

### Issue 3: Data Saving But Not Loading

**Console shows save but not load:**
```
✅ Saved dashboard_acessos: 1234 records
(but no "📥 Loaded" message when returning)
```

**Meaning:**
- Data is being saved correctly
- But something is clearing it before the component reads it
- This would indicate a different issue

### Issue 4: Large Data Warning

**Console shows:**
```
⚠️ Large data for key "dashboard_acessos": 3456.78 KB
```

**Meaning:**
- Your data is > 2MB (still under 5-10MB limit)
- Should work, but getting close to limits
- Consider using smaller date ranges

## What to Report Back

After testing, please tell me:

1. **What you see in console when loading data?**
   - Did you see "✅ Saved dashboard_acessos: X records"?

2. **What you see when returning to Dashboard?**
   - Did you see "📥 Loaded dashboard_acessos from storage: X records"?
   - Or did you see "📭 No dashboard_acessos found"?

3. **Any errors in console?**
   - Red error messages?
   - Quota exceeded?

4. **What's in sessionStorage?**
   - Run the check script above
   - Tell me the sizes of each key

## Quick Test Script

Run this in browser console after loading data:

```javascript
// Complete diagnostic
console.log('=== DASHBOARD PERSISTENCE DIAGNOSTIC ===');

// 1. Check all dashboard keys
const keys = Object.keys(sessionStorage).filter(k => k.startsWith('dashboard_'));
console.log(`\nFound ${keys.length} dashboard keys:`);

let totalSize = 0;
keys.forEach(key => {
  const value = sessionStorage.getItem(key);
  const sizeKB = (value?.length || 0) / 1024;
  totalSize += sizeKB;

  if (key === 'dashboard_acessos') {
    try {
      const parsed = JSON.parse(value);
      console.log(`  ${key}: ${sizeKB.toFixed(2)} KB (${parsed.length} records) ✅`);
    } catch (e) {
      console.log(`  ${key}: ${sizeKB.toFixed(2)} KB (PARSE ERROR!) ❌`);
    }
  } else if (value) {
    console.log(`  ${key}: ${sizeKB.toFixed(2)} KB`);
  }
});

console.log(`\nTotal size: ${totalSize.toFixed(2)} KB / ~5000-10000 KB limit`);

// 2. Specific acessos check
const acessosData = sessionStorage.getItem('dashboard_acessos');
if (acessosData) {
  try {
    const acessos = JSON.parse(acessosData);
    console.log(`\n✅ Acessos data is valid: ${acessos.length} records`);

    if (acessos.length > 0) {
      console.log('Sample record:', acessos[0]);
    }
  } catch (e) {
    console.log(`\n❌ Acessos data exists but is corrupted:`, e.message);
  }
} else {
  console.log(`\n❌ No acessos data in sessionStorage`);
}

console.log('\n=== END DIAGNOSTIC ===');
```

## Expected Behavior

**Normal flow:**

1. Load data → Console: `✅ Saved dashboard_acessos: 1234 records, 567 KB`
2. Navigate away → (nothing in console)
3. Navigate back → Console: `📥 Loaded dashboard_acessos from storage: 1234 records`
4. Data appears instantly ✅

**If something is wrong, you'll see:**
- No "✅ Saved" message → Data not being saved
- "❌ Error saving" → Save failed (quota? other error?)
- "📭 No dashboard_acessos found" → Data was cleared somehow
- "❌ Error loading" → Data exists but corrupted

## Next Steps

Based on what you report, we can:

1. **If quota issue:** Implement data compression or pagination
2. **If data clearing:** Find what's clearing it and fix
3. **If corruption:** Fix serialization/deserialization
4. **If something else:** Investigate further

---

**Please test and let me know what you see in the console!** 🔍
