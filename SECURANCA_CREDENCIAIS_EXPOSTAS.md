# 🚨 ALERTA DE SEGURANÇA - Credenciais Expostas

**Data:** 19 de Novembro de 2025  
**Severidade:** 🔴 CRÍTICA  
**Status:** ⚠️ AÇÃO URGENTE NECESSÁRIA

---

## 📋 Problema Identificado

As seguintes credenciais foram encontradas **hardcoded** nos arquivos commitados no GitHub:

- **Email:** `thomas.bugs@universo.univates.br`
- **Senha:** `***REMOVED***`
- **Arquivos afetados:**
  - `create-admin.ts`
  - `create-admin-direct.ts`

**⚠️ ATENÇÃO:** Essas credenciais já foram expostas publicamente no GitHub e podem ser vistas por qualquer pessoa.

---

## ✅ Correções Aplicadas

### 1. Credenciais Removidas dos Arquivos
- ✅ Credenciais hardcoded removidas de `create-admin.ts`
- ✅ Credenciais hardcoded removidas de `create-admin-direct.ts`
- ✅ Scripts agora usam variáveis de ambiente (`DEFAULT_ADMIN_EMAIL` e `DEFAULT_ADMIN_PASSWORD`)
- ✅ Senhas não são mais impressas no console (mascaradas)

### 2. Arquivos Modificados
- `create-admin.ts` - Agora lê credenciais de variáveis de ambiente
- `create-admin-direct.ts` - Agora lê credenciais de variáveis de ambiente
- `.gitignore` - Documentação adicionada sobre não commitar credenciais

---

## 🔴 AÇÕES URGENTES NECESSÁRIAS

### 1. **ALTERAR A SENHA DO EMAIL EXPOSTO** (CRÍTICO)

**A senha `***REMOVED***` já foi exposta publicamente. Mude imediatamente:**

1. Acesse a conta de email: `thomas.bugs@universo.univates.br`
2. **ALTERE A SENHA IMEDIATAMENTE**
3. Se esse email é usado em outros serviços, altere a senha em todos eles
4. Ative autenticação de dois fatores (2FA) se disponível

### 2. Commitar e Fazer Push das Correções

```bash
# 1. Ver as mudanças
git status

# 2. Adicionar os arquivos corrigidos
git add create-admin.ts create-admin-direct.ts .gitignore

# 3. Commitar
git commit -m "🔒 SECURITY: Remove credenciais hardcoded dos scripts"

# 4. Fazer push
git push origin main
```

### 3. Atualizar o Histórico do Git (OPCIONAL mas Recomendado)

**⚠️ ATENÇÃO:** As credenciais ainda estão no histórico do Git. Para remover completamente:

#### Opção A: Usar git-filter-repo (Recomendado)
```bash
# Instalar git-filter-repo (se não tiver)
pip install git-filter-repo

# Remover credenciais do histórico
git filter-repo --path create-admin.ts --path create-admin-direct.ts \
  --invert-paths --force

# OU remover completamente os arquivos do histórico
git filter-repo --path create-admin.ts --invert-paths --force
git filter-repo --path create-admin-direct.ts --invert-paths --force

# Force push (AVISO: Isso reescreve o histórico)
git push --force origin main
```

#### Opção B: Usar BFG Repo-Cleaner
```bash
# Baixar BFG: https://rtyley.github.io/bfg-repo-cleaner/

# Remover credenciais do histórico
java -jar bfg.jar --replace-text passwords.txt

# Force push
git push --force origin main
```

**⚠️ IMPORTANTE:** Se você fizer force push, **todos os colaboradores** precisarão recriar seus clones locais.

#### Opção C: Aceitar que foi exposta e apenas mudar a senha (Mais Simples)
- Se você já alterou a senha, o risco é mitigado
- O histórico do Git ainda terá a senha antiga, mas ela não é mais válida
- Esta é a opção mais simples e segura se você já alterou a senha

---

## 📝 Como Usar os Scripts Corrigidos

### Método 1: Usando .env.local

1. Adicione ao `.env.local`:
```env
DEFAULT_ADMIN_EMAIL=seu-email@exemplo.com
DEFAULT_ADMIN_PASSWORD=sua-senha-segura
```

2. Execute:
```bash
npx tsx create-admin.ts
```

### Método 2: Variáveis de Ambiente Diretas

```bash
DEFAULT_ADMIN_EMAIL=email@exemplo.com \
DEFAULT_ADMIN_PASSWORD=senha-segura \
npx tsx create-admin.ts
```

### Método 3: create-admin-direct.ts

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=xxx \
DEFAULT_ADMIN_EMAIL=email@exemplo.com \
DEFAULT_ADMIN_PASSWORD=senha-segura \
npx tsx create-admin-direct.ts
```

---

## 🛡️ Prevenção Futura

### ✅ Boas Práticas Implementadas
- ✅ Credenciais agora vêm de variáveis de ambiente
- ✅ `.gitignore` documentado sobre credenciais
- ✅ Scripts não imprimem senhas no console

### 📋 Checklist de Segurança
- [ ] Nunca commitar senhas hardcoded
- [ ] Sempre usar variáveis de ambiente para credenciais
- [ ] Verificar código antes de commitar (`git diff`)
- [ ] Usar `.env.local` para credenciais locais
- [ ] Adicionar `.env*.local` ao `.gitignore` (já está)
- [ ] Revisar arquivos antes de `git push`

### 🔍 Ferramentas de Verificação
- **GitGuardian:** Já detectou o problema (você recebeu o alerta)
- **TruffleHog:** Ferramenta para escanear repositórios por credenciais
- **git-secrets:** Hook do Git para prevenir commits com segredos

---

## 📊 Status Atual

| Item | Status |
|------|--------|
| Credenciais removidas do código | ✅ CORRIGIDO |
| Senha do email alterada | ⚠️ **PENDENTE** (FAÇA AGORA!) |
| Correções commitadas | ⚠️ **PENDENTE** |
| Histórico do Git limpo | ⚠️ **OPCIONAL** |

---

## 🚨 PRIORIDADE MÁXIMA

**1. ALTERE A SENHA DO EMAIL AGORA**  
**2. Commite as correções**  
**3. Faça push**  
**4. (Opcional) Limpe o histórico do Git**

---

**Documento criado em:** 19 de Novembro de 2025  
**Última atualização:** 19 de Novembro de 2025

