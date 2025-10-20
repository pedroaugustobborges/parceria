"""
Script rápido para verificar quantos CPFs estão na tabela usuarios
e estimar quantos registros seriam importados.
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

def main():
    print("=" * 70)
    print("VERIFICAÇÃO DE CPFs NA TABELA USUARIOS")
    print("=" * 70)

    try:
        # Conectar ao Supabase
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(f"\n✅ Conectado ao Supabase")

        # Buscar todos os CPFs
        response = supabase.table('usuarios').select('cpf, nome, tipo').execute()

        print(f"\n📊 Total de usuários na tabela: {len(response.data)}")

        cpfs = []
        for usuario in response.data:
            if usuario.get('cpf'):
                cpfs.append(usuario['cpf'])
                print(f"  - {usuario['nome']:40} | CPF: {usuario['cpf']:15} | Tipo: {usuario['tipo']}")

        print(f"\n📋 Total de CPFs válidos: {len(cpfs)}")
        print(f"\n📈 ESTIMATIVA DE IMPORTAÇÃO (50 registros por CPF):")
        print(f"   - Máximo de registros a buscar: {len(cpfs) * 50}")
        print(f"   - Nota: O total real dependerá de:")
        print(f"     • Quantos acessos cada CPF realmente tem no Data Warehouse")
        print(f"     • Quantos registros já existem na tabela acessos (duplicatas)")

        print(f"\n✅ Verificação concluída!")

    except Exception as e:
        print(f"\n❌ Erro: {e}")

if __name__ == "__main__":
    main()
