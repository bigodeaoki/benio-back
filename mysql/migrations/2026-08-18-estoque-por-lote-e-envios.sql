-- =====================================================================
-- MIGRAÇÃO 2026-08-18 — estoque por lote de compra (FIFO) + controle de envio
--
-- Leva um banco que já está em produção do schema anterior para o atual,
-- sem perder dados. Os scripts de mysql/init/ só rodam em volume novo,
-- então em ambiente que já existe (Railway) é este arquivo que vale.
--
--   mysql --protocol=TCP -h HOST -P PORTA -u root -pSENHA railway \
--     < mysql/migrations/2026-08-18-estoque-por-lote-e-envios.sql
--
-- Sem USE de propósito: roda no banco em que você conectar.
-- Pode ser executado mais de uma vez sem duplicar nada.
--
-- O que muda:
--   1. tabela materia_compras — cada nota de fornecedor vira um lote
--   2. o estoque que já existe vira um lote de abertura por matéria-prima
--   3. materias_primas perde rendimento_pct (saiu do cálculo de custo)
--   4. ordens_producao ganha o status 'finalizada'
--   5. tabela envios — remessas por ordem de produção
-- =====================================================================

-- --- 1) Lotes de compra ----------------------------------------------
CREATE TABLE IF NOT EXISTS materia_compras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  materia_prima_id INT NOT NULL,
  fornecedor VARCHAR(160) NOT NULL,
  numero_nota VARCHAR(40),
  data_compra DATE NOT NULL,
  quantidade DECIMAL(14,3) NOT NULL,             -- comprada
  quantidade_restante DECIMAL(14,3) NOT NULL,    -- ainda em estoque
  valor_unitario DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  observacao VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_compra_fifo (materia_prima_id, status, data_compra, id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_prima_id) REFERENCES materias_primas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --- 2) Saldo existente vira lote de abertura ------------------------
-- Sem isto o estoque de todo mundo iria a zero, porque o saldo passa a ser
-- a soma dos lotes. O NOT EXISTS evita duplicar se rodar de novo.
INSERT INTO materia_compras
  (empresa_id, materia_prima_id, fornecedor, numero_nota, data_compra,
   quantidade, quantidade_restante, valor_unitario, status, observacao)
SELECT mp.empresa_id, mp.id, 'Saldo inicial', NULL, CURDATE(),
       mp.estoque_atual, mp.estoque_atual, mp.custo_unitario, 'ativo',
       'Lote de abertura (saldo anterior ao controle por compra)'
  FROM materias_primas mp
 WHERE mp.estoque_atual > 0
   AND NOT EXISTS (SELECT 1 FROM materia_compras c WHERE c.materia_prima_id = mp.id);

-- --- 3) rendimento_pct sai de materias_primas ------------------------
-- MySQL não tem DROP COLUMN IF EXISTS; o prepare condicional deixa o
-- script repetível.
SET @tem_coluna := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'materias_primas'
     AND COLUMN_NAME = 'rendimento_pct'
);
SET @sql := IF(@tem_coluna > 0,
  'ALTER TABLE materias_primas DROP COLUMN rendimento_pct',
  'SELECT "rendimento_pct já removida" AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --- 4) Status 'finalizada' nas ordens de produção -------------------
-- MODIFY é idempotente: reaplicar o mesmo enum não muda nada.
ALTER TABLE ordens_producao
  MODIFY status ENUM('planejada','liberada','em_producao','concluida','cancelada','finalizada')
  NOT NULL DEFAULT 'planejada';

-- --- 5) Controle de envio -------------------------------------------
CREATE TABLE IF NOT EXISTS envios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  lote VARCHAR(40) NOT NULL,                          -- número de série da remessa
  ordem_id INT NOT NULL,                              -- ordem de produção de origem
  produto_id INT NOT NULL,
  quantidade DECIMAL(14,3) NOT NULL,                  -- pode ser parcial em relação à ordem
  destinatario VARCHAR(160),
  endereco VARCHAR(255),
  uf CHAR(2),
  transportadora VARCHAR(120),
  rastreio VARCHAR(60),
  data_envio DATE,
  status ENUM('preparando','enviado','entregue') NOT NULL DEFAULT 'preparando',
  observacao VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_envio_empresa (empresa_id, status, data_envio),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (ordem_id) REFERENCES ordens_producao(id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB;

-- --- Conferência -----------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM materia_compras)  AS lotes,
  (SELECT COUNT(*) FROM materias_primas)  AS materias,
  (SELECT COUNT(*) FROM materias_primas
    WHERE estoque_atual <> COALESCE(
      (SELECT SUM(c.quantidade_restante) FROM materia_compras c
        WHERE c.materia_prima_id = materias_primas.id AND c.status='ativo'), 0)
  ) AS materias_com_saldo_divergente;
