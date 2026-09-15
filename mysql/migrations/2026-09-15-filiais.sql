-- =====================================================================
-- MIGRAÇÃO 2026-09-15 — filiais (escopo abaixo da empresa)
--
-- Aplicar depois de 2026-08-18-formula-por-ordem-e-rendimento-dinamico.sql.
-- Sem USE de propósito: roda no banco em que você conectar.
-- Pode ser executado mais de uma vez sem duplicar nada.
--
--   mysql --protocol=TCP -h HOST -P PORTA -u root -pSENHA benio \
--     < mysql/migrations/2026-09-15-filiais.sql
--
-- O que muda:
--   1. tabela filiais — unidades de cada empresa (cadastro em Sistema › Empresas,
--      no "+" da linha da empresa). Não se exclui filial: inativa-se, porque
--      ela vai servir de referência para auditoria.
--   2. tabela usuario_filiais — em quais filiais cada usuário participa.
--      Admin não tem vínculo: acessa todas, como já faz com as empresas.
--
-- Nenhum dado existente muda: usuário sem filial continua válido, e a
-- empresa funciona sem nenhuma filial cadastrada.
-- =====================================================================

-- --- 1) Filiais -------------------------------------------------------
CREATE TABLE IF NOT EXISTS filiais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  codigo VARCHAR(20) NULL,                             -- identificador curto (ex.: 0002, SP-01)
  municipio VARCHAR(120) NULL,
  uf CHAR(2) NULL,
  ativa TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_filial_nome (empresa_id, nome),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --- 2) Usuário × filial ---------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_filiais (
  usuario_id INT NOT NULL,
  filial_id INT NOT NULL,
  PRIMARY KEY (usuario_id, filial_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (filial_id) REFERENCES filiais(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --- Conferência -----------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM filiais)         AS filiais,
  (SELECT COUNT(*) FROM usuario_filiais) AS vinculos_usuario_filial;
