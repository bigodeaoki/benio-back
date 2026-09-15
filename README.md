# Scientia Industrial

Sistema de **custos de produção industrial** com precificação tributária brasileira, estoque, MRP/PCP, NF-e (homologação), dashboards e exportações — multiempresa e multiusuário.

| Camada | Tecnologia | Pasta |
|---|---|---|
| Frontend | React 18 + Vite (nginx em produção) | `frontend/` |
| Backend | NestJS 10 + TypeScript | `backend/` |
| Banco | MySQL 8 (schema + carga inicial) | `mysql/` |

## Subir com Docker

```bash
docker compose up -d --build
```

- **App:** http://localhost:8080
- **API:** http://localhost:4000/api
- **MySQL:** localhost:3307 (usuário `benio` / senha `benio123`, banco `benio`)

**Login inicial:** `admin@scientia.com` / `admin123` (criado automaticamente na primeira subida).

O banco é criado e populado com dados de demonstração (2 empresas, fórmulas, linhas, pedidos) na primeira subida. Para recomeçar do zero: `docker compose down -v && docker compose up -d --build`.

## Abas

**Operação**

1. **Pedidos** — itens, quantidades, preços e data de entrega; consulta de CNPJ na Receita (BrasilAPI); geração de ordens de produção; PDF do pedido.
2. **Produção (MRP/PCP)** — ordens de produção com fórmula editável por ordem, MRP com sugestão de compras e ocupação de capacidade, consumo FIFO de matéria-prima ao concluir e remessa criada automaticamente.
3. **Custos & Impostos** — custo = fórmula + mão de obra + processo + envase + manutenção (por lote, unidade e kg); impostos conforme regime (ICMS/PIS/COFINS/IPI ou DAS); formação de preço com margem; **simulação tributária por UF**.

**Gestão:** Fórmulas (produtos, fórmulas por lote, NCM, linha de processo, horas por lote e % de manutenção) · Linhas de Processo (equipamentos, funcionários com % de dedicação e busca com autocompletar, consumos de utilidade por hora trabalhada, produção por hora e etapas de envase) · Matérias-primas (lotes de compra com consumo FIFO) · Utilidades (energia, gás, óleo de caldeira, água) · Envase (etapas de envase por hora: funcionários, equipamentos pela energia, matérias-primas consumidas e rendimento — o total entra na linha e no custo do produto) · Estoque (movimentos, mínimos, alertas) · Controle de Envio (remessas por ordem de produção) · Notas Fiscais (chave de acesso + XML 4.00 em homologação) · Documentos (controle de documentos).

**Sistema:** Empresas e filiais · Usuários (papéis e importação em lote) · Configurações (NCM/IPI, ICMS por UF). **Dashboards** com BI de custos, rendimento das linhas e financeiro.

**Exportações:** Excel (custos, pedidos, estoque) e PDF (relatório de custo, pedido).

## Regras de cálculo

- **Funcionário (usuário):** custo mensal = salário × (1 + encargos%) + VT + VA + outros; custo-hora = custo mensal ÷ horas/mês.
- **Fórmula:** custo do item = quantidade ÷ rendimento da MP × preço; o total é dividido pelo rendimento da linha.
- **Processo:** Σ (consumo/h × custo da utilidade) × horas do lote; **mão de obra:** Σ (custo-hora × dedicação%) × horas.
- **Manutenção:** % extra sobre (fórmula + MO + processo). Custo unitário = custo do lote ÷ tamanho do lote.
- **Preço:** `preço = custo ÷ (1 − (impostos_por_dentro% + margem%))`; IPI soma "por fora". Regimes: Simples (DAS efetivo), Presumido (PIS 0,65 / COFINS 3,00), Real (PIS 1,65 / COFINS 7,60); ICMS interno por UF ou interestadual 7/12% (Res. SF 22/1989).
- Simplificações documentadas: sem ST, DIFAL, FCP ou benefícios estaduais — valide com sua contabilidade.

## NF-e — do modo homologação para emissão real

O sistema gera numeração, chave de acesso (dígito mod-11) e XML no layout 4.00. Para transmitir à SEFAZ é necessário:

1. Certificado digital A1 (arquivo .pfx) ou A3 da empresa emitente;
2. Credenciamento como emissor de NF-e na SEFAZ do estado;
3. Assinatura e transmissão do XML — em Node, bibliotecas como `node-dfe` ou serviços como FocusNFe/eNotas fazem assinatura, envio, DANFE e contingência;
4. Guarda dos XMLs autorizados por 5 anos.

## Desenvolvimento local (sem Docker para o app)

```bash
docker compose up -d mysql          # apenas o banco
cd backend && npm install && DB_PORT=3307 npm run build && DB_PORT=3307 npm start
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxy /api → :4000)
```

## Estrutura

```
benio/
├── docker-compose.yml       # mysql + backend + frontend
├── mysql/init/              # 01-schema.sql, 02-seed.sql (executados na 1ª subida)
├── backend/src/
│   ├── auth/                # JWT, papéis (admin, produção, qualidade, compras, vendas, administrativo, financeiro, operador), empresa ativa
│   ├── custos/              # motor de custos, impostos e simulação por UF
│   ├── nfe/                 # chave de acesso + XML layout 4.00
│   ├── producao/            # ordens (PCP) + MRP
│   ├── export/              # Excel (exceljs) e PDF (pdfkit)
│   ├── integracao/          # BrasilAPI: CNPJ (Receita) e NCM
│   └── ...                  # pedidos, produtos, linhas, usuários, utilidades, estoque, dashboards, fiscal
└── frontend/src/pages/      # uma página por aba
```
