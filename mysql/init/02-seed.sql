-- =====================================================================
-- GRIMORIUM INDUSTRIAL — Carga inicial (tabelas fiscais + dados de demonstração)
-- O usuário administrador é criado pelo backend na primeira subida:
--   admin@grimorium.com / admin123
-- =====================================================================
SET NAMES utf8mb4;
USE benio;

-- ---------------------------------------------------------------------
-- ICMS por UF (alíquotas internas de referência — editáveis em Configurações)
-- ---------------------------------------------------------------------
INSERT INTO icms_uf (uf, nome, aliquota_interna, regiao, codigo_ibge) VALUES
('AC','Acre',19.00,'N','12'), ('AL','Alagoas',20.00,'NE','27'), ('AM','Amazonas',20.00,'N','13'),
('AP','Amapá',18.00,'N','16'), ('BA','Bahia',20.50,'NE','29'), ('CE','Ceará',20.00,'NE','23'),
('DF','Distrito Federal',20.00,'CO','53'), ('ES','Espírito Santo',17.00,'SE','32'),
('GO','Goiás',19.00,'CO','52'), ('MA','Maranhão',22.00,'NE','21'), ('MG','Minas Gerais',18.00,'SE','31'),
('MS','Mato Grosso do Sul',17.00,'CO','50'), ('MT','Mato Grosso',17.00,'CO','51'),
('PA','Pará',19.00,'N','15'), ('PB','Paraíba',20.00,'NE','25'), ('PE','Pernambuco',20.50,'NE','26'),
('PI','Piauí',22.50,'NE','22'), ('PR','Paraná',19.50,'S','41'), ('RJ','Rio de Janeiro',22.00,'SE','33'),
('RN','Rio Grande do Norte',20.00,'NE','24'), ('RO','Rondônia',19.50,'N','11'), ('RR','Roraima',20.00,'N','14'),
('RS','Rio Grande do Sul',17.00,'S','43'), ('SC','Santa Catarina',17.00,'S','42'),
('SE','Sergipe',20.00,'NE','28'), ('SP','São Paulo',18.00,'SE','35'), ('TO','Tocantins',20.00,'N','17');

-- ---------------------------------------------------------------------
-- NCM (valores de IPI de referência da TIPI — editáveis em Configurações)
-- ---------------------------------------------------------------------
INSERT INTO ncm (codigo, descricao, ipi_pct) VALUES
('20079921','Goiabada',0.00),
('20079910','Geleias e marmeladas de frutas',0.00),
('20089900','Outras frutas e partes de plantas, preparadas',0.00),
('17019900','Açúcar de cana ou beterraba, refinado',0.00),
('18069000','Chocolate e outras preparações com cacau',5.00),
('19053100','Biscoitos doces (adicionados de edulcorante)',0.00),
('19059090','Outros produtos de padaria e pastelaria',0.00),
('21069090','Outras preparações alimentícias',0.00),
('22021000','Águas com açúcar ou aromatizadas (refrigerantes)',4.00),
('04029900','Leite concentrado/condensado, outros',0.00),
('15079011','Óleo de soja refinado',0.00),
('33051000','Xampus para os cabelos',0.00),
('34022000','Detergentes e preparações para lavagem (varejo)',0.00),
('38089419','Desinfetantes, outros',8.00),
('39231090','Embalagens de plástico, outras',10.00),
('39232110','Sacos e bolsas de polietileno',5.00),
('39235000','Rolhas, tampas e cápsulas de plástico',10.00),
('48191000','Caixas de papel ou cartão ondulado',0.00),
('70109012','Frascos de vidro',0.00),
('73102110','Latas de ferro/aço < 50 litros',0.00),
('76129019','Recipientes de alumínio, outros',0.00);

-- ---------------------------------------------------------------------
-- Empresas (multiempresa)
-- ---------------------------------------------------------------------
INSERT INTO empresas (id, razao_social, nome_fantasia, cnpj, ie, uf, municipio, endereco, regime, aliquota_simples) VALUES
(1,'Grimorium Indústria de Alimentos Ltda','Grimorium Alimentos','12345678000195','123456789012','SP','São Paulo','Rua das Indústrias, 1000 — Distrito Industrial','presumido',6.000),
(2,'Grimorium Química e Limpeza Ltda','Grimorium Química','98765432000198','987654321098','MG','Contagem','Av. do Contorno, 500 — Cinco','simples',8.500);

-- ---------------------------------------------------------------------
-- Funcionários de demonstração: usuários sem login (senha inválida) com dados salariais
-- ---------------------------------------------------------------------
INSERT INTO usuarios (id, nome, email, senha_hash, papel, ativo, cargo, salario_base, encargos_pct, vale_transporte, vale_alimentacao, outros_beneficios, horas_mes) VALUES
(101,'João Pereira','funcionario1@grimorium.local','!sem-login!','operador',1,'Operador de Produção',2200.00,68.00,220.00,550.00,0.00,220),
(102,'Maria Souza','funcionario2@grimorium.local','!sem-login!','operador',1,'Operadora de Produção',2200.00,68.00,220.00,550.00,0.00,220),
(103,'Carlos Lima','funcionario3@grimorium.local','!sem-login!','operador',1,'Técnico de Caldeira',3200.00,68.00,220.00,550.00,100.00,220),
(104,'Ana Castro','funcionario4@grimorium.local','!sem-login!','producao',1,'Supervisora de Produção',5200.00,68.00,0.00,650.00,200.00,220),
(105,'Pedro Alves','funcionario5@grimorium.local','!sem-login!','operador',1,'Auxiliar de Envase',1800.00,68.00,220.00,550.00,0.00,220),
(106,'Rafael Nunes','funcionario6@grimorium.local','!sem-login!','operador',1,'Químico Industrial',4000.00,68.00,180.00,600.00,0.00,220);

INSERT INTO usuario_empresas (usuario_id, empresa_id) VALUES
(101,1),(102,1),(103,1),(104,1),(105,1),(106,2);

-- ---------------------------------------------------------------------
-- Aba 5 — Utilidades
-- ---------------------------------------------------------------------
INSERT INTO utilidades (id, empresa_id, nome, tipo, unidade, custo_unitario, conta_mensal) VALUES
(1,1,'Energia Elétrica','energia','kWh',0.9200,18500.00),
(2,1,'Gás Natural','gas','m³',4.8500,6200.00),
(3,1,'Óleo BPF (Caldeira)','oleo','litro',5.2000,9800.00),
(4,1,'Água Industrial','agua','m³',11.5000,3100.00),
(5,2,'Energia Elétrica','energia','kWh',0.9800,7200.00);

-- ---------------------------------------------------------------------
-- Aba 3 — Linhas de processo
-- ---------------------------------------------------------------------
INSERT INTO linhas_processo (id, empresa_id, nome, descricao, producao_hora, unidade_producao, rendimento_pct, horas_disponiveis_semana) VALUES
(1,1,'Linha 1 — Cozimento e Envase','Tachos encamisados + envase rotativo',500,'un',96.00,44),
(2,1,'Linha 2 — Mistura e Empacotamento de Pós','Misturador ribbon + empacotadora vertical',800,'un',98.00,44),
(3,2,'Reator 1 — Líquidos','Reator com agitação e envase manual',300,'un',95.00,44);

INSERT INTO linha_equipamentos (linha_id, nome, potencia_kw, observacao) VALUES
(1,'Tacho Encamisado 500L',18.00,'Aquecimento a vapor'),
(1,'Envasadora Rotativa 8 bicos',7.50,NULL),
(1,'Caldeira Flamotubular',4.00,'Consome óleo BPF'),
(1,'Esteira de Resfriamento',3.00,NULL),
(2,'Misturador Ribbon 300kg',11.00,NULL),
(2,'Empacotadora Vertical',5.50,NULL),
(3,'Reator 1000L com Agitador',9.00,NULL);

INSERT INTO linha_usuarios (linha_id, usuario_id, dedicacao_pct) VALUES
(1,101,100),(1,102,100),(1,103,50),(1,104,30),(1,105,100),
(2,102,50),(2,104,20),(2,105,50),
(3,106,100);

INSERT INTO linha_utilidades (linha_id, utilidade_id, consumo_hora) VALUES
(1,1,42.0000),(1,3,14.0000),(1,4,0.9000),
(2,1,18.0000),(2,4,0.2000),
(3,5,22.0000);

-- ---------------------------------------------------------------------
-- Aba 2 — Matérias-primas
-- ---------------------------------------------------------------------
INSERT INTO materias_primas (id, empresa_id, nome, unidade, ncm_codigo, estoque_minimo) VALUES
(1,1,'Polpa de Goiaba','kg','20089900',300.000),
(2,1,'Açúcar Cristal','kg','17019900',500.000),
(3,1,'Pectina Cítrica','kg',NULL,10.000),
(4,1,'Ácido Cítrico','kg',NULL,20.000),
(5,1,'Pote PP 400g','un','39231090',2000.000),
(6,1,'Tampa Twist 82mm','un','39235000',2000.000),
(7,1,'Rótulo Adesivo','un',NULL,3000.000),
(8,1,'Caixa Papelão 12 un','un','48191000',200.000),
(9,1,'Leite em Pó Integral','kg','04029900',100.000),
(10,1,'Cacau em Pó','kg',NULL,80.000),
(11,1,'Embalagem Pouch 1kg','un','39232110',1000.000),
(12,2,'Base Tensoativa','kg',NULL,100.000),
(13,2,'Essência Lavanda','kg',NULL,5.000),
(14,2,'Bombona 5L','un','39231090',150.000);

-- Compras: o estoque de cada matéria-prima é a soma destes lotes, consumidos
-- da data mais antiga para a mais nova. Polpa, Açúcar e Pote PP vêm de dois
-- fornecedores para exercitar o FIFO; a média ponderada dos dois lotes é igual
-- ao preço único que o item tinha antes, então os custos de produto não mudam.
INSERT INTO materia_compras (empresa_id, materia_prima_id, fornecedor, numero_nota, data_compra, quantidade, quantidade_restante, valor_unitario) VALUES
(1, 1,'Fazenda Boa Vista','10231','2026-07-15',  700.000,  700.000, 4.2000),
(1, 1,'Polpas do Vale','4471','2026-08-05',      500.000,  500.000, 4.9200),
(1, 2,'Usina Santa Clara','88120','2026-07-20', 1500.000, 1500.000, 3.0500),
(1, 2,'Doce Norte Distribuidora','2205','2026-08-10', 1000.000, 1000.000, 3.4250),
(1, 3,'Aditivos Química Brasil','3390','2026-07-28',   40.000,   40.000, 86.0000),
(1, 4,'Aditivos Química Brasil','3391','2026-07-28',   80.000,   80.000, 12.5000),
(1, 5,'Plastipote Embalagens','5510','2026-07-10',  5000.000, 5000.000, 0.8200),
(1, 5,'Embalagens União','1180','2026-08-02',       4000.000, 4000.000, 0.8875),
(1, 6,'Plastipote Embalagens','5511','2026-07-10',  9000.000, 9000.000, 0.3500),
(1, 7,'Gráfica Etiqueta Fácil','771','2026-07-22', 15000.000,15000.000, 0.1200),
(1, 8,'Papelão Sul Cartonagem','6602','2026-08-01',  800.000,  800.000, 1.1000),
(1, 9,'Laticínios Campo Bom','4410','2026-08-06',    400.000,  400.000,28.0000),
(1,10,'Cacau Ouro Importadora','2288','2026-08-06',  300.000,  300.000,22.0000),
(1,11,'Embalagens União','1181','2026-08-02',       5000.000, 5000.000, 0.6500),
(2,12,'Tensoativos Paulista','9100','2026-07-30',    500.000,  500.000, 8.0000),
(2,13,'Essências Aroma Fino','1502','2026-08-04',     20.000,   20.000,45.0000),
(2,14,'Plastipote Embalagens','5512','2026-07-10',   600.000,  600.000, 3.2000);

-- Estoque e custo da matéria-prima são derivados dos lotes acima
UPDATE materias_primas mp SET
  estoque_atual = COALESCE((SELECT SUM(c.quantidade_restante) FROM materia_compras c
                             WHERE c.materia_prima_id = mp.id AND c.status='ativo'), 0),
  custo_unitario = COALESCE((SELECT SUM(c.quantidade_restante * c.valor_unitario) / NULLIF(SUM(c.quantidade_restante),0)
                             FROM materia_compras c
                             WHERE c.materia_prima_id = mp.id AND c.status='ativo'), 0);

-- Cada compra também é uma entrada no histórico de estoque
INSERT INTO estoque_movimentos (empresa_id, materia_prima_id, tipo, quantidade, custo_unitario, origem)
SELECT empresa_id, materia_prima_id, 'entrada', quantidade, valor_unitario,
       CONCAT('Compra ', fornecedor, ' · NF ', COALESCE(numero_nota,'—'))
FROM materia_compras ORDER BY data_compra, id;

-- ---------------------------------------------------------------------
-- Aba 2 — Produtos e fórmulas
-- ---------------------------------------------------------------------
INSERT INTO produtos (id, empresa_id, nome, unidade, peso_kg, ncm_codigo, linha_id, rendimento_linha_pct, horas_producao, tamanho_lote, manutencao_pct, margem_pct) VALUES
(1,1,'Goiabada Cascão Pote 400g','un',0.4000,'20079921',1,96.00,1.50,750,3.00,25.00),
(2,1,'Achocolatado em Pó Pouch 1kg','un',1.0000,'18069000',2,98.00,1.25,1000,2.00,30.00),
(3,2,'Detergente Industrial 5L','un',5.0000,'34022000',3,95.00,2.00,200,2.00,35.00);

INSERT INTO formula_itens (produto_id, materia_prima_id, quantidade) VALUES
(1,1,195.0000),(1,2,135.0000),(1,3,2.2000),(1,4,1.1000),(1,5,750.0000),(1,6,750.0000),(1,7,750.0000),(1,8,62.5000),
(2,2,680.0000),(2,9,200.0000),(2,10,140.0000),(2,11,1000.0000),(2,8,84.0000),
(3,12,120.0000),(3,13,3.0000),(3,14,200.0000);

-- ---------------------------------------------------------------------
-- Aba 1 — Pedidos
-- ---------------------------------------------------------------------
INSERT INTO pedidos (id, empresa_id, numero, cliente, cliente_cnpj, cliente_uf, data_pedido, data_entrega, status, observacao) VALUES
(1,1,'PED-0001','Supermercados Vale Verde S/A','11222333000181','SP','2026-08-03','2026-08-20','aberto','Entrega no CD Guarulhos'),
(2,1,'PED-0002','Distribuidora Norte Alimentos','44555666000181','MG','2026-08-08','2026-08-25','em_producao',NULL),
(3,2,'PED-0001','Metalúrgica Horizonte Ltda','77888999000181','MG','2026-08-05','2026-08-30','aberto',NULL);

INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES
(1,1,3000.000,9.5000),
(1,2,1200.000,18.9000),
(2,1,1500.000,9.2000),
(3,3,400.000,12.5000);

-- ---------------------------------------------------------------------
-- PCP — ordem de produção de exemplo
-- ---------------------------------------------------------------------
INSERT INTO ordens_producao (empresa_id, numero, pedido_id, produto_id, linha_id, quantidade, data_inicio, data_fim, status) VALUES
(1,'OP-0001',2,1,1,1500.000,'2026-08-12','2026-08-14','planejada');
