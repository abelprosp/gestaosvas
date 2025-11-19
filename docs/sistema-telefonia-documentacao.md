

Para abrir e executar o projeto no terminal:

## 1. Abrir o terminal e navegar até o projeto

```bash
cd /home/abel/Serviços-Telefonia
```

Ou, se estiver em outro diretório:
```bash
cd ~/Serviços-Telefonia
```

## 2. Instalar dependências (se ainda não instalou)

**Backend:**
```bash
cd backend
npm install
cd ..
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

## 3. Executar o projeto

Você precisa de **dois terminais** (um para o backend e outro para o frontend):

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
<code_block_to_apply_changes_from>
```

## 4. Acessar a aplicação

- Frontend: geralmente em `http://localhost:5173` (Vite mostra a URL exata)
- Backend: geralmente em `http://localhost:4000`

## Comandos úteis

- Ver estrutura do projeto:
```bash
ls -la
```

- Verificar se as dependências estão instaladas:
```bash
cd backend && ls node_modules
cd ../frontend && ls node_modules
```

- Parar os servidores: `Ctrl + C` em cada terminal

Precisa de ajuda com alguma etapa específica?