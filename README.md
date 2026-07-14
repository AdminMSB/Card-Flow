# Conciliação de Cartão Corporativo

Sistema web que digitaliza o fluxo completo de despesas do cartão corporativo:

**Compra → Aprovação → Importação da fatura → Conciliação (automática + manual) → Relatório**

Substitui a conferência manual de fatura contra planilhas por setor, reduzindo retrabalho,
erros de digitação e o tempo de fechamento mensal.

## Stack

- **Next.js 14** (App Router) + **TypeScript** — front-end e back-end (Server Actions / Route
  Handlers) em um único projeto.
- **Supabase**: Postgres (banco relacional), Auth (login), Storage (comprovantes e arquivos de
  fatura). Autorização é aplicada via **Row Level Security** no Postgres, não apenas na
  aplicação.
- **Tailwind CSS** com componentes de UI próprios (sem dependência de biblioteca externa de
  componentes).
- Parsing de fatura: **CSV/XLSX** via `xlsx` (SheetJS), **OFX** via parser próprio, **PDF**
  (fatura digitalizada, ex.: Santander Empresas) via `pdfjs-dist`, extraindo transações pela
  posição do texto na página.
- Exportação de relatório: **Excel** via `exceljs`, **PDF** via `pdf-lib`.
- Testes: **Vitest** (algoritmo de conciliação e parsers de arquivo).
- Deploy: **Vercel** (aplicação) + **Supabase** (banco/auth/storage).

## Perfis de acesso

| Perfil | Pode fazer |
|---|---|
| `colaborador` | Cadastrar suas compras, acompanhar status |
| `gestor` | Tudo do colaborador + aprovar/rejeitar compras do seu setor + ver relatórios do setor |
| `financeiro` | Tudo + importar fatura, conciliar, exportar relatórios de todos os setores, configurações |
| `admin` | Tudo do financeiro + gerenciar usuários e papéis |

## Setup do projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **Project Settings → API**, copie a `Project URL`, a `anon public key` e a
   `service_role key`.
3. Copie `.env.local.example` para `.env.local` e preencha essas três variáveis.
4. Aplique as migrations (schema, funções, RLS e buckets de storage) — duas opções:
   - **Via Supabase CLI** (recomendado): `npx supabase login`, `npx supabase link --project-ref <seu-project-ref>`,
     depois `npx supabase db push`. Isso aplica tudo em `supabase/migrations/*.sql` em ordem.
   - **Via SQL Editor do painel Supabase**: cole o conteúdo de cada arquivo em
     `supabase/migrations/` na ordem numérica (0001, 0002, 0003, 0004) e execute.
5. (Opcional) Popule dados de exemplo (setores, centros de custo, categorias) executando
   `supabase/seed.sql` no SQL Editor.
6. Crie o primeiro usuário **admin**: no painel Supabase, vá em **Authentication → Users → Add
   user**, marque "Auto Confirm User", e em **User Metadata** (JSON) informe:
   ```json
   { "full_name": "Seu Nome", "role": "admin" }
   ```
   O trigger `handle_new_user` cria automaticamente a linha em `profiles` com esse papel. Os
   demais usuários podem ser convidados depois pela própria tela **Configurações → Usuários**
   (usa a Auth Admin API com a `service_role key`).
7. Nos buckets de Storage (`receipts` e `invoices`, criados pela migration `0004_storage.sql`),
   nada mais precisa ser feito manualmente — as políticas de acesso já são aplicadas via SQL.

## Rodando localmente

Requer **Node.js 18.18+** (não incluso neste ambiente — instale antes de continuar).

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Rode os testes com:

```bash
npm run test
```

## Deploy

1. Suba o repositório para o GitHub/GitLab.
2. No [Vercel](https://vercel.com), importe o repositório.
3. Configure as variáveis de ambiente do projeto (mesmas do `.env.local`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (esta última marcada como *sensitive*/secret).
4. Deploy. Não é necessário nenhum build step além do padrão do Next.js (`next build`).
5. No painel do Supabase, em **Authentication → URL Configuration**, adicione a URL de produção
   da Vercel em *Site URL* e *Redirect URLs*.

## Estrutura do projeto

```
app/
  (auth)/login/              — tela de login
  (app)/dashboard/           — indicadores por perfil
  (app)/compras/             — cadastro de compras + comprovante
  (app)/aprovacoes/          — aprovação/rejeição pelo gestor
  (app)/faturas/             — upload da fatura, mapeamento de colunas, conciliação
  (app)/relatorios/          — filtros e exportação (Excel/PDF)
  (app)/configuracoes/       — setores, centros de custo, categorias, cartões, usuários
  api/relatorios/export/     — Route Handler que gera o arquivo de exportação
lib/
  supabase/                  — clients Supabase (server, browser, admin)
  matching/                  — algoritmo de conciliação (testável isoladamente)
  parsers/                   — CSV/XLSX/OFX/PDF → formato normalizado
  auth.ts, format.ts, utils.ts
components/
  ui/                        — componentes de interface reutilizáveis
supabase/
  migrations/                — schema SQL, funções, RLS, storage (versionado)
  seed.sql                   — dados de exemplo
tests/                       — Vitest (matching + parsers)
```

## Fluxo de conciliação (resumo)

1. **Compra**: colaborador registra a compra com comprovante; fica `pending`.
2. **Aprovação**: gestor do setor aprova (`approved`) ou rejeita (`rejected`) com observação.
3. **Importação da fatura**: financeiro sobe o arquivo (CSV/XLSX/OFX/PDF) da operadora; o sistema
   detecta o layout e mostra uma tela de confirmação de mapeamento de colunas (data/valor/
   descrição) antes de gerar os itens da fatura.
4. **Conciliação automática**: o sistema sugere pares fatura↔compra por valor, data e
   similaridade do nome do estabelecimento — mas **nada é fechado sem confirmação humana** na
   tela de conciliação.
5. **Conciliação manual**: itens sem sugestão automática (ou com sugestão rejeitada) são
   conciliados manualmente, ou marcados como disputa.
6. **Relatório**: financeiro/gestor filtram por período/setor/centro de custo/status e exportam
   em Excel ou PDF.

## Limitações conhecidas / próximos passos

- Não há testes end-to-end (E2E) automatizados — a validação da interface deve ser feita
  manualmente contra um projeto Supabase de desenvolvimento.
- O parser de OFX cobre o formato mais comum de extrato de cartão (`STMTTRN`); variações muito
  específicas de operadora podem exigir ajuste em `lib/parsers/ofx.ts`.
- O parser de PDF (`lib/parsers/pdf.ts`) foi calibrado com o layout real da fatura mensal
  "Empresas Mastercard Platinum" do Santander (posição do texto na página: data, descrição,
  local e valor em R$). Fatura de outra operadora/bandeira com layout diferente pode não ser
  reconhecida — nesse caso, ajuste as constantes de posição (`*_COLUMN_X`) no arquivo, ou
  utilize CSV/XLSX/OFX como alternativa se a operadora oferecer esses formatos de exportação.
  Linhas de pagamento, estorno, IOF, anuidade e outras tarifas são deliberadamente ignoradas
  (só compras de estabelecimento entram na conciliação).
- Não há notificação por e-mail em aprovações/rejeições — pode ser adicionado via Supabase Edge
  Functions + webhook de banco, se necessário.
