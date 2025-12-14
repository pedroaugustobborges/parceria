from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Get a few sample records
response = supabase.table('acessos').select('data_acesso, cpf, sentido').limit(5).execute()

print("Sample timestamps from Supabase:")
for record in response.data:
    print(f"  {record['data_acesso']} - CPF: {record['cpf']} - Sentido: {record['sentido']}")
