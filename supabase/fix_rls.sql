
-- Habilita RLS na tabela client_services se não estiver habilitado
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;

-- Garante que service_role tenha acesso total
CREATE POLICY "Service Role can do everything on client_services"
ON client_services
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Garante que usuários autenticados possam ver seus serviços (ajuste conforme necessário)
-- Se quiser permitir que vendedores vejam todos os serviços:
CREATE POLICY "Authenticated users can select client_services"
ON client_services
FOR SELECT
TO authenticated
USING (true);

-- Se quiser permitir que vendedores insiram/atualizem (caso não use service role no futuro):
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

