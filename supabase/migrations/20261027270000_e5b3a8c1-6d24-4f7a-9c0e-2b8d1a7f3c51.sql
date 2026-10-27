-- Novo tipo de acesso SUPORTE.
-- Deve ser executado SOZINHO e antes da migração seguinte: o PostgreSQL só permite
-- usar um valor novo de enum depois que a transação que o criou for concluída.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'SUPORTE';
