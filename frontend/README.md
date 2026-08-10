# Frontend — SkySpire End

React + TypeScript (Vite). Roda **fora** do Docker.

## Setup

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:8080
npm install
npm run dev
```

App: http://localhost:5173  
API (Docker): http://localhost:8080/health

## Estrutura

```text
src/
  api/         # client tipado
  components/  # UI reutilizável
  pages/       # rotas
  styles/      # CSS global
  types/       # tipos compartilhados
ui-assets/     # arte / placeholders de UI
```

Assets em `ui-assets/` são referência visual; a home final entra no todo 05.
