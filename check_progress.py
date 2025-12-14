from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()
supabase = create_client(os.getenv('VITE_SUPABASE_URL'), os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY'))

print("Checking database status...\n")

# Count total records
response_total = supabase.table('acessos').select('id', count='exact').limit(1).execute()
total = response_total.count
print(f"Total records in acessos table: {total:,}")

# Sample first 100 records to check format
response_sample = supabase.table('acessos').select('data_acesso').limit(100).execute()

old_format = 0
new_format = 0

for r in response_sample.data:
    if '+00:00' in r['data_acesso']:
        old_format += 1
    elif '-03:00' in r['data_acesso']:
        new_format += 1

print(f"\nSample of first 100 records:")
print(f"  OLD format (+00:00): {old_format}")
print(f"  NEW format (-03:00): {new_format}")

# Estimate total (rough)
if old_format + new_format > 0:
    pct_new = (new_format / (old_format + new_format)) * 100
    estimated_done = int(total * pct_new / 100)
    print(f"\nEstimated progress: {pct_new:.1f}% ({estimated_done:,} of {total:,})")
    
    if old_format > 0:
        print(f"⏳ Still processing... Script is working!")
    else:
        print(f"✅ All sampled records are in new format!")

print("\nMost recent records:")
recent = supabase.table('acessos').select('data_acesso, cpf, nome').order('id', desc=True).limit(3).execute()
for r in recent.data:
    status = "✅" if "-03:00" in r['data_acesso'] else "❌"
    print(f"  {status} {r['data_acesso']} - {r['nome'][:30]}")
