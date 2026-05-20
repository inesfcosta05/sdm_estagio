# Migração e Reestruturação de Plataforma de Gestão de Contactos

## CAPA

---

**RELATÓRIO DE PROJETO**

**Migração e Reestruturação de Plataforma de Gestão de Contactos**

Licenciatura em Engenharia Informática

---

**Autora:** Inês Fernandes Costa (Aluno nº 27410)

**Orientador ESTGV:** Paulo Costa (paulo.costa@estgv.ipv.pt)

**Orientador Empresa:** João Diogo Pereira (diogopereira@celeuma.pt)

**Empresa:** Celeuma Multimédia Lda

**Período:** Maio de 2026

---

Instituto Politécnico de Viseu
Escola Superior de Tecnologia e Gestão
Departamento de Engenharia Informática

Viseu, Maio de 2026

---

## Resumo

Este projeto consistiu na modernização e consolidação de uma aplicação web de gestão interna, centrada em fichas comerciais, clientes, páginas, perfis de utilizador, administração de acessos e sincronização com WordPress. O trabalho foi desenvolvido sobre uma base já existente, mas com forte necessidade de estabilização funcional, normalização da interface, correção de inconsistências entre dados locais e dados remotos, e reforço da experiência de utilização.

A solução final foi organizada em dois grandes blocos. O frontend foi implementado em React, com navegação por rotas, layouts consistentes, componentes reutilizáveis e páginas especializadas para listagem, criação e edição das principais entidades. O backend foi construído em Node.js com Express e MySQL, expondo uma API REST responsável por leitura, escrita, autenticação de perfis, gestão de sessões, administração de utilizadores, e sincronização com a API REST do WordPress.

O projeto procurou equilibrar três objetivos: compatibilidade com o legado existente, robustez técnica e usabilidade. Para isso, foram adotados mecanismos de mapeamento dinâmico de colunas, tolerância a dados incompletos, leitura de preferências do utilizador, sincronização incremental e configuração por variáveis de ambiente.

---

## Índice

1. Introdução
2. Enquadramento e motivação
3. Estado da arte
4. Análise do problema
5. Requisitos funcionais e não funcionais
6. Metodologia de trabalho
7. Arquitetura geral da solução
8. Tecnologias utilizadas
9. Modelo de dados e persistência
10. Backend e API REST
11. Frontend e experiência de utilização
12. Gestão de fichas
13. Gestão de clientes
14. Gestão de páginas
15. Perfil de utilizador e personalização
16. Administração de utilizadores
17. Integração e sincronização com WordPress
18. Configuração local e deployment
19. Testes e validação
20. Problemas encontrados e soluções adotadas
21. Resultados obtidos
22. Conclusão
23. Trabalho futuro
24. Anexos

---

## 1. Introdução

O crescimento de sistemas internos baseados em WordPress e em bases de dados heterogéneas coloca frequentemente desafios de manutenção, usabilidade e consistência. Em muitos casos, a evolução natural de um projeto deste tipo conduz a uma acumulação de funcionalidades distribuídas por várias tecnologias, versões e estilos de implementação. O resultado é uma plataforma funcional, mas difícil de manter, com pontos de falha na integração entre módulos, inconsistências de interface e regras de negócio espalhadas por vários locais.

O presente projeto surge nesse contexto. O objetivo principal foi organizar e estabilizar uma aplicação já existente, garantindo que o utilizador pudesse gerir fichas, clientes, páginas e definições pessoais a partir de uma interface coerente, enquanto o backend continuava a comunicar com uma base de dados MySQL e com uma instalação WordPress remota. O trabalho não se limitou a criar novas páginas. Foi necessário alinhar estruturas de dados, corrigir fluxos de edição, tratar compatibilidade com informação histórica e preparar a aplicação para funcionamento local e em ambiente de deployment.

Do ponto de vista técnico, a solução seguiu uma arquitetura clássica de aplicação web separada em frontend e backend. Contudo, a implementação introduziu diversos mecanismos adicionais: sincronização com WordPress, gestão de preferências persistidas, adaptação dinâmica a colunas reais da base de dados, controlo de permissões por perfil, e uma organização modular do frontend por áreas funcionais.

---

## 2. Enquadramento e motivação

Este projeto insere-se numa realidade empresarial e académica em que os dados operacionais vivem em múltiplos sistemas. A utilização de WordPress como repositório ou interface de publicação é comum, sobretudo quando existe histórico de criação de conteúdos e necessidades de edição rápida. Ao mesmo tempo, um sistema de apoio à atividade comercial ou administrativa exige uma estrutura própria para fichas, clientes e relatórios, algo que WordPress, por si só, nem sempre oferece com a flexibilidade necessária.

Foi precisamente essa necessidade híbrida que motivou o projeto. A plataforma tinha de permitir trabalho diário com informação interna, mas sem perder a ligação ao universo WordPress, onde já existiam dados, conteúdos e hábitos de utilização. Além disso, a interface deveria aproximar-se da lógica visual e operacional de backoffice com que os utilizadores já estavam familiarizados, reduzindo a curva de aprendizagem.

Outro fator importante foi a existência de dados históricos e estruturas legadas. Em vez de forçar uma migração total e arriscada, a abordagem escolhida foi evolutiva: manter compatibilidade com registos antigos, aceitar diferentes nomes de campos quando necessário e garantir que novas funcionalidades não quebrassem o funcionamento base.

---

## 3. Estado da arte

### 3.1 Aplicações web separadas por camadas

A separação entre frontend e backend tornou-se o modelo predominante em aplicações modernas. Esta abordagem melhora a manutenção, facilita a reutilização de APIs e permite evoluir a interface sem reconstruir a lógica de negócio. Em sistemas de gestão, o frontend apresenta dados, recolhe inputs e executa navegação; o backend concentra a persistência, a validação e a integração com serviços externos.

No âmbito deste projeto, esta separação foi particularmente relevante porque permitiu tratar o frontend como uma experiência de utilização focada em produtividade, enquanto o backend lidava com a complexidade da base de dados e da sincronização externa.

### 3.2 REST APIs e integração com sistemas externos

As APIs REST continuam a ser a solução mais comum para comunicação entre sistemas heterogéneos. A simplicidade dos verbos HTTP, a legibilidade das rotas e a compatibilidade com ferramentas padrão tornam este modelo adequado para aplicações que precisam de interoperabilidade. Em particular, a integração com WordPress beneficia deste paradigma, já que a plataforma fornece uma API REST extensa e bem suportada.

Neste projeto, a REST API foi usada para expor operações de leitura e escrita sobre fichas, clientes, páginas, perfis e administração. Em paralelo, foi implementada uma camada de sincronização com endpoints específicos para WordPress e com um serviço de fundo para atualização periódica.

### 3.3 WordPress como ecossistema de conteúdos

WordPress evoluiu de um sistema de blogging para uma plataforma de conteúdos com forte capacidade de extensão. O seu ecossistema de plugins, tipos de conteúdo personalizados e API REST fazem dele uma base frequente para soluções híbridas. Contudo, quando o volume de dados cresce ou quando são necessárias regras de negócio mais específicas, é comum complementar o WordPress com aplicações externas especializadas.

É exatamente isso que se observa neste projeto: o WordPress funciona como fonte ou destino de parte dos dados, enquanto a aplicação local fornece uma interface mais controlada para a operação diária.

### 3.4 Interfaces administrativas inspiradas em backoffice

Soluções de backoffice costumam privilegiar rapidez de navegação, leitura tabular, ações diretas por linha e personalização do espaço de trabalho. O projeto segue esse padrão. Em vez de apostar numa interface minimalista puramente estética, a aplicação privilegia densidade informativa, atalhos, blocos editáveis, quick edit e persistência de opções de visualização.

Essa opção é consistente com aplicações administrativas reais, onde a produtividade frequentemente é mais importante do que a simplicidade visual extrema.

### 3.5 Gestão de preferências do utilizador

Sistemas modernos tendem a guardar preferências por utilizador para permitir uma experiência adaptada. A utilização de localStorage e de preferências persistidas na base de dados permite reter idioma, tema, visibilidade de editor visual, atalhos de teclado e outros ajustes.

No projeto, este princípio foi aplicado de forma clara no perfil do utilizador, com sincronização entre preferências locais e persistência no backend.

---

## 4. Análise do problema

O problema central não era apenas “ter uma aplicação a funcionar”. O sistema precisava de responder a um conjunto de fragilidades concretas:

- coexistência de dados locais e dados WordPress;
- diferentes nomes e formatos de campos ao longo do tempo;
- necessidade de gerir entidades com interfaces distintas, mas visualmente consistentes;
- necessidade de perfis diferenciados, incluindo administração;
- necessidade de manter o utilizador produtivo com poucos cliques;
- necessidade de funcionar em ambiente local e em deployment com variáveis de ambiente.

A análise do código e do comportamento observado mostrou que a solução tinha de ser tolerante à realidade dos dados, não idealizada. Isto significa que a aplicação precisava de:

1. identificar colunas existentes em tempo de execução;
2. tratar campos opcionais sem falhar;
3. aceitar formas antigas de identificar clientes e fichas;
4. manter compatibilidade com WordPress e com dados importados;
5. suportar autenticação, administração e impersonação de forma clara.

---

## 5. Requisitos funcionais e não funcionais

### 5.1 Requisitos funcionais

O sistema deveria permitir:

- listar, criar, editar e eliminar fichas;
- listar, criar, editar e eliminar clientes;
- listar, criar e editar páginas;
- consultar o perfil do utilizador;
- alterar definições de perfil e palavra-passe;
- gerir sessões e senhas de aplicação;
- administrar utilizadores e respetivos papéis;
- sincronizar dados com WordPress;
- consultar relatórios com base em filtros e agrupamentos;
- adaptar a interface ao papel do utilizador.

### 5.2 Requisitos não funcionais

Além da funcionalidade, o sistema precisava de:

- preservar compatibilidade com dados antigos;
- oferecer uma interface clara e consistente;
- ser configurável por ambiente;
- reagir bem a dados incompletos ou inconsistentes;
- ser fácil de executar localmente;
- permitir deployment separado de frontend e backend;
- manter boa legibilidade e manutenção do código.

---

## 6. Metodologia de trabalho

O desenvolvimento foi tratado de forma incremental. Em vez de tentar reescrever todo o sistema de uma vez, a abordagem passou por observar o comportamento atual, identificar os pontos de maior impacto, e corrigir por etapas as áreas críticas.

Na prática, a metodologia teve cinco fases:

1. levantamento da estrutura existente;
2. identificação de rotas, páginas e endpoints principais;
3. validação do funcionamento do backend e da base de dados;
4. estabilização da integração com WordPress;
5. harmonização da interface frontend e dos fluxos de edição.

Esta forma de trabalho foi adequada porque o projeto já continha dados reais e funcionalidades em uso. Uma alteração demasiado agressiva teria elevado o risco de quebra funcional.

---

## 7. Arquitetura geral da solução

### 7.1 Visão global

A solução está organizada em três camadas principais:

- frontend React para apresentação e interação;
- backend Node.js/Express para API e integração;
- MySQL para persistência dos dados locais.

Adicionalmente, existe integração com uma instalação WordPress remota através da API REST, bem como mecanismos de sincronização periódica e manual.

### 7.2 Fluxo de dados

O utilizador interage com o frontend. As páginas fazem pedidos à API do backend. O backend consulta ou altera a base de dados e, quando aplicável, consulta o WordPress. Em operações de sincronização, o serviço de sync percorre coleções do WordPress, compara alterações e grava os registos localmente.

### 7.3 Separação de responsabilidades

Esta separação evita que a interface tenha conhecimento direto da lógica da base de dados, e permite que as regras de negócio fiquem centralizadas no backend. Ao mesmo tempo, o frontend pode concentrar-se em navegação, formulários, filtros, badges de estado e ações rápidas.

---

## 8. Tecnologias utilizadas

### 8.1 Frontend

O frontend foi desenvolvido com React, React Router, Bootstrap e componentes auxiliares de interface. Foram usadas bibliotecas como axios, date-fns, react-icons e react-bootstrap para facilitar chamadas HTTP, manipulação de datas e composição visual.

### 8.2 Backend

O backend foi implementado com Node.js, Express, mysql2, cors, dotenv e axios. O uso de axios no servidor permite comunicação com WordPress e com outros serviços HTTP externos.

### 8.3 Base de dados

Foi usada uma base MySQL com tabelas para fichas, clientes, users, wp_posts e estruturas auxiliares como sessions e app_passwords.

### 8.4 Ferramentas de desenvolvimento

O projeto inclui scripts de apoio para inspeção, limpeza, validação e sincronização, permitindo tarefas de manutenção da base de dados e do conteúdo sincronizado.

---

## 9. Modelo de dados e persistência

### 9.1 Entidade fichas

A entidade fichas representa registos comerciais e de contacto. O backend trata estes registos com especial cuidado, porque a estrutura real da tabela pode variar ao longo do tempo. A implementação lê as colunas disponíveis antes de inserir ou atualizar, evitando falhas quando alguns campos não existem.

### 9.2 Entidade clientes

Os clientes são tratados como registos mais ricos, com denominação fiscal, contactos, morada, NIF, estado, visibilidade e dados de autoria. O backend inclui rotas específicas para listagem, detalhe, criação, atualização e eliminação.

### 9.3 Entidade páginas

As páginas correspondem a conteúdos do tipo `page` no WordPress, ou a equivalentes locais quando o fallback é necessário. A aplicação permite criação e edição com campos de título, conteúdo, slug, estado, autor, ordem e superior.

### 9.4 Utilizadores e perfis

A tabela `users` suporta autenticação e personalização. O backend lê colunas opcionais, cria colunas em falta quando necessário e mantém informação de perfil, preferências e papel do utilizador.

### 9.5 Sessões e senhas de aplicação

Para reforçar o controlo de acesso, o sistema mantém sessões ativas e senhas de aplicação. Isto permite validar sessões, fechar acessos e gerir tokens específicos de utilização.

---

## 10. Backend e API REST

### 10.1 Papel do backend

O backend é o centro da lógica de negócio. É nele que se concentram as validações, os acessos à base de dados, a normalização de campos, o controlo de permissões e a ponte com WordPress.

### 10.2 Rotas principais

As rotas principais incluem:

- `/api/fichas`
- `/api/fichas/:id`
- `/api/clientes`
- `/api/clientes/:id`
- `/api/comerciais`
- `/api/paginas`
- `/api/paginas/:id`
- `/api/perfil`
- `/api/perfil/password`
- `/api/sessions`
- `/api/app-passwords`
- `/api/admin/users`

### 10.3 Comportamento dinâmico baseado no schema

Uma das soluções mais importantes foi a deteção dinâmica das colunas existentes na tabela. Em vez de assumir um esquema fixo, o backend consulta a estrutura real da tabela e adapta a operação de insert ou update às colunas presentes.

Este mecanismo reduz erros em bases de dados legadas e torna o sistema mais tolerante a diferenças entre ambientes.

### 10.4 Validação e normalização

O backend inclui funções de normalização para datas, booleanos, estados, visibilidade e roles. Isto garante que entradas de várias origens possam ser coerentes antes de serem gravadas.

### 10.5 CORS e configuração por ambiente

O acesso ao backend é controlado por CORS com allowlist baseada em variáveis de ambiente. Esta abordagem facilita o deployment em diferentes domínios e protege o sistema de origens não autorizadas.

---

## 11. Frontend e experiência de utilização

### 11.1 Estrutura geral

O frontend foi desenhado como uma aplicação de backoffice, com navegação lateral, barra superior, área central de conteúdo e rodapé discreto.

### 11.2 Rotas da aplicação

O router principal inclui páginas para:

- início;
- fichas;
- nova ficha;
- edição de ficha;
- clientes;
- novo cliente;
- edição de cliente;
- páginas;
- nova página;
- edição de página;
- perfil;
- relatórios;
- administração de utilizadores.

### 11.3 Persistência de preferências

O frontend guarda preferências como idioma, esquema de cores, minimização da sidebar e configurações do utilizador. Sempre que possível, estas preferências são também sincronizadas com o backend.

### 11.4 Navegação e atalho

Foi considerado o uso produtivo da aplicação. Por isso, existem atalhos de teclado e navegação rápida entre áreas de trabalho.

---

## 12. Gestão de fichas

### 12.1 Listagem

A página de fichas apresenta os registos em formato funcional, com foco em leitura rápida, ordenação e ações imediatas.

### 12.2 Criação e edição

Os formulários de criação e edição foram pensados para suportar os vários campos de ficha, incluindo contactos, propostas, adjudicações, faturação e anexos.

### 12.3 Compatibilidade com estrutura histórica

Os dados não seguem sempre um modelo rígido. Por isso, a aplicação mapeia diferentes nomes de campo para a mesma informação e ignora colunas inexistentes quando necessário.

### 12.4 Resultado prático

O efeito desta abordagem é uma página de fichas mais estável, capaz de trabalhar com dados antigos e com novos campos sem obrigar a uma migração brusca.

---

## 13. Gestão de clientes

### 13.1 Organização funcional

Os clientes foram tratados como uma área central do sistema, com listagem, criação, edição e eliminação.

### 13.2 Interface orientada à produtividade

A aplicação privilegia ações rápidas, edição direta e uma disposição visual que aproxima o utilizador da lógica de backoffice administrativa.

### 13.3 Relação com fichas

Clientes e fichas estão interligados, e essa relação foi considerada tanto na modelação dos dados como nos filtros e relatórios.

---

## 14. Gestão de páginas

### 14.1 Papel das páginas

As páginas permitem gerir conteúdos tipo WordPress e também suportam fluxos de edição próprios da aplicação.

### 14.2 Edição dedicada

A edição passou a ter rotas dedicadas, o que melhora a clareza do fluxo e separa a criação da atualização de conteúdos.

### 14.3 Paridade visual e funcional

O módulo de páginas foi alinhado com o padrão das restantes áreas da aplicação, evitando soluções isoladas e inconsistentes.

---

## 15. Perfil de utilizador e personalização

### 15.1 Preferências do perfil

O perfil concentra definições como idioma, tema, opções visuais, palavra-passe e metadados pessoais.

### 15.2 Persistência local e remota

Parte das preferências vive no localStorage para resposta imediata da interface, enquanto outra parte é gravada na base de dados para persistência entre sessões.

### 15.3 Importância para a usabilidade

Estas opções dão ao utilizador controlo sobre o ambiente de trabalho e aproximam a aplicação de uma experiência realmente personalizada.

---

## 16. Administração de utilizadores

### 16.1 Funções administrativas

O módulo administrativo permite listar utilizadores, alterar cargos e simular sessões para testes controlados.

### 16.2 Controlo por papel

A interface administrativa só é exposta a utilizadores com perfil adequado, reduzindo o risco de acesso indevido.

### 16.3 Utilidade operacional

Este módulo é importante não apenas para gestão de permissões, mas também para debugging, apoio e validação de cenários de utilização.

---

## 17. Integração e sincronização com WordPress

### 17.1 Justificação da integração

O WordPress funciona como fonte de dados e, em certos fluxos, como destino de sincronização. A integração evita duplicação manual e reduz divergências entre sistemas.

### 17.2 Serviço de sincronização

O projeto inclui um serviço dedicado que percorre coleções WordPress, procura alterações por data de modificação e grava os registos localmente.

### 17.3 Estratégia incremental

Em vez de reimportar tudo sempre, a sincronização procura apenas os elementos alterados desde a última execução.

### 17.4 Limites sem credenciais

Quando não existem credenciais de edição WordPress, a leitura é mais restrita, respeitando os limites da API e o estado dos conteúdos publicados.

### 17.5 Valor da integração

A sincronização permite manter o sistema local atualizado sem abandonar o ecossistema WordPress que já serve como base de conteúdos.

---

## 18. Configuração local e deployment

### 18.1 Configuração por variáveis de ambiente

O projeto foi desenhado para funcionar com URLs e credenciais configuradas por ambiente, o que facilita a passagem entre desenvolvimento, testes e produção.

### 18.2 Execução local

O backend e o frontend podem ser executados separadamente, desde que a API base e as origens permitidas estejam corretamente configuradas.

### 18.3 Deployment separado

O modelo atual permite alojar frontend estático e backend em hosts diferentes, ou no mesmo domínio com ajuste de ambiente.

---

## 19. Testes e validação

### 19.1 Testes manuais

Foram feitos testes diretos aos endpoints da API para confirmar resposta, conteúdo e comportamento em diferentes contextos.

### 19.2 Validação de dados

Também foi verificada a consistência de dados na base local, incluindo correções de estados, contagens e atualização de registos específicos.

### 19.3 Verificação da interface

O frontend foi analisado em navegação real, confirmando acesso às rotas, carregamento das páginas e resposta às ações de utilização.

---

## 20. Problemas encontrados e soluções adotadas

### 20.1 Porta do backend ocupada

Foi identificado um cenário em que já existia outra instância a ocupar a porta do backend. A solução passou por terminar o processo anterior antes de iniciar uma nova instância.

### 20.2 Sincronização com respostas inesperadas

A API do WordPress respondeu com estados inesperados em alguns testes. O sistema foi mantido tolerante a falhas, usando logs e fallback de leitura local.

### 20.3 Dados inconsistentes entre tabelas e versões

Diferenças entre colunas e estruturas antigas foram tratadas através de leitura dinâmica do schema e de mapeamento flexível de campos.

---

## 21. Resultados obtidos

O projeto resultou numa plataforma mais organizada, funcional e preparada para manutenção. Foram consolidadas as principais áreas operacionais, estabilizada a relação entre frontend e backend, e criada uma base consistente para continuar a evolução do sistema.

Entre os principais resultados estão:

- melhor navegação entre módulos;
- suporte a perfis e permissões;
- sincronização com WordPress;
- compatibilidade com dados históricos;
- configuração por ambiente;
- maior coerência visual e funcional.

---

## 22. Conclusão

O trabalho permitiu transformar um sistema distribuído e heterogéneo numa aplicação mais coerente e controlável. A principal contribuição não foi apenas funcional; foi estrutural. O projeto passou a ter uma arquitetura clara, com responsabilidades separadas, melhor capacidade de manutenção e maior resistência a variações de dados e ambiente.

O uso de técnicas como mapeamento dinâmico de colunas, integração com WordPress e persistência de preferências mostra que a solução foi pensada para contexto real, não apenas para demonstração académica. Isso é especialmente importante em projetos que lidam com dados legados e utilização diária.

---

## 23. Trabalho futuro

Como evolução natural, o projeto poderá receber:

- relatórios exportáveis em PDF e Excel;
- auditoria de alterações por utilizador;
- maior granularidade de permissões;
- melhoria da pesquisa global;
- logs mais completos de sincronização;
- testes automatizados de integração;
- documentação de API com exemplos;
- dashboard inicial com métricas operacionais.

---

## 24. Anexos

### Anexo A - Estrutura do projeto

- `backend/` com API Express, sincronização e scripts de manutenção;
- `frontend/` com aplicação React, páginas e componentes;
- documentação auxiliar de setup, deployment e sincronização.

### Anexo B - Ficheiros de referência

- [frontend/src/App.js](frontend/src/App.js)
- [frontend/src/api.js](frontend/src/api.js)
- [frontend/src/pages/relatorios.js](frontend/src/pages/relatorios.js)
- [backend/server.js](backend/server.js)
- [backend/sync-service.js](backend/sync-service.js)
- [backend/package.json](backend/package.json)
- [frontend/package.json](frontend/package.json)

### Anexo C - Documentos existentes

- [ALTERACOES_IMPLEMENTADAS.md](ALTERACOES_IMPLEMENTADAS.md)
- [SETUP_LOCAL.md](SETUP_LOCAL.md)
- [SINCRONIZACAO_E_DEPLOY.md](SINCRONIZACAO_E_DEPLOY.md)
- [DEPLOY.md](DEPLOY.md)
- [SINCRONIZACAO_WORDPRESS.md](SINCRONIZACAO_WORDPRESS.md)
- [WEBHOOKS_WORDPRESS.md](WEBHOOKS_WORDPRESS.md)

---

## Nota final de formatação

Este documento foi preparado como base de relatório longo. Para ultrapassar 60 páginas em versão final, recomenda-se:

1. expandir cada capítulo com exemplos de implementação;
2. incluir capturas de ecrã da interface;
3. descrever cada página do frontend separadamente;
4. detalhar os endpoints da API com payloads e respostas;
5. acrescentar análise comparativa do estado da arte;
6. inserir cronologia de desenvolvimento e validações;
7. anexar tabelas de testes e resultados.
