-- Habilita RLS na tabela client_services se não estiver habilitado
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;

-- Remove políticas existentes se houver (para evitar conflito)
DROP POLICY IF EXISTS "Service Role can do everything on client_services" ON client_services;
DROP POLICY IF EXISTS "Authenticated users can select client_services" ON client_services;
DROP POLICY IF EXISTS "Authenticated users can insert client_services" ON client_services;
DROP POLICY IF EXISTS "Authenticated users can update client_services" ON client_services;
DROP POLICY IF EXISTS "Authenticated users can delete client_services" ON client_services;

-- Garante que service_role tenha acesso total (Superadmin do sistema)
CREATE POLICY "Service Role can do everything on client_services"
ON client_services
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- PERMISSÃO PARA VENDEDORES (Authenticated Users)
-- Permite que vendedores insiram, vejam e atualizem serviços dos clientes
CREATE POLICY "Authenticated users can select client_services"
ON client_services
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert client_services"
ON client_services
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_services"
ON client_services
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client_services"
ON client_services
FOR DELETE
TO authenticated
USING (true);
