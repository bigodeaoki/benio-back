-- =====================================================================
-- MIGRAÇÃO 2026-09-15 (4) — envases (etapas de envase da linha de processo)
--
-- Novo cadastro em Gestão › Envase: cada envase tem funcionários, equipamentos
-- e matérias-primas consumidas por hora, mais rendimento; o custo por hora
-- alimenta a linha de processo (que pode ter vários envases) e o custo do
-- produto (custo/h × horas do lote). Nada existente muda: linha sem envase
-- custa o mesmo de antes.
--
-- Sem USE de propósito: roda no banco em que você conectar.
-- Pode ser executado mais de uma vez sem duplicar nada.
--
--   mysql --protocol=TCP -h HOST -P PORTA -u root -pSENHA benio \
--     < mysql/migrations/2026-09-15-envases.sql
-- =====================================================================

-- Envase: etapa de envase/embalagem que a linha de processo pode ter (várias por
-- linha). Cadastro em Gestão › Envase. Tudo é "por hora de envase": funcionários
-- (custo-hora × dedicação), equipamentos (kW × preço do kWh da utilidade de
-- energia) e matérias-primas consumidas por hora; o rendimento entra nos materiais.
CREATE TABLE IF NOT EXISTS envases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  descricao VARCHAR(255) NULL,
  rendimento_pct DECIMAL(6,2) NOT NULL DEFAULT 100,   -- perda de embalagem/produto no envase
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS envase_equipamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  envase_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  potencia_kw DECIMAL(10,2) NOT NULL DEFAULT 0,
  observacao VARCHAR(255),
  FOREIGN KEY (envase_id) REFERENCES envases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS envase_usuarios (
  envase_id INT NOT NULL,
  usuario_id INT NOT NULL,
  dedicacao_pct DECIMAL(6,2) NOT NULL DEFAULT 100,
  PRIMARY KEY (envase_id, usuario_id),
  FOREIGN KEY (envase_id) REFERENCES envases(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS envase_materias (
  envase_id INT NOT NULL,
  materia_prima_id INT NOT NULL,
  quantidade_hora DECIMAL(14,4) NOT NULL DEFAULT 0,     -- consumo por hora de envase
  PRIMARY KEY (envase_id, materia_prima_id),
  FOREIGN KEY (envase_id) REFERENCES envases(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_prima_id) REFERENCES materias_primas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS linha_envases (
  linha_id INT NOT NULL,
  envase_id INT NOT NULL,
  PRIMARY KEY (linha_id, envase_id),
  FOREIGN KEY (linha_id) REFERENCES linhas_processo(id) ON DELETE CASCADE,
  FOREIGN KEY (envase_id) REFERENCES envases(id) ON DELETE CASCADE
) ENGINE=InnoDB;
