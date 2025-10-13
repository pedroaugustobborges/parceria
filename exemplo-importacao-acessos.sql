-- Exemplo de Importação de Acessos para Testes
-- Execute este script após configurar o banco de dados

-- Inserir contratos de exemplo
INSERT INTO contratos (nome, empresa, data_inicio, ativo) VALUES
('Contrato Limpeza 2024', 'Limpeza Total Ltda', '2024-01-01', TRUE),
('Contrato Segurança 2024', 'Segurança Máxima S.A.', '2024-01-01', TRUE),
('Contrato TI 2024', 'TechSolutions Informática', '2024-01-01', TRUE);

-- Inserir acessos de exemplo (para demonstração)
-- Formato: tipo, matricula, nome, cpf, data_acesso, sentido

-- Colaborador 1 - Dia 1
INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES
('Terceiro', '001', 'João Silva', '12345678901', '2024-01-15 08:00:00', 'E'),
('Terceiro', '001', 'João Silva', '12345678901', '2024-01-15 12:00:00', 'S'),
('Terceiro', '001', 'João Silva', '12345678901', '2024-01-15 13:00:00', 'E'),
('Terceiro', '001', 'João Silva', '12345678901', '2024-01-15 17:00:00', 'S');

-- Colaborador 1 - Dia 2
INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES
('Terceiro', '001', 'João Silva', '12345678901', '2024-01-16 08:15:00', 'E'),
('Terceiro', '001', 'João Silva', '12345678901', '2024-01-16 17:30:00', 'S');

-- Colaborador 2 - Dia 1
INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES
('Terceiro', '002', 'Maria Santos', '98765432109', '2024-01-15 07:45:00', 'E'),
('Terceiro', '002', 'Maria Santos', '98765432109', '2024-01-15 16:45:00', 'S');

-- Colaborador 2 - Dia 2
INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES
('Terceiro', '002', 'Maria Santos', '98765432109', '2024-01-16 08:00:00', 'E'),
('Terceiro', '002', 'Maria Santos', '98765432109', '2024-01-16 12:00:00', 'S'),
('Terceiro', '002', 'Maria Santos', '98765432109', '2024-01-16 13:00:00', 'E'),
('Terceiro', '002', 'Maria Santos', '98765432109', '2024-01-16 18:00:00', 'S');

-- Colaborador 3 - Dia 1
INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES
('Terceiro', '003', 'Pedro Oliveira', '11122233344', '2024-01-15 09:00:00', 'E'),
('Terceiro', '003', 'Pedro Oliveira', '11122233344', '2024-01-15 18:00:00', 'S');

-- Colaborador 4 - Dia 1
INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES
('Terceiro', '004', 'Ana Costa', '55566677788', '2024-01-15 08:30:00', 'E'),
('Terceiro', '004', 'Ana Costa', '55566677788', '2024-01-15 17:30:00', 'S');

-- Colaborador 5 - Dia 1 (Segurança)
INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES
('Segurança', '005', 'Carlos Mendes', '99988877766', '2024-01-15 06:00:00', 'E'),
('Segurança', '005', 'Carlos Mendes', '99988877766', '2024-01-15 14:00:00', 'S');

-- Colaborador 5 - Dia 2
INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES
('Segurança', '005', 'Carlos Mendes', '99988877766', '2024-01-16 06:00:00', 'E'),
('Segurança', '005', 'Carlos Mendes', '99988877766', '2024-01-16 14:00:00', 'S');

-- Verificar os dados inseridos
SELECT
  cpf,
  nome,
  COUNT(*) as total_registros,
  SUM(CASE WHEN sentido = 'E' THEN 1 ELSE 0 END) as entradas,
  SUM(CASE WHEN sentido = 'S' THEN 1 ELSE 0 END) as saidas
FROM acessos
GROUP BY cpf, nome
ORDER BY nome;

-- Calcular horas trabalhadas (exemplo simplificado)
-- Este é apenas um exemplo, o cálculo real é feito no frontend
WITH entradas AS (
  SELECT cpf, nome, data_acesso, ROW_NUMBER() OVER (PARTITION BY cpf ORDER BY data_acesso) as rn
  FROM acessos WHERE sentido = 'E'
),
saidas AS (
  SELECT cpf, data_acesso, ROW_NUMBER() OVER (PARTITION BY cpf ORDER BY data_acesso) as rn
  FROM acessos WHERE sentido = 'S'
)
SELECT
  e.cpf,
  e.nome,
  ROUND(SUM(EXTRACT(EPOCH FROM (s.data_acesso - e.data_acesso)) / 3600)::numeric, 2) as horas_trabalhadas
FROM entradas e
JOIN saidas s ON e.cpf = s.cpf AND e.rn = s.rn
GROUP BY e.cpf, e.nome
ORDER BY horas_trabalhadas DESC;
