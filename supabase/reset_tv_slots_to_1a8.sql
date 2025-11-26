-- Reset completo dos slots TV para começar do 1a8
-- Este script:
-- 1. Limpa todos os slots TV (marca como AVAILABLE e remove client_id)
-- 2. Gera novas senhas para todos os slots
-- 3. Garante que o email 1a8@nexusrs.com.br exista com seus 8 slots

DO $$ 
DECLARE
  first_email_id UUID;
  slot_num INTEGER;
  new_password TEXT;
BEGIN
  RAISE NOTICE '🔄 Iniciando reset dos slots TV para começar do 1a8...';

  -- 1. Limpar todos os slots TV (marcar como AVAILABLE e remover client_id)
  UPDATE tv_slots
  SET 
    status = 'AVAILABLE',
    client_id = NULL,
    sold_by = NULL,
    sold_at = NULL,
    expires_at = NULL,
    notes = NULL,
    plan_type = NULL,
    updated_at = NOW()
  WHERE status != 'AVAILABLE' OR client_id IS NOT NULL;

  GET DIAGNOSTICS slot_num = ROW_COUNT;
  RAISE NOTICE '✅ % slots resetados para AVAILABLE', slot_num;

  -- 2. Gerar novas senhas para todos os slots
  -- Função auxiliar para gerar senha numérica de 6 dígitos
  -- (simulando a função generateNumericPassword do código)
  UPDATE tv_slots
  SET 
    password = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
    updated_at = NOW();

  RAISE NOTICE '✅ Senhas regeneradas para todos os slots';

  -- 3. Verificar se o email 1a8@nexusrs.com.br existe
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

    -- Criar os 8 slots para o email 1a8
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
      ON CONFLICT (tv_account_id, slot_number) DO NOTHING;
    END LOOP;

    RAISE NOTICE '✅ 8 slots criados para o email 1a8@nexusrs.com.br';
  ELSE
    RAISE NOTICE 'ℹ️ Email 1a8@nexusrs.com.br já existe (ID: %)', first_email_id;

    -- Garantir que existem os 8 slots para o email 1a8
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

    RAISE NOTICE '✅ Garantidos 8 slots disponíveis para o email 1a8@nexusrs.com.br';
  END IF;

  RAISE NOTICE '✅ Reset concluído! Sistema pronto para começar do 1a8';
END $$;

-- Verificar resultado
SELECT 
  ta.email,
  COUNT(ts.id) as total_slots,
  COUNT(CASE WHEN ts.status = 'AVAILABLE' THEN 1 END) as available_slots,
  COUNT(CASE WHEN ts.status = 'ASSIGNED' THEN 1 END) as assigned_slots
FROM tv_accounts ta
LEFT JOIN tv_slots ts ON ts.tv_account_id = ta.id
GROUP BY ta.email
ORDER BY 
  CASE 
    WHEN ta.email = '1a8@nexusrs.com.br' THEN 0
    ELSE 1
  END,
  ta.email
LIMIT 10;

