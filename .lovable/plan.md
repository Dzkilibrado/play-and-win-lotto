# Domínio oficial com WWW

## Objetivo
Usar `https://www.gestordasorte.com.br` como origem canônica única em todas as URLs públicas apresentadas pelo Gestor da Sorte.

## Implementação
- Atualizar a configuração central para o domínio com WWW e expor uma função única para compor URLs públicas com rota, parâmetros e tokens preservados.
- Fazer os links públicos de Participantes, Jogos e Completo usarem sempre essa configuração, independentemente de o usuário estar no preview, localhost ou domínio temporário.
- Garantir que copiar link, copiar mensagem, WhatsApp e compartilhamento do aparelho recebam exatamente a mesma URL canônica.
- Incluir a URL pública canônica no relatório PDF e reutilizar a mesma fonte em futuros QR Codes.
- Corrigir o rodapé e todos os metadados públicos de Open Graph e canonical, incluindo a página pública dinâmica `/b/{token}`.
- Manter retornos de autenticação na origem em uso durante preview; esses endereços técnicos não serão apresentados como links públicos.

## Validação
- Testar os três escopos com tokens distintos: Participantes, Jogos e Completo.
- Confirmar as URLs passadas a WhatsApp, área de transferência e `navigator.share`.
- Inspecionar o PDF gerado, Open Graph e canonical para ausência de `lovable.app`, preview, localhost e domínio sem WWW.
- Validar no site publicado o acesso por WWW.
- Reconsultar o domínio sem WWW e testar redirecionamento HTTP preservando rota, query string e token assim que a configuração terminar; se ainda estiver em provisionamento, registrar esse bloqueio sem afirmar que o redirecionamento já funciona.
- Executar testes e verificações de tipos.

## Configuração publicada
No momento da verificação, `www.gestordasorte.com.br` está ativo e o projeto está público. `gestordasorte.com.br` está em provisionamento; a confirmação final do redirecionamento depende dessa etapa concluir e de o WWW estar definido como domínio primário.
