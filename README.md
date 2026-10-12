# server-blackfrost

NestJS v12 + MongoDB API for BlackFrost Event Desk. See [AGENTS.md](AGENTS.md) for conventions.

```bash
cp .env.example .env   # needs MongoDB on 127.0.0.1:27017
yarn install
yarn start:dev         # http://localhost:3301/api-docs , GET /health
yarn test              # unit
yarn test:e2e          # e2e (in-memory MongoDB)
```
