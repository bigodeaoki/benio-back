-- =====================================================================
-- MIGRAÇÃO 2026-09-15 (3) — papel "administrativo"
--
-- Novo papel de usuário para a rotina de escritório: pedidos e NF-e,
-- compras (notas de fornecedor) e cadastro de matérias-primas, movimentos
-- de estoque, remessas e documentos. Sem produção, fórmulas, linhas,
-- utilidades e configurações. As permissões ficam em
-- backend/src/auth/papeis.ts; aqui só entra o valor no ENUM.
--
-- Sem USE de propósito: roda no banco em que você conectar.
-- Pode ser executado mais de uma vez sem duplicar nada.
--
--   mysql --protocol=TCP -h HOST -P PORTA -u root -pSENHA benio \
--     < mysql/migrations/2026-09-15-papel-administrativo.sql
-- =====================================================================

SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'
                AND COLUMN_NAME = 'papel' AND COLUMN_TYPE LIKE '%administrativo%');
SET @sql := IF(@tem = 0,
  "ALTER TABLE usuarios MODIFY papel ENUM('admin','producao','qualidade','compras','vendas','administrativo','financeiro','operador') NOT NULL DEFAULT 'operador'",
  'SELECT "papel administrativo já existe" AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --- Conferência -----------------------------------------------------
SELECT COLUMN_TYPE AS papel_enum
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'papel';
