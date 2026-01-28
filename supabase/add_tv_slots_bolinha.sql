-- Adiciona campo "bolinha" (numérico, preenchimento manual) na tabela tv_slots
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tv_slots'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'tv_slots' AND column_name = 'bolinha'
    ) THEN
      ALTER TABLE tv_slots ADD COLUMN bolinha numeric;
      COMMENT ON COLUMN tv_slots.bolinha IS 'Campo manual (bolinha) preenchido pelo admin.';
      RAISE NOTICE '✅ Coluna bolinha adicionada à tabela tv_slots';
    ELSE
      RAISE NOTICE 'ℹ️ Coluna bolinha já existe na tabela tv_slots';
    END IF;
  ELSE
    RAISE WARNING '⚠️ Tabela tv_slots não existe. Execute primeiro supabase/schema.sql';
  END IF;
END $$;
