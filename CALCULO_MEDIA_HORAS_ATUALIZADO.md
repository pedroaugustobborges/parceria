# Cálculo de Média de Horas - Atualização

## Mudança Implementada

A "Média de Horas" agora representa a **média de horas trabalhadas por dia**, calculada dividindo o total de horas pelo número total de dias únicos com registros.

## Antes vs Depois

### ANTES:
```typescript
Média de Horas = Total de Horas / Número de Pessoas
```

**Exemplo:**
- 3 pessoas
- Total de horas: 240h
- Média: 240h / 3 = **80h por pessoa**

**Problema:** Não refletia o tempo médio diário de permanência.

### DEPOIS:
```typescript
Média de Horas = Total de Horas / Total de Dias Únicos com Registro
```

**Exemplo:**
- Pessoa A: 40h em 5 dias = 8h/dia
- Pessoa B: 60h em 10 dias = 6h/dia
- Pessoa C: 30h em 5 dias = 6h/dia
- Total: 130h em 20 dias = **6.5h/dia**

**Benefício:** Mostra a média real de tempo de permanência por dia trabalhado.

## Mudanças no Código

### 1. Interface TypeScript Atualizada (`database.types.ts:135`)

```typescript
export interface HorasCalculadas {
  cpf: string;
  nome: string;
  matricula: string;
  tipo: string;
  totalHoras: number;
  diasComRegistro: number;  // ← NOVO CAMPO
  entradas: number;
  saidas: number;
  ultimoAcesso: string;
}
```

### 2. Função `calcularHoras` - Rastreamento de Dias Únicos

**Dashboard.tsx:250** - Inicialização:
```typescript
const diasUnicos = new Set<string>(); // Para contar dias únicos
```

**Dashboard.tsx:280 e 301** - Adiciona dia ao conjunto quando horas são calculadas:
```typescript
diasUnicos.add(dia); // Adiciona o dia ao conjunto de dias únicos
```

**Dashboard.tsx:328** - Retorna a contagem de dias:
```typescript
return {
  cpf,
  nome: ultimoAcesso.nome,
  matricula: ultimoAcesso.matricula,
  tipo: ultimoAcesso.tipo,
  totalHoras: parseFloat(totalHoras.toFixed(2)),
  diasComRegistro: diasUnicos.size,  // ← NOVO CAMPO
  entradas: totalEntradas,
  saidas: totalSaidas,
  ultimoAcesso: ultimoAcesso.data_acesso,
};
```

### 3. Cálculo da Média Atualizado

**Dashboard.tsx:541-546** - Nova lógica:
```typescript
const totalDiasUnicos = horasCalculadas.reduce(
  (sum, item) => sum + item.diasComRegistro,
  0
);
const mediaHoras =
  totalDiasUnicos > 0 ? (totalHorasGeral / totalDiasUnicos).toFixed(2) : "0";
```

### 4. Label Atualizado no Card

**Dashboard.tsx:646** - Texto mais claro:
```typescript
<Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
  Média de Horas por Dia  // ← Antes: "Média de Horas"
</Typography>
```

## Como Funciona

### Rastreamento de Dias Únicos

Para cada pessoa (CPF), o sistema:

1. **Agrupa acessos por dia** (formato YYYY-MM-DD)
2. **Para cada dia**, calcula:
   - Primeira entrada do dia
   - Última saída do dia (ou primeira saída do dia seguinte se não houver saída no mesmo dia)
3. **Adiciona o dia ao conjunto** `diasUnicos` quando consegue calcular horas válidas
4. **Retorna** `diasUnicos.size` como `diasComRegistro`

### Cálculo da Média Global

```typescript
// Soma todos os dias com registro de todas as pessoas
totalDiasUnicos = pessoa1.diasComRegistro + pessoa2.diasComRegistro + ...

// Divide total de horas pelo total de dias
mediaHoras = totalHorasGeral / totalDiasUnicos
```

## Exemplo Prático

### Cenário Real:

**Pessoa 1 (João):**
- Dia 2025-01-15: 8h
- Dia 2025-01-16: 9h
- Dia 2025-01-17: 7h
- **Total:** 24h em 3 dias

**Pessoa 2 (Maria):**
- Dia 2025-01-15: 6h
- Dia 2025-01-18: 8h
- **Total:** 14h em 2 dias

**Pessoa 3 (Pedro):**
- Dia 2025-01-16: 10h
- **Total:** 10h em 1 dia

### Cálculo:

```
Total de Horas = 24h + 14h + 10h = 48h
Total de Dias = 3 + 2 + 1 = 6 dias
Média de Horas por Dia = 48h / 6 = 8h/dia
```

### Estatísticas Exibidas:

| Card | Valor | Cálculo |
|------|-------|---------|
| Total de Pessoas | 3 | Contagem de CPFs únicos |
| Total de Horas | 48h | Soma de todas as horas |
| Média de Horas por Dia | 8h | 48h / 6 dias |

## Benefícios da Mudança

### ✅ Mais Representativo
A média agora reflete o tempo médio de permanência por dia trabalhado, não por pessoa.

### ✅ Útil para Planejamento
Ajuda a entender quanto tempo, em média, as pessoas ficam por dia.

### ✅ Comparável
Permite comparar períodos diferentes de forma justa:
- Janeiro: 8h/dia (20 dias trabalhados)
- Fevereiro: 7.5h/dia (22 dias trabalhados)

### ✅ Considera Frequência
Se alguém trabalha 10h/dia mas só 2 dias, e outro trabalha 6h/dia mas 10 dias, a média agora considera essa diferença.

## Casos Especiais

### Caso 1: Dia sem Saída
Se um dia tem apenas entrada (sem saída no mesmo dia ou dias seguintes):
- ❌ Não contabiliza horas
- ❌ Não adiciona ao `diasUnicos`
- ✅ Não afeta a média

### Caso 2: Entrada com Saída no Dia Seguinte
Se entrada é em um dia e saída no próximo:
- ✅ Contabiliza todas as horas
- ✅ Adiciona **apenas o dia da entrada** ao `diasUnicos`
- ✅ Afeta a média corretamente

### Caso 3: Nenhum Registro
Se `totalDiasUnicos === 0`:
- Média = "0"
- Evita divisão por zero

## Validação

### Para Validar se Está Funcionando:

1. **Verifique no Console do Browser:**
```javascript
// No console, após carregar a página:
console.log(horasCalculadas);

// Cada item deve ter:
// {
//   cpf: "...",
//   nome: "...",
//   totalHoras: 40,
//   diasComRegistro: 5,  // ← Este campo deve existir
//   ...
// }
```

2. **Calcule Manualmente:**
```javascript
// Some os diasComRegistro de todos
const totalDias = horasCalculadas.reduce((sum, p) => sum + p.diasComRegistro, 0);

// Some as horas de todos
const totalHoras = horasCalculadas.reduce((sum, p) => sum + p.totalHoras, 0);

// Divida
const media = totalHoras / totalDias;

// Compare com o card "Média de Horas por Dia"
```

3. **Teste com Dados Conhecidos:**
- Filtre por uma pessoa específica
- Conte manualmente quantos dias diferentes ela tem registros
- Verifique se `diasComRegistro` bate

## Considerações Importantes

### 🔍 O que conta como "Dia com Registro"?

Um dia é adicionado ao contador **apenas** quando:
1. Há pelo menos uma entrada (`sentido = 'E'`)
2. Há uma saída correspondente (`sentido = 'S'`) no mesmo dia ou dias seguintes
3. A diferença de tempo é válida (saída > entrada)

### 📊 Impacto nos Filtros

A média é recalculada automaticamente quando você:
- Filtra por tipo, matrícula, nome, CPF
- Filtra por contrato
- Filtra por período de datas

Sempre considerando apenas os registros filtrados.

### ⚠️ Limitações

- **Plantões noturnos**: Se entrada é 23:00 de um dia e saída 07:00 do próximo, conta como 1 dia (o da entrada)
- **Múltiplas jornadas no mesmo dia**: Atualmente apenas primeira entrada e última saída do dia são consideradas
- **Dias parciais**: Um dia com 1h conta da mesma forma que um dia com 12h para o denominador

## Arquivos Modificados

1. **src/pages/Dashboard.tsx**
   - Linha 250: Adicionado `diasUnicos` Set
   - Linhas 280, 301: Rastreamento de dias únicos
   - Linha 328: Retorno do campo `diasComRegistro`
   - Linhas 541-546: Novo cálculo da média
   - Linha 646: Label atualizado

2. **src/types/database.types.ts**
   - Linha 135: Adicionado campo `diasComRegistro: number`

## Testes Recomendados

1. ✅ Verificar se a média muda ao aplicar filtros de data
2. ✅ Confirmar que pessoas com mais dias não inflam a média artificialmente
3. ✅ Validar que dias sem saída não afetam o cálculo
4. ✅ Checar se o card exibe "Média de Horas por Dia"
5. ✅ Verificar que divisão por zero não ocorre (quando não há registros)
