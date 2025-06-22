# MarlimPay API

## Visão Geral do Projeto

MarlimPay é uma API backend desenvolvida para simular um sistema de processamento de pagamentos. Ela oferece funcionalidades para gerenciamento de usuários, controle de transações financeiras e processamento assíncrono de notificações de pagamento via webhooks. O sistema foca na idempotência para criação de transações e controle de limite de requisições (rate limiting) para garantir uso justo.

Este projeto é construído como uma aplicação serverless usando Firebase (Cloud Functions, Firestore e Hosting) e é escrito em Node.js com TypeScript.

## Tecnologias Utilizadas

- **Backend:** Node.js, Express.js
- **Linguagem:** TypeScript
- **Plataforma Serverless:** Firebase Cloud Functions
- **Banco de Dados:** Firestore (NoSQL)
- **Hospedagem:** Firebase Hosting (para documentação da API)
- **Testes:** Jest (Testes Unitários)

## Funcionalidades

- **Gerenciamento de Usuários:** Criação, recuperação e atualização de informações de usuários (nome, email).
- **Processamento de Transações:**
  - Criação de novas transações financeiras entre usuários.
  - Consulta de detalhes de uma transação específica.
  - Listagem de transações enviadas e recebidas por um usuário.
- **Idempotência:** O endpoint `POST /transactions` aceita o cabeçalho `Idempotency-Key` para evitar processamento duplicado de transações.
- **Rate Limiting:** Limitação de até 5 requisições por minuto por usuário para criação de transações (Atualmente em todos endpoint).
- **Processamento de Webhooks:** Recebe notificações assíncronas de status de pagamento do gateway via endpoint `POST /webhook/payment-gateway`, atualizando status das transações e saldos dos usuários (ex.: crédito para aprovado, estorno para falhado).
- **Operações Atômicas:** Uso de transações e batch writes do Firestore para garantir atomicidade na criação de transações e atualização de saldos.

## Estrutura do Projeto (diretório `functions/src`)

- `index.ts`: Ponto de entrada principal, inicializa Firebase e configura rotas.
- `models.ts`: Interfaces TypeScript principais (ex.: `User`, `Transaction`).
- `errors.ts`: Classes de erro personalizadas usadas no projeto.
- `middleware/`: Middlewares Express (ex.: autenticação, tratamento de erros).
- `users/`: Módulo de usuários (rotas, handlers, serviços, repositórios).
- `transactions/`: Módulo de transações (rotas, handlers, serviços, repositórios).
- `webhooks/`: Módulo de webhooks (rotas, handlers, repositórios para logs).

## Configuração Local

### Pré-requisitos

- **Node.js:** Versão 20+ recomendada.
- **Firebase CLI:** Instalar ou atualizar via `npm install -g firebase-tools`.

### Passos para rodar localmente

## 1. **Clone o repositório e acesse a pasta do projeto**

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
```

### 2. **Instale as dependências**

No diretório raiz do projeto:

```bash
npm install
```

### 3. **Configure o Firebase**

Se ainda não tiver feito login com sua conta Firebase:

```bash
firebase login
```

Depois, vincule o projeto local a um projeto do Firebase da sua conta:

```bash
firebase use --add
```

> Isso permite selecionar um projeto existente do Firebase para associar ao seu `.firebaserc`.

### 4. **Inicie os emuladores**

Para iniciar os emuladores locais com as configurações existentes:

```bash
npm run serve
```

> Esse comando já deve usar o `firebase emulators:start` configurado no `package.json`.


### URLs locais importantes

- API principal (exemplo):
  ```
  http://localhost:5001/<seu-projeto-firebase>/us-central1/api
  ```
- Interface do Swagger (documentação da API):
  ```
  http://localhost:5002/swagger/
  ```

## Como usar a API

## Autenticação

Todos os endpoints exigem um token Bearer no cabeçalho `Authorization` (Exceto de criar usuario).

Para gerar o token JWT de autenticação, siga os passos abaixo:

1. Acesse [jwt.io](https://jwt.io/).
2. No payload (parte do meio), insira o JSON com o `userId` gerado pela API, por exemplo:

```json
{
  "userId": "id_do_usuario_gerado"
}
```

3. No campo de **Sign JWT: Secret** (abaixo do payload), informe a chave de criptografia:

```
supersegura_supersegura_supersegura_123
```

4. Copie o token gerado no topo (campo **Encoded**).
5. Use este token no cabeçalho das requisições:

```
Authorization: Bearer <token_gerado>
```

---


## Endpoints da API

| Método | Endpoint                                   | Descrição                                    |
|--------|--------------------------------------------|----------------------------------------------|
| POST   | `/api/v1/users`                           | Criar novo usuário                           |
| GET    | `/api/v1/users`                           | Listar todos os usuários                     |
| GET    | `/api/v1/users/:id`                       | Obter usuário pelo ID                        |
| PUT    | `/api/v1/users/:id`                       | Atualizar nome e email do usuário            |
| GET    | `/api/v1/users/:user_id/transactions`    | Listar transações do usuário                  |
| POST   | `/api/v1/transactions`                    | Criar nova transação (idempotência via header `Idempotency-Key`) |
| GET    | `/api/v1/transactions/:id`                | Obter transação pelo ID                       |
| POST   | `/webhook/payment-gateway`                | Receber notificações de webhook do gateway  |
| GET    | `/webhook/payment-gateway/logs/:id`      | Consultar log de webhook pelo ID             |

---

## Modelos (Schemas) principais

- **User**: usuário com `user_id`, `name`, `email`, `balance` etc.
- **Transaction**: transação com `transaction_id`, `payer_id`, `receiver_id`, `amount`, `status`.
- **WebhookPaymentGatewayRequest**: payload do webhook com `transaction_id` e `status`.
- **WebhookLogResponse**: log de webhook com payload, timestamps e status de processamento.

---
## Decisões Técnicas Importantes

- **Idempotência:** Garantir que múltiplas requisições iguais criem uma única transação.  
  A idempotência é controlada via header `Idempotency-Key`, que deve conter um **UUID v4** gerado pelo cliente.  
  Caso o mesmo valor seja reutilizado, a API retornará a mesma resposta da primeira requisição processada com sucesso.
- **Rate Limiting:** Limitar a frequência de criação de transações por usuário.
- **Operações Atômicas:** Usar transações Firestore para garantir consistência ao atualizar saldo e transação.
- **Arquitetura serverless:** Uso do Firebase Cloud Functions para escalabilidade automática.

---

Para dúvidas, sugestões ou contribuições, entre em contato!

---

*Swagger UI disponível em:*  (Todos os testes da aplicação pode ser realizado aqui)
```
http://localhost:5002/swagger/
```
---
