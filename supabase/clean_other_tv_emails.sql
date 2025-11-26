-- Remove slots de outros emails TV, mantendo apenas o 1a8@nexusrs.com.br
-- Isso força o sistema a sempre começar do 1a8

DO $$ 
DECLARE
  first_email_id UUID;
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '🔄 Removendo slots de outros emails TV (mantendo apenas 1a8)...';

  -- Buscar o ID do email 1a8
  SELECT id INTO first_email_id
  FROM tv_accounts
  WHERE email = '1a8@nexusrs.com.br'
  LIMIT 1;

  IF first_email_id IS NULL THEN
    RAISE EXCEPTION 'Email 1a8@nexusrs.com.br não encontrado! Execute primeiro o reset_tv_slots_to_1a8.sql';
  END IF;

  -- Deletar todos os slots que NÃO pertencem ao email 1a8
  DELETE FROM tv_slots
  WHERE tv_account_id != first_email_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ % slots removidos de outros emails', deleted_count;

  -- Deletar todos os emails que NÃO são o 1a8
  DELETE FROM tv_accounts
  WHERE email != '1a8@nexusrs.com.br';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ % emails removidos (mantido apenas 1a8@nexusrs.com.br)', deleted_count;

  RAISE NOTICE '✅ Limpeza concluída! Apenas o email 1a8@nexusrs.com.br permanece';
END $$;

-- Verificar resultado final
SELECT 
  ta.email,
  COUNT(ts.id) as total_slots,
  COUNT(CASE WHEN ts.status = 'AVAILABLE' THEN 1 END) as available_slots,
  COUNT(CASE WHEN ts.status = 'ASSIGNED' THEN 1 END) as assigned_slots
FROM tv_accounts ta
LEFT JOIN tv_slots ts ON ts.tv_account_id = ta.id
GROUP BY ta.email
ORDER BY ta.email;




