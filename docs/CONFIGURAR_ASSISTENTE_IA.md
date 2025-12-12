# Configuração do Assistente Virtual com IA

O assistente virtual agora suporta integração com APIs de IA para responder perguntas gerais de forma mais inteligente.

## 🎯 Como Funciona

O assistente virtual funciona em duas camadas:

1. **Comandos Específicos**: Respostas pré-programadas para comandos específicos do sistema (ex: "mostrar estatísticas", "buscar cliente", etc.)
2. **IA Generativa**: Quando não encontra um comando específico, usa uma API de IA para gerar respostas inteligentes

## 🔧 Configuração

### 1. Obter Chave de API

Você precisa de uma chave de API de um provedor de IA. Opções recomendadas:

- **OpenAI** (GPT-3.5/GPT-4): https://platform.openai.com/api-keys
- **Anthropic** (Claude): https://console.anthropic.com/
- **Google** (Gemini): https://makersuite.google.com/app/apikey

### 2. Configurar Variáveis de Ambiente

Adicione as seguintes variáveis no seu arquivo `.env.local` (ou nas variáveis de ambiente da Vercel):

```bash
# OpenAI (recomendado)
OPENAI_API_KEY=sk-sua-chave-api-aqui
OPENAI_MODEL=gpt-3.5-turbo  # ou gpt-4, gpt-4-turbo, etc.

# Alternativa: Anthropic Claude
# ANTHROPIC_API_KEY=sua-chave-aqui
# ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Alternativa: Google Gemini
# GOOGLE_API_KEY=sua-chave-aqui
# GOOGLE_MODEL=gemini-pro
```

### 3. Configurar na Vercel

Se estiver usando Vercel:

1. Acesse o dashboard do projeto
2. Vá em **Settings** → **Environment Variables**
3. Adicione `OPENAI_API_KEY` com sua chave
4. Adicione `OPENAI_MODEL` com o modelo desejado (opcional, padrão: `gpt-3.5-turbo`)
5. Faça o redeploy da aplicação

## 📝 Modelos Disponíveis

### OpenAI
- `gpt-3.5-turbo` - Mais econômico, rápido
- `gpt-4` - Mais inteligente, mais caro
- `gpt-4-turbo` - Melhor custo-benefício

### Anthropic Claude
- `claude-3-opus-20240229` - Mais poderoso
- `claude-3-sonnet-20240229` - Balanceado
- `claude-3-haiku-20240307` - Mais rápido e econômico

## 💰 Custos

**OpenAI GPT-3.5-turbo:**
- Input: ~$0.50 por 1M tokens
- Output: ~$1.50 por 1M tokens
- Custo médio por conversa: ~$0.001-0.01

**OpenAI GPT-4:**
- Input: ~$10-30 por 1M tokens
- Output: ~$30-60 por 1M tokens
- Custo médio por conversa: ~$0.01-0.10

💡 **Dica**: Comece com `gpt-3.5-turbo` para testar. É muito mais econômico e ainda oferece respostas de qualidade.

## 🔒 Segurança

- A chave de API é armazenada apenas no servidor (variáveis de ambiente)
- Nunca é exposta ao cliente
- Requer autenticação para usar o chat
- Rate limiting aplicado automaticamente

## 🚫 Sem API Configurada

Se a API de IA não estiver configurada, o assistente continuará funcionando normalmente com os comandos específicos. Apenas perguntas gerais que não correspondem a comandos específicos retornarão uma mensagem de ajuda padrão.

## 🧪 Testando

Após configurar:

1. Faça login no sistema
2. Abra o assistente virtual (ícone de chat)
3. Faça uma pergunta geral, como:
   - "O que é este sistema?"
   - "Como funciona a gestão de clientes?"
   - "Explique sobre os planos de TV"
4. Se a IA estiver configurada, você receberá uma resposta inteligente
5. Se não estiver configurada, receberá a mensagem de ajuda padrão

## 🛠️ Suporte a Outras APIs

Para adicionar suporte a outras APIs de IA, modifique o arquivo `app/api/assistant/chat/route.ts` e adicione a lógica específica do provedor.

