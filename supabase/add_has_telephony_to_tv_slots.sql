-- Adicionar coluna has_telephony na tabela tv_slots
ALTER TABLE tv_slots 
ADD COLUMN IF NOT EXISTS has_telephony boolean;


