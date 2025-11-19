# Sistema de Gestão de Serviços - Next.js

Sistema completo de gestão de serviços de telefonia migrado para Next.js com App Router, totalmente compatível com Vercel e focado em segurança.

## 🚀 Status da Migração

✅ **100% CONCLUÍDO:**
- ✅ Estrutura base do Next.js criada (App Router)
- ✅ Todas as 39 rotas da API migradas (Express → Next.js API Routes)
- ✅ Todas as 14 páginas migradas para App Router
- ✅ Todos os componentes atualizados (react-router → next/navigation)
- ✅ Configurações de segurança implementadas
- ✅ Variáveis de ambiente organizadas e documentadas
- ✅ Middleware de autenticação global
- ✅ Utilitários migrados (mappers, password, httpError)
- ✅ Types migrados e completos
- ✅ Documentação de segurança e migração
- ✅ Compatibilidade total com Vercel
- ✅ Headers de segurança HTTP configurados
- ✅ Autenticação em múltiplas camadas

## 📁 Estrutura do Projeto

```
├── app/                      # Next.js App Router
│   ├── layout.tsx          # Layout raiz
│   ├── page.tsx             # Página inicial (Dashboard)
│   ├── providers.tsx        # Providers (Chakra, Query, Auth)
│   ├── globals.css          # Estilos globais
│   └── api/                 # API Routes
│       └── health/          # Rota de health check
├── components/              # Componentes React compartilhados
├── context/                 # Context providers (Auth)
├── lib/                     # Utilitários e helpers
│   ├── supabase/           # Clientes Supabase (client/server)
│   ├── utils/              # Utilitários (mappers, password, etc.)
│   └── auth.ts             # Autenticação e autorização
├── types/                   # TypeScript types
├── theme/                   # Tema Chakra UI
├── middleware.ts            # Next.js middleware
├── next.config.js           # Configuração Next.js
├── vercel.json              # Configuração Vercel
├── tsconfig.json            # TypeScript config
├── package.json             # Dependências
├── SECURITY.md              # Documentação de segurança
└── MIGRATION_GUIDE.md       # Guia de migração detalhado
```

## 🔐 Segurança

⚠️ **IMPORTANTE:** Este projeto implementa medidas rigorosas de segurança:

- ✅ Nenhuma chave de API hardcoded
- ✅ Variáveis de ambiente separadas (públicas vs privadas)
- ✅ Headers de segurança HTTP configurados
- ✅ Autenticação e autorização em múltiplas camadas
- ✅ Validação de dados em todas as rotas
- ✅ Tratamento seguro de erros

Veja [SECURITY.md](./SECURITY.md) para detalhes completos.

## 🛠️ Setup

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o exemplo e configure suas variáveis:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` e preencha:
- `NEXT_PUBLIC_SUPABASE_URL` - URL do seu projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Chave anônima do Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - **CHAVE PRIVADA** (nunca expor)
- `DEFAULT_ADMIN_EMAIL` - Email do admin padrão (opcional)
- `DEFAULT_ADMIN_PASSWORD` - Senha do admin padrão (opcional)

### 3. Executar em Desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### 4. Build para Produção

```bash
npm run build
npm start
```

## 📦 Deploy no Vercel

### Configuração Inicial

1. Conecte seu repositório no Vercel
2. Configure as variáveis de ambiente no painel:
   - Settings → Environment Variables
   - Adicione todas as variáveis de `.env.local.example`
   - Marque variáveis sensíveis como **encrypted**

### Checklist Pré-Deploy

- [ ] Todas as variáveis de ambiente configuradas no Vercel
- [ ] `NEXT_PUBLIC_*` marcadas como públicas
- [ ] `SUPABASE_SERVICE_ROLE_KEY` marcada como encrypted
- [ ] HTTPS forçado na configuração do Vercel
- [ ] Domínios permitidos configurados no Supabase
- [ ] Testes de autenticação passando
- [ ] Build local sem erros (`npm run build`)

### Deploy Automático

O Vercel faz deploy automático a cada push no branch `main`.

## 📚 Documentação

- [SECURITY.md](./SECURITY.md) - Documentação completa de segurança
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Guia detalhado de migração

## 🔄 Migração Completa

Este projeto está em migração de React + Express para Next.js. Veja [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) para:

- Lista completa de rotas a migrar
- Guia passo a passo para cada tipo de migração
- Exemplos de código antes/depois
- Checklist de progresso

## 🧪 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento
npm run build        # Build de produção
npm start            # Servidor de produção
npm run lint         # Lint do código
npm run type-check   # Verificação de tipos TypeScript
```

## ⚠️ Notas Importantes

1. **Variáveis de Ambiente:** Nunca commite arquivos `.env*` no git. Eles estão no `.gitignore`.

2. **Service Role Key:** A chave `SUPABASE_SERVICE_ROLE_KEY` é extremamente sensível e deve:
   - Nunca ser exposta ao cliente
   - Nunca ser commitada no git
   - Ser marcada como encrypted no Vercel

3. **Autenticação:** O middleware protege automaticamente todas as rotas exceto `/login` e `/api/auth`.

4. **API Routes:** Todas as rotas da API verificam autenticação automaticamente via `createApiHandler`.

## 🐛 Troubleshooting

### Erro: "SUPABASE_URL não configurado"
- Verifique se `.env.local` existe e tem as variáveis configuradas
- No Vercel, verifique se as variáveis estão configuradas

### Erro: "Sessão inválida"
- Limpe cookies e tente fazer login novamente
- Verifique se o Supabase está configurado corretamente

### Build falha
- Execute `npm run type-check` para ver erros de TypeScript
- Verifique se todas as dependências estão instaladas

## 📞 Suporte

Para questões de segurança, **NÃO** abra issues públicos. Entre em contato diretamente com a equipe de desenvolvimento.

---

**Última atualização:** 2025-01-17
**Versão:** 2.0.0 (Next.js Migration)
# gestaonovo
# gestaonovo
