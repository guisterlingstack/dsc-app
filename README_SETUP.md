# Dinheiro Sob Controle — Setup

## Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Conta no [Cloudflare Pages](https://pages.cloudflare.com) (deploy)

---

## 1. Configurar o Supabase

### 1.1 Criar o projeto
1. Acesse https://supabase.com e faça login
2. Clique em **New Project**
3. Preencha: nome `dinheiro-sob-controle`, região **South America (São Paulo)**
4. Aguarde 1-2 minutos

### 1.2 Criar as tabelas
1. No painel, vá em **SQL Editor** → **New query**
2. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql`
3. Clique em **Run**

### 1.3 Coletar credenciais
1. Vá em **Project Settings** → **API**
2. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

---

## 2. Configurar o projeto local

```bash
# Clone e instale dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Supabase

# Rode localmente
npm run dev
```

---

## 3. Deploy no Cloudflare Pages

1. Faça push do código para um repositório GitHub
2. No Cloudflare Pages, crie um novo projeto conectado ao repositório
3. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Build command: `npm run build`
5. Output directory: `dist`

---

## 4. Configurar webhook Eduzz

### 4.1 Deploy da Edge Function
```bash
# Instale a CLI do Supabase
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref SEU_PROJECT_REF

# Deploy da função
supabase functions deploy eduzz-webhook
```

### 4.2 Configurar no painel Eduzz
1. Acesse sua conta Eduzz → Configurações → Webhooks
2. Adicione a URL:
   ```
   https://[seu-projeto].supabase.co/functions/v1/eduzz-webhook
   ```
3. Selecione eventos: **Venda Aprovada**, **Reembolso**, **Chargeback**
4. Salve e teste

---

## 5. Criar primeiro usuário admin

Após o primeiro cadastro no sistema, execute no SQL Editor do Supabase:

```sql
UPDATE profiles
SET role = 'admin',
    status_conta = 'ativa',
    has_main_mentorship = true
WHERE email = 'seu@email.com';
```

---

## Estrutura do projeto

```
src/
├── api/
│   └── supabaseApi.js      ← Substitui o @base44/sdk
├── lib/
│   ├── supabaseClient.js   ← Instância do Supabase
│   ├── AuthContext.jsx     ← Autenticação com Supabase Auth
│   ├── query-client.js
│   └── utils.js
├── components/
│   ├── AccessControl.jsx
│   ├── admin/
│   ├── budget/
│   ├── dashboard/
│   └── ui/
├── pages/
│   ├── Login.jsx
│   ├── Cadastro.jsx
│   ├── Onboarding.jsx      ← 4 passos de configuração inicial
│   ├── MonthlyClosing.jsx  ← Fechamento mensal
│   ├── Dashboard.jsx
│   ├── WeeklyRoutine.jsx   ← Semáforo semanal
│   └── ... demais páginas
├── App.jsx
├── Layout.jsx              ← Mobile-first (bottom nav + sidebar desktop)
└── pages.config.js

supabase/
├── migrations/
│   └── 001_initial_schema.sql
└── functions/
    └── eduzz-webhook/
        └── index.ts
```

---

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon pública do Supabase |

---

## Funcionalidades implementadas

- ✅ Autenticação com Supabase Auth (login, cadastro, logout)
- ✅ Verificação de email autorizado (clientes_autorizados)
- ✅ Onboarding obrigatório em 4 passos
- ✅ Fórmula personalizada gerada no onboarding (sem defaults hardcoded)
- ✅ Semáforo semanal calculado (verde/amarelo/vermelho)
- ✅ Prazo da reserva calculado dinamicamente
- ✅ Painel admin enriquecido (fórmula, mês do plano, semáforo, vencimento)
- ✅ Fechamento mensal automático no dia 1
- ✅ Webhook Eduzz (aprovação/reembolso/chargeback)
- ✅ Layout mobile-first com bottom navigation
- ✅ Linguagem padronizada com a metodologia
