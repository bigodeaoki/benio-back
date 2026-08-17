-- =====================================================================
-- BENIO INDUSTRIAL — Sistema de custos industriais
-- Schema MySQL 8 (executado automaticamente na primeira subida do container)
-- =====================================================================
SET NAMES utf8mb4;
USE benio;

CREATE TABLE empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  razao_social VARCHAR(200) NOT NULL,
  nome_fantasia VARCHAR(200),
  cnpj VARCHAR(14),
  ie VARCHAR(20),
  uf CHAR(2) NOT NULL DEFAULT 'SP',
  municipio VARCHAR(120),
  endereco VARCHAR(255),
  regime ENUM('simples','presumido','real') NOT NULL DEFAULT 'presumido',
  aliquota_simples DECIMAL(6,3) NOT NULL DEFAULT 6.000, -- alíquota efetiva do DAS (%)
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  telefone VARCHAR(20) NULL,
  documento VARCHAR(20) NULL,
  senha_hash VARCHAR(100) NOT NULL,
  papel ENUM('admin','gestor','operador') NOT NULL DEFAULT 'gestor',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE usuario_empresas (
  usuario_id INT NOT NULL,
  empresa_id INT NOT NULL,
  PRIMARY KEY (usuario_id, empresa_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Aba 4 — Colaboradores
CREATE TABLE colaboradores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  cargo VARCHAR(120),
  salario_base DECIMAL(12,2) NOT NULL DEFAULT 0,
  encargos_pct DECIMAL(6,2) NOT NULL DEFAULT 70,      -- INSS patronal, FGTS, provisões (13º, férias)
  vale_transporte DECIMAL(12,2) NOT NULL DEFAULT 0,
  vale_alimentacao DECIMAL(12,2) NOT NULL DEFAULT 0,
  outros_beneficios DECIMAL(12,2) NOT NULL DEFAULT 0,
  horas_mes DECIMAL(7,2) NOT NULL DEFAULT 220,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Aba 5 — Utilidades (energia, gás, óleo de caldeira, água...)
CREATE TABLE utilidades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  tipo ENUM('energia','gas','oleo','agua','outro') NOT NULL DEFAULT 'outro',
  unidade VARCHAR(20) NOT NULL DEFAULT 'un',
  custo_unitario DECIMAL(12,4) NOT NULL DEFAULT 0,    -- ex.: R$/kWh, R$/litro, R$/m³
  conta_mensal DECIMAL(12,2) NOT NULL DEFAULT 0,      -- valor de referência da conta do mês
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Aba 3 — Linhas de processo
CREATE TABLE linhas_processo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  descricao VARCHAR(255),
  producao_hora DECIMAL(12,2) NOT NULL DEFAULT 0,     -- quantidade produzida em 1h de trabalho
  unidade_producao VARCHAR(20) NOT NULL DEFAULT 'un',
  rendimento_pct DECIMAL(6,2) NOT NULL DEFAULT 100,
  horas_disponiveis_semana DECIMAL(7,2) NOT NULL DEFAULT 44,
  ativa TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE linha_equipamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  linha_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  potencia_kw DECIMAL(10,2) NOT NULL DEFAULT 0,
  observacao VARCHAR(255),
  FOREIGN KEY (linha_id) REFERENCES linhas_processo(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE linha_colaboradores (
  linha_id INT NOT NULL,
  colaborador_id INT NOT NULL,
  dedicacao_pct DECIMAL(6,2) NOT NULL DEFAULT 100,
  PRIMARY KEY (linha_id, colaborador_id),
  FOREIGN KEY (linha_id) REFERENCES linhas_processo(id) ON DELETE CASCADE,
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE linha_utilidades (
  linha_id INT NOT NULL,
  utilidade_id INT NOT NULL,
  consumo_hora DECIMAL(12,4) NOT NULL DEFAULT 0,      -- na unidade da utilidade, por hora trabalhada
  PRIMARY KEY (linha_id, utilidade_id),
  FOREIGN KEY (linha_id) REFERENCES linhas_processo(id) ON DELETE CASCADE,
  FOREIGN KEY (utilidade_id) REFERENCES utilidades(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Tabelas fiscais globais (compartilhadas entre empresas, editáveis em Configurações)
CREATE TABLE ncm (
  codigo VARCHAR(8) PRIMARY KEY,
  descricao VARCHAR(255) NOT NULL,
  ipi_pct DECIMAL(6,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE icms_uf (
  uf CHAR(2) PRIMARY KEY,
  nome VARCHAR(40) NOT NULL,
  aliquota_interna DECIMAL(6,2) NOT NULL,
  regiao VARCHAR(2) NOT NULL,                          -- N, NE, CO, SE, S
  codigo_ibge CHAR(2) NOT NULL
) ENGINE=InnoDB;

-- Aba 2 — Matérias-primas e fórmulas
CREATE TABLE materias_primas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(150) NOT NULL,
  unidade VARCHAR(20) NOT NULL DEFAULT 'kg',
  custo_unitario DECIMAL(12,4) NOT NULL DEFAULT 0,
  rendimento_pct DECIMAL(6,2) NOT NULL DEFAULT 100,
  ncm_codigo VARCHAR(8),
  estoque_atual DECIMAL(14,3) NOT NULL DEFAULT 0,
  estoque_minimo DECIMAL(14,3) NOT NULL DEFAULT 0,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(150) NOT NULL,
  unidade VARCHAR(20) NOT NULL DEFAULT 'un',
  peso_kg DECIMAL(12,4) NOT NULL DEFAULT 0,           -- peso líquido por unidade
  ncm_codigo VARCHAR(8),
  linha_id INT,
  rendimento_linha_pct DECIMAL(6,2) NOT NULL DEFAULT 100,
  horas_producao DECIMAL(10,2) NOT NULL DEFAULT 0,    -- horas necessárias por lote
  tamanho_lote DECIMAL(12,2) NOT NULL DEFAULT 1,      -- unidades por lote
  manutencao_pct DECIMAL(6,2) NOT NULL DEFAULT 0,     -- % extra para custos de manutenção
  margem_pct DECIMAL(6,2) NOT NULL DEFAULT 25,        -- margem desejada sobre o preço de venda
  icms_pct_override DECIMAL(6,2) NULL,                -- se nulo, usa alíquota da UF
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (linha_id) REFERENCES linhas_processo(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE formula_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  materia_prima_id INT NOT NULL,
  quantidade DECIMAL(14,4) NOT NULL,                  -- quantidade por lote
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_prima_id) REFERENCES materias_primas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Aba 1 — Pedidos
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  numero VARCHAR(20) NOT NULL,
  cliente VARCHAR(160) NOT NULL,
  cliente_cnpj VARCHAR(14),
  cliente_uf CHAR(2) NOT NULL DEFAULT 'SP',
  data_pedido DATE NOT NULL,
  data_entrega DATE,
  status ENUM('aberto','em_producao','faturado','entregue','cancelado') NOT NULL DEFAULT 'aberto',
  observacao VARCHAR(255),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pedido_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade DECIMAL(14,3) NOT NULL,
  preco_unitario DECIMAL(12,4) NOT NULL DEFAULT 0,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB;

-- Estoque de matérias-primas
CREATE TABLE estoque_movimentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  materia_prima_id INT NOT NULL,
  tipo ENUM('entrada','saida','ajuste') NOT NULL,
  quantidade DECIMAL(14,3) NOT NULL,
  custo_unitario DECIMAL(12,4) NULL,
  origem VARCHAR(160),
  data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_prima_id) REFERENCES materias_primas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- MRP / PCP — ordens de produção
CREATE TABLE ordens_producao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  numero VARCHAR(20),
  pedido_id INT NULL,
  produto_id INT NOT NULL,
  linha_id INT NULL,
  quantidade DECIMAL(14,3) NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  status ENUM('planejada','liberada','em_producao','concluida','cancelada') NOT NULL DEFAULT 'planejada',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL,
  FOREIGN KEY (produto_id) REFERENCES produtos(id),
  FOREIGN KEY (linha_id) REFERENCES linhas_processo(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- NF-e (estrutura completa; transmissão real à SEFAZ exige certificado digital)
CREATE TABLE notas_fiscais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  pedido_id INT NULL,
  numero INT NOT NULL,
  serie INT NOT NULL DEFAULT 1,
  chave_acesso VARCHAR(44),
  natureza VARCHAR(80) NOT NULL DEFAULT 'Venda de produção do estabelecimento',
  destinatario VARCHAR(160),
  dest_cnpj VARCHAR(14),
  dest_uf CHAR(2),
  valor_produtos DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_icms DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_pis DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_cofins DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_ipi DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('rascunho','emitida_homologacao','cancelada') NOT NULL DEFAULT 'rascunho',
  ambiente ENUM('homologacao','producao') NOT NULL DEFAULT 'homologacao',
  xml MEDIUMTEXT,
  emitida_em TIMESTAMP NULL,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_ped_empresa ON pedidos(empresa_id, data_pedido);
CREATE INDEX idx_mov_mp ON estoque_movimentos(materia_prima_id, data);
CREATE INDEX idx_op_status ON ordens_producao(empresa_id, status);

-- Documentos por empresa (conteúdo binário no banco; base64 apenas no transporte)
CREATE TABLE documentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  status ENUM('vigente','obsoleto') NOT NULL DEFAULT 'vigente',
  descricao VARCHAR(255),
  arquivo_nome VARCHAR(255) NOT NULL,
  mime VARCHAR(120) NOT NULL,
  tamanho_bytes INT NOT NULL,
  conteudo MEDIUMBLOB NOT NULL,
  criado_por INT NULL,
  editado_por INT NULL,
  editado_em TIMESTAMP NULL,
  status_alterado_por INT NULL,
  status_alterado_em TIMESTAMP NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (editado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (status_alterado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE documento_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(60) NOT NULL,
  UNIQUE KEY uq_documento_tag (empresa_id, nome),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE documento_tag_vinculos (
  documento_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (documento_id, tag_id),
  FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES documento_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_doc_empresa ON documentos(empresa_id, tipo, criado_em);
