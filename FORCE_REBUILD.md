# Forçar Recompilação Completa

Se as alterações não estiverem aparecendo, siga estes passos:

## 1. Parar o servidor
Pressione `Ctrl+C` no terminal onde o servidor está rodando.

## 2. Limpar todos os caches

Execute estes comandos:

```bash
# Remover cache do Next.js
rm -rf .next

# Remover cache do node_modules (se existir)
find . -type d -name "node_modules/.cache" -exec rm -rf {} + 2>/dev/null

# Remover cache do TypeScript (se existir)
rm -rf .tsbuildinfo
rm -rf *.tsbuildinfo
```

## 3. Reiniciar o servidor

```bash
npm run dev
```

## 4. Limpar cache do navegador

- **Chrome/Edge**: `Ctrl+Shift+Delete` > Limpar dados de navegação > Cache de imagens e arquivos
- **Ou**: `Ctrl+Shift+R` (hard refresh)
- **Ou**: Abra o DevTools (F12) > Clique com botão direito no botão de recarregar > "Esvaziar cache e atualizar forçadamente"

## 5. Verificar se os arquivos foram salvos

Verifique se estas alterações estão nos arquivos:

### `components/pages/Users/UsersPage.tsx` (linha ~1926)
Deve ter: `slot.status === "AVAILABLE" && isAdmin`

### `lib/api/client.ts`
Deve ter o interceptor melhorado com refresh de token

### `lib/auth.ts` (linha 71)
Deve usar `user_metadata` (isso está correto para o objeto do Supabase JS)

## 6. Verificar logs do servidor

Ao reiniciar, procure por erros de compilação no terminal. Se houver erros, eles aparecerão ali.

## 7. Verificar no navegador

Abra o DevTools (F12) e vá na aba Console. Procure por:
- Erros de compilação
- Mensagens de erro de autenticação
- Logs do `[createApiHandler]` ou `[API Interceptor]`
