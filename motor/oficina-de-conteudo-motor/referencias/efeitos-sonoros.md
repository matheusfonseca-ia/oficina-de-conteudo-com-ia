# Efeitos sonoros com o earshot

Todo efeito sonoro da Máquina (`stems/sfx.wav`) e o efeito crescente da introdução (`stems/riser.wav`) vêm do **earshot** (https://github.com/Leonxlnx/earshot). Vale pra todo formato, nível e estilo visual. Não sintetize efeitos à mão com NumPy, SciPy ou Web Audio e não baixe efeitos de bancos da internet. A música continua sendo criada por código (bloco 7 de `instrucoes-base.md`).

O earshot tem um banco de 252 sons prontos (`earshot sfx`), monta o kit de efeitos de um vídeo (`earshot kit`) e "escuta" o resultado pra conferir sincronia e volume (`earshot timeline`). A skill `earshot`, instalada junto, explica cada comando em detalhe: leia o "Loop 5" e o "Loop 2" dela antes da primeira edição.

## Onde fica

O instalador do pacote principal coloca o earshot em `~/.maquina-de-edicao/earshot`, com ambiente Python próprio. Use sempre esse Python, chamado aqui de `EARSHOT_PY`:

- Windows: `~/.maquina-de-edicao/earshot/.venv/Scripts/python.exe`
- Mac/Linux: `~/.maquina-de-edicao/earshot/.venv/bin/python`

Os comandos ficam `"$EARSHOT_PY" -m earshot <comando>`. O earshot é a única exceção à regra de instalar dependências dentro do projeto: ele é compartilhado por todos os vídeos e nunca vai pra pasta do projeto.

Se o Python acima não existir ou `"$EARSHOT_PY" -m earshot sfx list --kind hit` falhar, rode de novo o instalador do pacote principal (`instalar.ps1` ou `instalar.sh`). Se a pessoa não tiver mais a pasta do pacote, instale à mão:

```bash
git clone --depth 1 --branch v0.4.0 https://github.com/Leonxlnx/earshot ~/.maquina-de-edicao/earshot
python -m venv ~/.maquina-de-edicao/earshot/.venv
"$EARSHOT_PY" -m pip install torch --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple
"$EARSHOT_PY" -m pip install -e ~/.maquina-de-edicao/earshot
```

Não siga sem o earshot e não troque por efeitos sintetizados.

## Do evento ao som

Cada som da lista do bloco 7 tem um ponto de partida no banco. O timbre descrito pelo formato, pelo estilo visual ou pelo Kit Noite decide qual membro usar: procure com `"$EARSHOT_PY" -m earshot sfx list --category <categoria>` e ouça os números do `sfx render` (onset, pico, fim).

| Som da Máquina | Papel no kit | Ponto de partida no banco | Alinhamento |
|---|---|---|---|
| Clique suave | `click` | `fit/click/floss_lid`, categoria `click` | onset no quadro do clique |
| Impacto abafado, carimbo | `land` | `pro_pop_in/deep`, categorias `pro_pop_in`, `knock`, `cut_hit` | onset no quadro da chegada |
| Sinal de duas notas (confirmação, resposta, janela) | `click.confirm` | `notify`, `pro_notify`, `mallet` com `--pitch` (duas notas, a segunda mais aguda) | onset de cada nota |
| Moeda | `bell` | `mallet/glock` ou `notify` com `--pitch`, duas notas curtas e agudas | onset no quadro do ganho |
| Som de passagem | `whoosh.short` | `fit/whoosh.short/bamboo_swish`, `whoosh_fast/crisp`, com `--dur` e `--apex` no movimento | pico no meio do movimento |
| Efeito crescente (riser) | `riser` | `riser/dark`, com `--dur` de 2 a 3 s | fim na junção do gancho |

"Tic" de vidro, "pop" e "plim" dos formatos e estilos: `tick` (`fit/tick/domino`, `pro_tap/glass`) e `pop` (`ui_pop/soft`, `fit/pop/mouth_plop`). Sons que o padrão universal proíbe (tecla, tique de contador, 8 bits, risco) continuam proibidos, mesmo que existam no banco.

Se o banco não tiver o timbre exato que o formato descreve, use o mais próximo e registre a troca no relatório.

## Passo a passo

Trabalhe em `edit/audio/` dentro do projeto.

1. **Kit.** `"$EARSHOT_PY" -m earshot kit init --preset calm -o edit/audio/kit.json`. Use `crisp` em formatos de ritmo alto (Reels de Negócio, Reels com B-roll, Formato Ranking) e `calm` nos demais. Ajuste os papéis pela tabela acima: troque `sound`, defina `edits` (`pitch`, `dur`, `apex`) e use `pitches` pras duas notas da confirmação e da moeda. O preset vem com o riser desligado: ligue com `"riser": {"sound": "riser/dark", "takes": 1, "edits": {"dur": 2.5}, "align": "end"}` e tire `riser` do bloco `off`, a não ser que os efeitos estejam em "Nenhum". O formato dos papéis está em `~/.maquina-de-edicao/earshot/docs/SFX.md`, seção "Kits".
2. **Render.** `"$EARSHOT_PY" -m earshot kit render edit/audio/kit.json --out edit/audio/kit`. Gera as tomadas e o `kit.lock.json`, com onset, pico e fim medidos de cada uma.
3. **Checagem do kit.** `"$EARSHOT_PY" -m earshot kit check edit/audio/kit.json --out edit/audio/kit`. Troque o som ou o ajuste de qualquer tomada com aviso; não use tomada avisada.
4. **Lista de eventos.** Monte `edit/audio/cues.json` no formato que o earshot lê (`{"fps": 60, "events": [{"t": 3.25, "kind": "click", "id": "c01"}]}`, tempo em segundos no vídeo final) com os eventos que sobraram depois do padrão universal (só eventos fortes, no máximo um a cada 0,6 s, no máximo três passagens no vídeo): tempo, papel e tomada. Anote ao lado (no plano ou em `edit/audio/mix.json`) qual tomada vai em cada evento, alternando as tomadas de um mesmo papel sem repetir a mesma em sequência.
5. **Mixagem do `sfx.wav`.** Num script Python (o próprio `EARSHOT_PY` tem numpy e soundfile), coloque cada tomada pelo ponto medido no lock: onset no quadro do evento pra cliques, impactos e notas; pico no meio do movimento pras passagens. Ignore `level_db` e `bed_db` do kit: o volume segue o padrão universal, medido contra o pico da voz (cliques, impactos, carimbos, moeda e confirmações 18 dB abaixo; passagens 17 dB abaixo; nada a menos de 15 dB). Faixa com a duração completa do vídeo, 48 kHz estéreo.
6. **Riser.** Coloque a tomada do riser em `stems/riser.wav` com o fim audível exatamente na junção em que o gancho termina, pico 22 dB abaixo do pico da voz.
7. **Escuta.** `"$EARSHOT_PY" -m earshot timeline edit/stems/sfx.wav --cues edit/audio/cues.json` e confira que cada evento foi ouvido no tempo certo (offset dentro de um quadro). Repita na exportação, sobre o `final.mp4`. Na primeira vez o earshot baixa os modelos de escuta (cerca de 1,1 GB), e cada chamada leva de 20 a 40 s pra carregar: agrupe as escutas.

No relatório, liste cada efeito com tempo, id do banco, tomada e pico em relação à voz, mais o resultado da escuta.
