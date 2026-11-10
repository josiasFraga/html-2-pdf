<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## HTML to PDF API

### Endpoint

- `POST /html-to-pdf`

### Limites de tamanho e carga

O servidor e a entrada Lambda compartilham a configuracao HTTP:

| Variavel de ambiente | Padrao | Valores aceitos |
|---|---|---|
| `PDF_MAX_REQUEST_BYTES` | `20971520` (20 MiB) | 1024 a 104857600 bytes (100 MiB) |
| `PDF_MAX_CONCURRENT_REQUESTS` | `2` | inteiros de 1 a 8 |

O teto e do JSON completo em bytes UTF-8 (HTML, fontes, imagens base64,
cabecalho e rodape), nao apenas da quantidade de cartazes. Substitui o limite
padrao de 100 KiB do parser Nest/Express. O valor exato do teto e aceito;
acima dele retorna HTTP 413 antes de abrir uma pagina Chromium. Configuracao
invalida impede a inicializacao, sem aceitar limites ilimitados. Defina as
variaveis no ambiente do processo/PM2 e reinicie; nao ha carga automatica de
arquivos `.env`.

Requisicoes comprimidas sao rejeitadas com 415 para evitar expansao
descontrolada. JSON invalido retorna 400. Os erros de parsing nao incluem o
HTML recebido nos logs. O limite de requisicoes simultaneas e aplicado antes
do parsing; excesso retorna 503 com `Retry-After: 5`, sem fila ilimitada.
Ha tambem um limite de renderizacoes ativas: desconectar o cliente nao libera
uma vaga Chromium enquanto a conversao anterior ainda estiver executando.
O browser e compartilhado e a inicializacao concorrente usa um unico launch.
O servidor HTTP local limita o recebimento do corpo a 60 segundos e dos
headers a 30 segundos. Esses prazos nao sao um timeout total de conversao.

O Cartazes continua enviando lotes de ate 100 registros e reunindo os PDFs
por papel/orientacao. Aumentar a selecao nao exige uma unica requisicao
gigante. Mesmo um lote pode ultrapassar o teto se repetir muitas imagens:
nesse caso, reduza-o ou ajuste o limite apos medir memoria. O backend traduz
413/503 em mensagens claras para o operador.

**Operacao segura:** mantenha este servico em rede privada, acessivel apenas
pelos backends autorizados, com firewall/proxy e limites equivalentes no
proxy. Ele recebe HTML confiavel de aplicacoes internas; nao e um sandbox
para HTML hostil nem uma API publica autenticada. O Chromium existente usa
`--no-sandbox` e pode carregar recursos de rede referenciados no HTML:
os limites acima nao substituem isolamento do processo, restricoes de rede
de saida e controle de acesso. Nenhuma dessas permissoes foi ampliada.
Na Lambda, limites menores do API Gateway/Lambda prevalecem; o teto local
nao remove limites do provedor. Concorrencia e por processo/instancia:
dimensione o total considerando workers e replicas.

### Request body

- `html` (string, obrigatorio)
- `marginMm` (numero, opcional, de 0 a 50): margem uniforme da pagina em mm.
  `0` remove as margens adicionadas pelo servico. Sem esse parametro,
  mantem o padrao legado: 10 px nas laterais e zero em cima/embaixo.
  Nao remove padding, margens ou bordas definidos no HTML/modelo.
- `format` (`"A3"`, `"A4"` ou `"custom"`, opcional): padrao `"A4"`.
- `orientation` (`"portrait"` ou `"landscape"`, opcional): vertical ou horizontal; padrao `"portrait"`.
- `width` e `height` (strings, obrigatorias quando `format` for `"custom"`): medidas positivas com unidade `mm`, `cm`, `in` ou `px`.
- `headerHtml` (string, opcional)
- `footerHtml` (string, opcional)
- `headerExcludedPages` (number[], opcional)
- `footerExcludedPages` (number[], opcional)
- `pageNumberStartPage` (number, opcional)
- `leftMarginText` (string, opcional): texto vertical na lateral esquerda.
- `rightMarginText` (string, opcional): texto vertical na lateral direita.

### Tamanho e orientacao da folha

A3 horizontal:

```json
{
  "html": "<html><body><p>Relatorio</p></body></html>",
  "format": "A3",
  "orientation": "landscape"
}
```

Tamanho personalizado de 180 x 250 mm, vertical:

```json
{
  "html": "<html><body><p>Relatorio</p></body></html>",
  "format": "custom",
  "width": "180mm",
  "height": "250mm",
  "orientation": "portrait"
}
```

- Sem esses campos, o comportamento permanece A4 vertical.
- Para tamanho personalizado, envie as duas dimensoes na base vertical (largura menor que altura); `landscape` gera a folha na horizontal. Ex.: 180 x 250 mm passa a 250 x 180 mm.
- Dimensoes so podem ser enviadas com `format: "custom"`. Formatos/orientacoes desconhecidos, valores `null`, dimensoes ausentes, sem unidade ou nao positivas retornam HTTP 400, tanto no servidor quanto na Lambda.
- A configuracao e usada em todas as impressoes, inclusive nas paginas com exclusoes de cabecalho/rodape. Os textos laterais usam as dimensoes finais da folha. As margens existentes nao mudam.
- A API define o tamanho fisico da folha; CSS `@page` do HTML continua sendo interpretado pelo Chromium, sem ativar `preferCSSPageSize`.

### Textos nas laterais

O front envia somente os textos, por exemplo:

```json
{
  "html": "<html><body><p>Conteúdo do laudo</p></body></html>",
  "leftMarginText": "CHASSI: 9BW12345678901234 | PLACA: ABC1D23",
  "rightMarginText": "APROVADO COM OBSERVAÇÕES"
}
```

- Os campos são independentes: é possível enviar apenas um lado. Campos ausentes, vazios ou contendo apenas espaços não desenham texto. Quebras de linha e espaços consecutivos são normalizados para uma linha. HTML é tratado como texto literal.
- Os textos são pretos, em Helvetica, centralizados verticalmente em todas as páginas físicas, inclusive páginas vazias e páginas criadas por transbordamento. À esquerda, a leitura é de baixo para cima (+90°); à direita, de cima para baixo (-90°).
- A fonte padrão é 9 pt. O centro da caixa tipográfica fica a 5 mm da borda física em ambos os lados, evitando texto colado à borda. Textos extensos são reduzidos até 4 pt, com 12 pt de folga mínima nas extremidades superior e inferior. Se ainda não couberem, a API responde HTTP 400 indicando o campo.
- A fonte padrão suporta acentos portugueses e caracteres WinAnsi. Caracteres não suportados, como emojis, retornam HTTP 400, sem substituição silenciosa. Valores que não sejam strings (inclusive `null`) também retornam HTTP 400.
- A aplicação ocorre via `pdf-lib` no PDF final, após as exclusões de cabeçalho/rodapé. As regras `headerExcludedPages`, `footerExcludedPages` e `pageNumberStartPage` não ocultam textos laterais. Não são necessárias novas impressões Chromium para os textos.
- **As margens padrao nao mudam:** sem `marginMm`, o servico mantem 10 px laterais (7,5 pt, aproximadamente 2,65 mm). O Cartazes envia `marginMm: 0` para usar a folha inteira. O afastamento de 5 mm dos textos laterais e apenas a posicao da sobreposicao no PDF, nao uma nova margem do conteudo. Nao ha deteccao automatica de espaco livre: confira possiveis sobreposicoes no laudo real.
- Sem textos laterais, não há carregamento/gravação adicional do PDF. Com textos, a estrutura interna do arquivo é regravada; isso não implica identidade binária, embora os comandos de desenho originais sejam preservados. O conteúdo não é rasterizado nem reconstruído.

### Regras dos novos parametros

- `headerExcludedPages`: oculta o header inteiro nas paginas informadas.
- `footerExcludedPages`: oculta o footer inteiro nas paginas informadas.
- `pageNumberStartPage`: controla a partir de qual pagina os placeholders de numeracao no footer aparecem (`pageNumber` e `totalPages`).
- Se uma pagina estiver em `footerExcludedPages`, o footer nao aparece, mesmo que esteja dentro do inicio da numeracao.

### Posicionamento no modo condicional

- Os dois modos usam o MESMO HTML e o MESMO motor nativo de impressao do Chromium, com as mesmas opcoes de margem e formato. Os parametros novos nao criam containers, colunas, redimensionamentos ou substituicoes de `@page`/`body`.
- CSS inline e folhas de estilo do HTML continuam sendo interpretados pelo Chromium: fontes relativas, flexbox, imagens, tabelas, placa, espacamentos e margens nao sao recalculados por um segundo motor.
- `headerHtml` e `footerHtml` continuam sendo templates nativos, no topo e no rodape da pagina, inclusive vazia, respeitando as exclusoes. A area disponivel continua sendo a do modo nativo; reserve margens no HTML para templates altos.
- As listas e os contadores usam as paginas fisicas do PDF, incluindo as geradas por conteudo que exceda uma folha.
- `pageNumberStartPage: 2` oculta os contadores na primeira pagina; a segunda exibe `2`, sem reiniciar em `1`.
- Uma quebra explicita no final do HTML pode gerar uma pagina vazia segundo as regras nativas do Chromium. Ela nao e adicionada ou removida pelo modo condicional.
- Os templates `headerHtml` e `footerHtml` ficam isolados do CSS do documento pelo proprio Puppeteer.
- As listas tambem ocultam tags semanticas `<header>` e `<footer>` presentes no HTML, preservando o espaco que ocupam (`visibility:hidden`), sem deslocar o restante do documento. Elementos como `<section id="header">` sao conteudo comum: nao sao tratados como template nem ocultados automaticamente. O mecanismo legado de repeticao de `<header>` nas quebras explicitas permanece igual nos dois modos.
- Nos dois modos, os templates recebidos usam o mesmo container de largura total da folha, independente das margens do conteudo. Assim, `text-align:center` ou `text-align:right` funciona mesmo quando a raiz do template nao declara `width:100%`. Larguras e estilos definidos dentro do template sao preservados; por exemplo, `width:100px;text-align:center` centraliza dentro dos 100px.
- O modo original do documento (com ou sem `DOCTYPE`), atributos de `<html>`, seletores e estrutura do conteudo nao sao reconstruidos.

### Como as exclusoes sao aplicadas

1. O Chromium imprime o documento inteiro normalmente.
2. Quando necessario, reimprime o mesmo documento selecionando as paginas fisicas afetadas com os templates ocultos. Paginas com a mesma regra sao agrupadas; a numeracao usa a posicao original, nao a posicao no grupo.
3. `pdf-lib` compoe o resultado sem rasterizar ou redimensionar o conteudo. Paginas nao afetadas sao copiadas da impressao original.

O modo condicional pode consumir mais tempo e memoria devido as impressoes adicionais. Para comparacoes deterministicas, use o mesmo HTML/dados e recursos externos estaveis: scripts, animacoes, fontes e imagens remotas variaveis podem mudar entre impressoes. A composicao reescreve a estrutura interna do PDF; equivalencia visual do conteudo nao significa arquivos binariamente identicos. Recursos de nivel de documento, como arvore de acessibilidade e destinos internos, nao tem preservacao garantida na composicao.

Os testes geram PDFs reais e comparam comandos de desenho do corpo (incluindo escala, placa e imagens), tamanhos de pagina, coordenadas/fontes do texto, exclusoes, links externos, contadores e paginas vazias. Tambem verificam que HTML e opcoes da primeira impressao sao identicos nos dois modos.

### Compatibilidade

- Contrato retrocompativel: clientes atuais nao precisam alterar payload, endpoint ou tratamento da resposta. Sem os campos novos, a renderizacao do conteudo e as margens continuam usando o modo nativo.
- Correcao visual intencional no modo nativo: header/footer sem largura explicita agora respeitam o alinhamento informado dentro de uma area de largura total, em vez de encolherem ate a largura do texto. Isso corrige `text-align:center/right` que antes parecia nao ser aplicado.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
