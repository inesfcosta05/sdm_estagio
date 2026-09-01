-- =====================================================================
-- REMOVE TODOS OS DADOS DE DEMO GERADOS POR mock_data.sql
-- Seguro de correr a qualquer momento: só apaga linhas nos intervalos
-- reservados à demo (ver cabeçalho de mock_data.sql).
-- =====================================================================
START TRANSACTION;

DELETE FROM wp_postmeta WHERE post_id BETWEEN 990001 AND 990999;
DELETE FROM fichas WHERE legacy_id BETWEEN 990001 AND 990999;
DELETE FROM clients WHERE legacy_id BETWEEN 900001 AND 900999;
DELETE FROM users WHERE id BETWEEN 9001 AND 9099 AND email LIKE '%@demo.local';

COMMIT;
