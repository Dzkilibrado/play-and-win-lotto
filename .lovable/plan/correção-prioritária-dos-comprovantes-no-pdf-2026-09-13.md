# Correção prioritária dos comprovantes no PDF

## Objetivo
Fazer o modal de PDF, os links Completo/Jogos e a geração do relatório usarem exatamente a mesma lista oficial de comprovantes: documentos do bolão que estejam ativos, publicados e apontando para a versão atual válida.

## Diagnóstico confirmado
- O Bolão Galera Gmill possui 6 registros históricos de comprovantes.
- Há 1 registro ativo atual, PDF de 88.974 bytes, versão 1, ligado ao bolão correto.
- O registro ativo atual está marcado como privado no banco; por isso a regra vigente retorna 0 comprovantes tanto para o modal quanto para os links públicos.
- O comprovante publicado anterior foi excluído e um novo registro foi criado. A publicação não acompanhou essa recriação, pois novos uploads nascem privados.
- O modal usa a consulta autenticada de documentos ativos e filtra publicação no navegador; os links públicos usam uma função separada. Embora as condições sejam semelhantes, ainda existem duas implementações da regra.

## Implementação
1. Centralizar a seleção de comprovantes disponíveis em uma única função de dados, incluindo somente documento ativo, publicado e sua versão atual.
2. Usar essa mesma fonte no modal, no download dos bytes para o PDF e na listagem dos links Completo/Jogos; Participantes continuará sem comprovantes.
3. Corrigir o estado publicado do comprovante real atual do Bolão Galera Gmill, preservando arquivo, versão, vínculo e tokens existentes.
4. Ajustar o fluxo de salvar/publicar/substituir para invalidar todas as consultas relacionadas ao bolão e aos documentos públicos, removendo contagens antigas do cache.
5. Desabilitar e desmarcar “Incluir comprovantes publicados” quando a lista oficial estiver vazia; com documentos disponíveis, enviar exatamente essa lista ao relatório.
6. Manter PDFs originais sem rasterização: validar assinatura e MIME, carregar os bytes reais e anexar todas as páginas com `copyPages` ao final do relatório. Imagens continuam pelo caminho próprio de JPG/PNG/WEBP.
7. Não criar seção ou página de comprovantes quando a opção estiver desmarcada.

## Testes e validação
- Cobrir publicar → 0 para 1, despublicar → 1 para 0, republicar → 1 e substituir → mantém uma entrada usando a versão atual.
- Comparar diretamente a seleção administrativa do PDF com a seleção pública de Completo/Jogos.
- Confirmar os dados enviados ao gerador: quantidade, nome, MIME, versão e bytes, sem expor informações técnicas na tela.
- Gerar os dois PDFs reais do Bolão Galera Gmill: sem comprovante e com comprovante.
- Rasterizar e inspecionar todas as páginas do PDF final; o comprovante deve estar legível e sem bloco verde.
- Validar Completo, Jogos e Participantes, além do modal em 360×800 e 390×844 sem rolagem horizontal.
- Executar testes completos, verificação de tipos e compilação.

## Limites
Nenhuma alteração em pagamentos, rateio, participantes, gerador, estatísticas, autenticação, permissões, regras financeiras, Storage, domínio ou tokens públicos.
