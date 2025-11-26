-- Zera todos os emails TV e começa do 1a8@nexusrs.com.br
-- Este script:
-- 1. Remove todos os client_id dos slots (libera todos os slots)
-- 2. Deleta TODOS os emails exceto o 1a8 (ou cria o 1a8 se não existir)
-- 3. Garante que o 1a8 tenha exatamente 8 slots disponíveis

DO $$ 
DECLARE
  first_email_id UUID;
  slot_num INTEGER;
  new_password TEXT;
  deleted_slots INTEGER;
  deleted_emails INTEGER;
BEGIN
  RAISE NOTICE '🔄 Zerando emails TV e começando do 1a8...';

  -- 1. Liberar TODOS os slots (remover client_id e marcar como AVAILABLE)
  UPDATE tv_slots
  SET 
    status = 'AVAILABLE',
    client_id = NULL,
    sold_by = NULL,
    sold_at = NULL,
    expires_at = NULL,
    notes = NULL,
    plan_type = NULL,
    updated_at = NOW();

  RAISE NOTICE '✅ Todos os slots liberados';

  -- 2. Buscar ou criar o email 1a8@nexusrs.com.br
  SELECT id INTO first_email_id
  FROM tv_accounts
  WHERE email = '1a8@nexusrs.com.br'
  LIMIT 1;

  IF first_email_id IS NULL THEN
    -- Criar o email 1a8@nexusrs.com.br
    INSERT INTO tv_accounts (email)
    VALUES ('1a8@nexusrs.com.br')
    RETURNING id INTO first_email_id;
    RAISE NOTICE '✅ Email 1a8@nexusrs.com.br criado';
  ELSE
    RAISE NOTICE 'ℹ️ Email 1a8@nexusrs.com.br já existe';
  END IF;

  -- 3. Deletar TODOS os slots que NÃO pertencem ao 1a8
  DELETE FROM tv_slots WHERE tv_account_id != first_email_id;
  GET DIAGNOSTICS deleted_slots = ROW_COUNT;
  RAISE NOTICE '✅ % slots de outros emails removidos', deleted_slots;

  -- 4. Deletar TODOS os emails que NÃO são o 1a8
  DELETE FROM tv_accounts WHERE email != '1a8@nexusrs.com.br';
  GET DIAGNOSTICS deleted_emails = ROW_COUNT;
  RAISE NOTICE '✅ % emails removidos (mantido apenas 1a8)', deleted_emails;

  -- 5. Garantir que o 1a8 tenha exatamente 8 slots disponíveis
  -- Primeiro, deletar slots extras do 1a8 se houver mais de 8
  DELETE FROM tv_slots 
  WHERE tv_account_id = first_email_id 
  AND slot_number > 8;

  -- Depois, criar/atualizar os 8 slots do 1a8
  FOR slot_num IN 1..8 LOOP
    new_password := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    INSERT INTO tv_slots (
      tv_account_id,
      slot_number,
      username,
      password,
      status
    )
    VALUES (
      first_email_id,
      slot_num,
      '#' || slot_num::TEXT,
      new_password,
      'AVAILABLE'
    )
    ON CONFLICT (tv_account_id, slot_number) DO UPDATE
    SET 
      status = 'AVAILABLE',
      client_id = NULL,
      sold_by = NULL,
      sold_at = NULL,
      expires_at = NULL,
      notes = NULL,
      plan_type = NULL,
      username = EXCLUDED.username,
      password = EXCLUDED.password,
      updated_at = NOW();
  END LOOP;

  RAISE NOTICE '✅ 8 slots disponíveis garantidos para 1a8@nexusrs.com.br';
  RAISE NOTICE '✅ Reset completo! Sistema pronto para começar do 1a8';
END $$;

-- Verificar resultado final
SELECT 
  ta.email,
  COUNT(ts.id) as total_slots,
  COUNT(CASE WHEN ts.status = 'AVAILABLE' THEN 1 END) as available_slots,
  COUNT(CASE WHEN ts.status = 'ASSIGNED' THEN 1 END) as assigned_slots,
  MIN(ts.slot_number) as primeiro_slot,
  MAX(ts.slot_number) as ultimo_slot
FROM tv_accounts ta
LEFT JOIN tv_slots ts ON ts.tv_account_id = ta.id
GROUP BY ta.email
ORDER BY ta.email;


