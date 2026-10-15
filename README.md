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

### Request body

- `html` (string, obrigatorio)
- `headerHtml` (string, opcional)
- `footerHtml` (string, opcional)
- `headerExcludedPages` (number[], opcional)
- `footerExcludedPages` (number[], opcional)
- `pageNumberStartPage` (number, opcional)

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
