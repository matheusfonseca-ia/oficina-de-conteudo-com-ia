# De onde vem o motor

`oficina-de-conteudo-motor/` é uma cópia do motor da Máquina de Edição (`.claude/skills/maquina-de-edicao` do repositório Básico, `matheusfonseca-ia/maquina-de-edicao-com-ia-basico`) com o **modo escritório**, que só existe aqui. O Básico publicado não tem o modo escritório: quem compra só a Máquina não recebe nada da Oficina.

- Copiado em 12/11/2026 da branch `modo-escritorio` do Básico, commit `d089bf5` (= `main` `d7572b7` + modo escritório).
- Mudanças só desta cópia: nome da skill (`oficina-de-conteudo-motor`, com descrição de uso interno; não use `disable-model-invocation`, porque com ele o `claude -p "/oficina-de-conteudo-motor ..."` não roda a skill) e o comando em `referencias/modo-escritorio.md`.
- O instalador da Oficina copia esta pasta pra `~/.claude/skills/oficina-de-conteudo-motor/`. Ela fica ao lado das skills de formato do Básico e do Completo, e é assim que o painel acha os formatos instalados.
- Os formatos, o earshot e o ambiente dos efeitos continuam vindo do Básico (e do Completo) instalados pelo aluno.

## Atualizar a partir do Básico

Não há sincronização automática. Quando o motor do Básico melhorar, traga a mudança pra cá à mão (diff entre o commit acima e a `main` nova do Básico) e mantenha as mudanças do modo escritório: `SKILL.md` (seção "Modo escritório"), `painel/app.js`, `painel/servidor.mjs` e `referencias/modo-escritorio.md`. Depois atualize o commit de origem neste arquivo.
