# Corrigir autenticação no upload de comprovantes

## Objetivo
Eliminar o erro de validação `exp` na origem, mantendo armazenamento privado, autorização por organizador/admin e RLS.

## Implementação
- Confirmar qual token chega ao primeiro POST do armazenamento e comparar o `exp` interno do JWT, o prazo registrado na sessão e o relógio UTC.
- Criar uma operação protegida de upload no servidor: validar a sessão pelo middleware, autorizar o bolão, gravar o arquivo privado e criar o registro transacionalmente do ponto de vista da aplicação.
- Em falha após gravar o arquivo, remover imediatamente o objeto recém-criado; não gerar URL de leitura durante o upload.
- Aplicar o mesmo fluxo seguro à substituição e exclusão, incluindo limpeza compensatória e mensagens amigáveis sem expor detalhes técnicos.
- Manter URL temporária somente na ação Visualizar e preservar os escopos públicos Participantes/Jogos/Completo.

## Validação
- Reproduzir o cenário real com PNG e verificar criação, visualização, edição, substituição, publicação e exclusão.
- Cobrir JPG e PDF, arquivos órfãos, sessão válida/próxima da expiração/renovável/realmente expirada.
- Confirmar links públicos e composição do PDF; rodar testes completos, tipos e build.
