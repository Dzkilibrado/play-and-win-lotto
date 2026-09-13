# Corrigir comprovantes no PDF e refinar o compartilhamento

## Objetivo
Eliminar a regressão que faz o comprovante real do **Bolão Galera Gmill** aparecer como um bloco verde, melhorar a opção **Completo** e permitir escolher as seções do PDF, sem alterar permissões, armazenamento, tokens ou regras do bolão.

## 1. Diagnóstico obrigatório com o comprovante real
- Rastrear a versão atual publicada desde o registro do comprovante até o arquivo entregue pela URL temporária: nome, extensão, MIME gravado, MIME detectado pelos bytes, tamanho, versão, caminho autorizado, resposta do download, `Blob`, `ArrayBuffer` e assinatura do conteúdo.
- Comparar o código atual com a revisão em que o comprovante foi homologado, isolando exatamente onde os bytes, o tipo ou a incorporação mudaram.
- Gerar artefatos intermediários apenas para diagnóstico local: arquivo baixado, relatório-base, comprovante original e PDF mesclado. Comparar tamanho, assinatura e hash para provar que a geração usa os bytes da versão atual.
- Não aceitar placeholder, página omitida, rasterização desnecessária ou conversão em cor sólida como correção.

## 2. Pipeline confiável de anexos
- Separar explicitamente a preparação do relatório da incorporação dos comprovantes, com uma decisão testável por MIME detectado nos bytes.
- Para **PDF**, carregar os bytes originais com `pdf-lib` e anexar todas as páginas com `copyPages`, sem passar por `canvas`, `pdfjs-dist`, imagem ou `pdfmake`.
- Para **JPEG/JPG** e **PNG**, incorporar os bytes reais com `embedJpg` ou `embedPng`, mantendo proporção, orientação, qualidade e transparência aplicável.
- Para **WEBP**, usar conversão isolada e validada para PNG somente porque a incorporação direta não é suportada, preservando dimensões e transparência.
- Incluir somente comprovantes publicados e sua versão atual. Manter a ordem configurada e anexar 1, 2, 5 ou 10 arquivos sem perdas.
- Colocar os comprovantes no final. Exibir título e descrição no índice da seção; cada arquivo começa em nova página e PDFs permanecem integrais.
- Em falha de um comprovante solicitado, interromper a geração com mensagem segura em vez de produzir silenciosamente um relatório incompleto.

## 3. Seleção do conteúdo do PDF
- Ao escolher **Gerar PDF**, abrir um diálogo leve com **Participantes**, **Jogos** e **Incluir comprovantes publicados**.
- Padrão: Participantes marcado, Jogos marcado e Comprovantes desmarcado.
- Permitir somente Participantes, somente Jogos ou qualquer combinação válida. Bloquear tudo desmarcado com: **“Selecione pelo menos uma seção para gerar o relatório.”**
- Manter sempre nome do bolão, modalidade, concurso, sorteio, situação, resumo principal e data/hora de geração.
- Participantes controla apenas a lista detalhada; Jogos controla a tabela, sua quebra de página, cabeçalho, linhas indivisíveis, dezenas, situação e custo; Comprovantes controla a busca e anexação dos publicados.
- Não criar página ou título de comprovantes quando a opção estiver desmarcada ou quando não houver publicado.
- Invalidar/recriar o PDF quando as opções mudarem, evitando reutilizar um arquivo gerado com outra seleção.

## 4. Opção Completo e resumo compartilhado
- Alterar a descrição de **Completo** para: **“Resumo completo com participantes, jogos e comprovantes publicados.”**
- No quadro **Será compartilhado**, mostrar em linhas legíveis: participantes confirmados, cotas pagas, jogos e, quando houver, comprovantes publicados.
- Obter a contagem real de comprovantes publicados sem expor caminhos, versões privadas ou ampliar permissões.
- Preservar a terminologia pública **Participantes**, **Cotas**, **Jogos** e **Comprovantes**, sem “vinculados”.
- Confirmar os escopos existentes: Completo mostra resumo, participantes, jogos e comprovantes; Jogos mostra jogos e comprovantes; Participantes mostra participantes, cotas e situação, sem comprovantes.

## 5. Testes e homologação
- Adicionar testes das opções do relatório: padrão, bloqueio vazio, somente participantes, somente jogos, participantes + jogos sem comprovantes e relatório completo.
- Cobrir ausência da seção/página de comprovantes quando desmarcada e inclusão de 1, 2, 5 e 10 comprovantes quando marcada.
- Adicionar regressão do pipeline por tipo: assinatura real, estratégia escolhida e páginas copiadas para PDF; incorporação real para JPEG, PNG e WEBP.
- Reproduzir com o comprovante real do **Bolão Galera Gmill**, gerar o relatório completo e inspecionar visualmente todas as páginas. A tarefa só será concluída se o comprovante estiver real, legível e sem bloco verde.
- Validar texto, resumo e contagem da opção Completo, além dos três links públicos, sem mudar seus tokens ou acessos.
- Validar o diálogo e o resumo em 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900, com zero rolagem horizontal.
- Rodar testes direcionados e completos, verificação de tipos e compilação.

## Limites
- Nenhuma alteração em participantes, pagamentos, rateio, geração de jogos, conferência, estatísticas, regras de acesso, armazenamento, tokens públicos, domínio ou sincronização oficial.
- Nenhuma funcionalidade além da correção do comprovante, do refinamento de **Completo** e da seleção das seções do PDF.
- A entrega final responderá aos 27 itens solicitados, incluindo causa raiz comprovada, arquivo responsável, validação real, total de testes e limitações restantes, e aguardará homologação.