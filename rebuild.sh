#!/bin/bash

echo "🔄 Limpando caches..."

# Remover cache do Next.js
rm -rf .next
echo "✅ Cache .next removido"

# Remover cache do TypeScript
rm -rf .tsbuildinfo
rm -rf *.tsbuildinfo
find . -name "*.tsbuildinfo" -delete 2>/dev/null
echo "✅ Cache TypeScript removido"

# Remover cache do node_modules (se existir)
find . -type d -name "node_modules/.cache" -exec rm -rf {} + 2>/dev/null
echo "✅ Cache do node_modules removido (se existir)"

echo ""
echo "✅ Limpeza concluída!"
echo ""
echo "📝 Próximos passos:"
echo "1. Pare o servidor (Ctrl+C)"
echo "2. Execute: npm run dev"
echo "3. No navegador, faça um hard refresh (Ctrl+Shift+R)"
echo ""
