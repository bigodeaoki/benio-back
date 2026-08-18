-- =====================================================================
-- RESET OPERACIONAL — apaga os dados de trabalho, preserva a base mínima
-- para o sistema funcionar.
--
-- FICA:  usuários com papel 'admin' (e o vínculo deles com as empresas),
--        empresas, e as tabelas fiscais globais (ncm, icms_uf).
-- SAI:   matérias-primas e compras, produtos e fórmulas, linhas de processo,
--        utilidades, pedidos, ordens de produção, remessas, movimentos de
--        estoque, documentos, notas fiscais e os demais usuários.
--
-- Sem USE de propósito: roda no banco em que você conectar (benio no
-- docker-compose, railway no Railway).
--
--   docker compose exec -T mysql mysql -ubenio -pbenio123 benio < mysql/reset.sql
--   mysql --protocol=TCP -h HOST -P PORTA -u root -pSENHA railway < mysql/reset.sql
--
-- Irreversível. Não há confirmação.
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE documento_tag_vinculos;
TRUNCATE TABLE documento_tags;
TRUNCATE TABLE documentos;
TRUNCATE TABLE envios;
TRUNCATE TABLE estoque_movimentos;
TRUNCATE TABLE formula_itens;
TRUNCATE TABLE linha_equipamentos;
TRUNCATE TABLE linha_usuarios;
TRUNCATE TABLE linha_utilidades;
TRUNCATE TABLE linhas_processo;
TRUNCATE TABLE materia_compras;
TRUNCATE TABLE materias_primas;
TRUNCATE TABLE notas_fiscais;
TRUNCATE TABLE ordens_producao;
TRUNCATE TABLE pedido_itens;
TRUNCATE TABLE pedidos;
TRUNCATE TABLE produtos;
TRUNCATE TABLE utilidades;

DELETE FROM usuario_empresas
 WHERE usuario_id NOT IN (SELECT id FROM usuarios WHERE papel = 'admin');
DELETE FROM usuarios WHERE papel <> 'admin';

SET FOREIGN_KEY_CHECKS = 1;

-- Garante o admin vendo todas as empresas (se não houver admin, o backend
-- cria admin@grimorium.com / admin123 no próximo boot e já faz os vínculos)
INSERT IGNORE INTO usuario_empresas (usuario_id, empresa_id)
SELECT u.id, e.id FROM usuarios u CROSS JOIN empresas e WHERE u.papel = 'admin';

SELECT
  (SELECT COUNT(*) FROM usuarios)        AS usuarios,
  (SELECT COUNT(*) FROM empresas)        AS empresas,
  (SELECT COUNT(*) FROM materias_primas) AS materias,
  (SELECT COUNT(*) FROM produtos)        AS produtos,
  (SELECT COUNT(*) FROM pedidos)         AS pedidos,
  (SELECT COUNT(*) FROM ncm)             AS ncm_preservado,
  (SELECT COUNT(*) FROM icms_uf)         AS icms_preservado;
