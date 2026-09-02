-- =====================================================================
-- MIGRAÇÃO 2026-08-18 (2) — fórmula por ordem + rendimento dinâmico
--
-- Aplicar depois de 2026-08-18-estoque-por-lote-e-envios.sql.
-- Sem USE de propósito: roda no banco em que você conectar.
-- Pode ser executado mais de uma vez sem duplicar nada.
--
-- O que muda:
--   1. ordens_producao.quantidade_produzida — o real, informado ao concluir;
--      é o numerador do rendimento (produzido ÷ planejado)
--   2. tabela ordem_formula_itens — snapshot da fórmula por ordem, editável
--      durante a execução sem tocar na fórmula cadastrada do produto
--   3. snapshot retroativo das ordens que ainda não foram concluídas
--   4. produtos.rendimento_linha_pct sai: o rendimento passa a ser sempre o
--      da linha (histórico, com o cadastro servindo de fallback)
-- =====================================================================

-- --- 1) Quantidade realmente produzida -------------------------------
SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordens_producao'
                AND COLUMN_NAME = 'quantidade_produzida');
SET @sql := IF(@tem = 0,
  'ALTER TABLE ordens_producao ADD COLUMN quantidade_produzida DECIMAL(14,3) NULL AFTER quantidade',
  'SELECT "quantidade_produzida já existe" AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ordens já concluídas antes desta mudança não têm medição: assume-se que
-- saíram conforme o planejado, para não distorcer a média histórica.
UPDATE ordens_producao
   SET quantidade_produzida = quantidade
 WHERE status = 'concluida' AND quantidade_produzida IS NULL;

-- Data real da conclusão: usada na janela de 6 meses do rendimento e no
-- gráfico mensal. data_fim é planejada e pode estar vazia, por isso a coluna.
SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordens_producao'
                AND COLUMN_NAME = 'concluida_em');
SET @sql := IF(@tem = 0,
  'ALTER TABLE ordens_producao ADD COLUMN concluida_em DATETIME NULL AFTER quantidade_produzida',
  'SELECT "concluida_em já existe" AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Retroativo: melhor aproximação para o que já estava concluído
UPDATE ordens_producao
   SET concluida_em = COALESCE(data_fim, DATE(criado_em))
 WHERE status = 'concluida' AND concluida_em IS NULL;

-- --- 2) Snapshot da fórmula por ordem --------------------------------
CREATE TABLE IF NOT EXISTS ordem_formula_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ordem_id INT NOT NULL,
  materia_prima_id INT NOT NULL,
  quantidade DECIMAL(14,4) NOT NULL,                  -- quantidade por lote
  FOREIGN KEY (ordem_id) REFERENCES ordens_producao(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_prima_id) REFERENCES materias_primas(id)
) ENGINE=InnoDB;

-- --- 3) Snapshot retroativo das ordens em aberto ----------------------
-- Sem isto, ordem criada antes da mudança ficaria sem fórmula e não
-- conseguiria ser concluída. Concluídas ficam de fora: já consumiram.
INSERT INTO ordem_formula_itens (ordem_id, materia_prima_id, quantidade)
SELECT op.id, fi.materia_prima_id, fi.quantidade
  FROM ordens_producao op
  JOIN formula_itens fi ON fi.produto_id = op.produto_id
 WHERE op.status IN ('planejada','liberada','em_producao')
   AND NOT EXISTS (SELECT 1 FROM ordem_formula_itens ofi WHERE ofi.ordem_id = op.id);

-- --- 4) Rendimento por produto sai -----------------------------------
SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produtos'
                AND COLUMN_NAME = 'rendimento_linha_pct');
SET @sql := IF(@tem > 0,
  'ALTER TABLE produtos DROP COLUMN rendimento_linha_pct',
  'SELECT "rendimento_linha_pct já removida" AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --- Conferência -----------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM ordem_formula_itens) AS itens_snapshot,
  (SELECT COUNT(DISTINCT ordem_id) FROM ordem_formula_itens) AS ordens_com_snapshot,
  (SELECT COUNT(*) FROM ordens_producao
    WHERE status IN ('planejada','liberada','em_producao')
      AND id NOT IN (SELECT ordem_id FROM ordem_formula_itens)) AS ordens_abertas_sem_snapshot;
