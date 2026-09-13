# Fechamento de pendências funcionais

## Objetivo
Homologar e corrigir somente os cinco fluxos existentes: comprovantes, compartilhamento no domínio oficial, alteração da própria senha, ocultação de informações técnicas e fechamento do menu mobile.

## Diagnóstico confirmado
- O comprovante ativo real do **Bolão Galera Gmill** é agora `DOC-20260912-WA0064.pdf`: PDF, 88.974 bytes, versão 1, existente no bucket privado e com metadados físicos coerentes. Ele está **privado**, por isso ainda não aparece em Jogos, Completo ou no novo PDF. Conforme autorizado, será publicado e permanecerá publicado.
- O antigo bloco verde vinha de outro PNG cujos próprios bytes eram uniformemente verdes; não era CSS e esse conteúdo não podia ser reconstruído. Esse registro foi excluído logicamente e não é a versão atual.
- O `about:blank` vinha do fluxo antigo assíncrono com `window.open`; o viewer atual já eliminou esse caminho para comprovantes e relatório.
- A visualização pública usa hoje uma rota estável que entrega bytes após validar token, escopo e publicação. Ela será consolidada para renovar acesso temporário sem guardar URL expirada.
- O relatório já mescla PDFs e incorpora imagens, mas ainda precisa de seção explícita de comprovantes, isolamento de falha por arquivo e cobertura de imagens/múltiplos anexos.
- A tela de Configurações ainda mostra nomes internos de recursos ao USER. Alteração de senha e menu mobile já existem, mas precisam de homologação real e regressões mais fortes.

## Implementação
1. **Comprovantes e arquivo real**
   - Validar bytes, assinatura, páginas, resposta HTTP, metadados e versão atual do PDF real.
   - Publicar o comprovante `Picpay` pelo fluxo oficial, mantendo o token atual de cada escopo.
   - Manter `DocumentViewer` como único visualizador privado/público e do relatório; corrigir renovação, loading, retry, download, proporção, zoom e paginação onde necessário.
   - Tornar o acesso público uma única regra protegida por token válido + escopo Jogos/Completo + documento publicado e não excluído, sem expor path, bucket ou versões.
   - Garantir que Participantes não consulte nem receba documentos; Jogos e Completo recebem somente metadados públicos mínimos.
   - Preservar bucket privado, versão antiga e versão atual, sem URLs temporárias persistidas ou cacheadas além da validade.

2. **Relatório completo**
   - Inserir a seção Comprovantes após Jogos/Resultado, com quebra própria.
   - Incorporar JPG/JPEG/PNG/WEBP com proporção preservada e mesclar todas as páginas de PDFs.
   - Tratar arquivo incompatível individualmente, sem perder o restante do relatório.
   - Validar 1, 2, 5 e 10 documentos, publicados versus privados, substituição, despublicação e exclusão.

3. **Domínio oficial**
   - Confirmar Participantes, Jogos, Completo, copiar link, copiar mensagem, WhatsApp, compartilhamento nativo, PDF, canonical e Open Graph em `https://www.gestordasorte.com.br`.
   - Confirmar redirecionamento 308 do domínio anterior preservando rota, token e parâmetros, sem regenerar tokens.

4. **Senha, informações técnicas e menu**
   - Homologar alteração da própria senha para USER e ADMIN, reautenticação pelo provedor e conta somente Google sem senha local.
   - Remover a lista de nomes internos da tela USER e disponibilizar diagnósticos somente na área administrativa já protegida por papel no backend.
   - Substituir mensagens técnicas cruas nas telas USER por mensagens funcionais seguras; detalhes permanecem apenas em registros/área administrativa apropriada.
   - Validar fechamento do menu por destino, rota e página atual; manter expansão sem destino aberta e não atrasar navegação.

## Testes e homologação
- Criar regressões para escopos públicos, rota de arquivo, renovação de acesso, viewer, imagem/PDF no relatório, volumes, mensagens seguras, senha USER/ADMIN/Google e menu.
- Executar a matriz JPG/JPEG/PNG/WEBP/PDF simples/multipágina e o PDF real do Bolão Galera Gmill.
- Validar 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900; Claro, Escuro e Automático; sem rolagem horizontal.
- Inspecionar visualmente o PDF final renderizado e os fluxos publicados reais.
- Rodar testes, tipos e build; entregar os 45 resultados pedidos, limitações reais e aguardar homologação, sem iniciar outra funcionalidade.
