-- =====================================================================
-- MIGRAÇÃO 2026-09-15 (2) — marca Scientia (antes Grimorium)
--
-- O sistema mudou de nome. Este script troca o que carregava o nome antigo
-- nos DADOS (o código, seed e docs já foram trocados no repositório):
--   1. e-mail do admin inicial: admin@grimorium.com -> admin@scientia.com
--      (senha não muda) e e-mails de demonstração @grimorium.local
--   2. nomes das empresas de demonstração ("Grimorium Química" etc.)
--
-- Sem USE de propósito: roda no banco em que você conectar.
-- Pode ser executado mais de uma vez sem efeito colateral.
--
--   mysql --protocol=TCP -h HOST -P PORTA -u root -pSENHA benio \
--     < mysql/migrations/2026-09-15-marca-scientia.sql
-- =====================================================================

UPDATE usuarios
   SET email = REPLACE(email, '@grimorium.', '@scientia.')
 WHERE email LIKE '%@grimorium.%';

UPDATE empresas
   SET razao_social  = REPLACE(razao_social,  'Grimorium', 'Scientia'),
       nome_fantasia = REPLACE(nome_fantasia, 'Grimorium', 'Scientia')
 WHERE razao_social LIKE '%Grimorium%' OR nome_fantasia LIKE '%Grimorium%';

-- --- Conferência -----------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM usuarios WHERE email LIKE '%grimorium%')                                   AS usuarios_com_nome_antigo,
  (SELECT COUNT(*) FROM empresas WHERE razao_social LIKE '%Grimorium%' OR nome_fantasia LIKE '%Grimorium%') AS empresas_com_nome_antigo,
  (SELECT GROUP_CONCAT(email) FROM usuarios WHERE papel = 'admin')                                   AS admins;
