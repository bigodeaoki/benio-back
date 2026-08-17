# Grimorium Industrial

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

**Login inicial:** `admin@grimorium.com` / `admin123` (criado automaticamente na primeira subida).

O banco é criado e populado com dados de demonstração (2 empresas, fórmulas, linhas, pedidos) na primeira subida. Para recomeçar do zero: `docker compose down -v && docker compose up -d --build`.

## Abas

1. **Pedidos** — itens, quantidades, preços e data de entrega; consulta de CNPJ na Receita (BrasilAPI); geração de ordens de produção; PDF do pedido.
2. **Fórmulas** — matérias-primas (preço e rendimento %), fórmulas por lote, NCM (busca local + BrasilAPI), linha de processo (rendimento herdado e ajustável), horas por lote e % extra de manutenção.
3. **Linhas de Processo** — equipamentos, colaboradores participantes (com % de dedicação), consumos de utilidade por hora trabalhada e produção por hora.
4. **Colaboradores** — cargos, salário total com encargos/benefícios (INSS, FGTS, provisões, VT, VA) e salário por hora.
5. **Utilidades** — conta de energia e custo do kWh, gás, preço do litro do óleo de caldeira, água etc.
6. **Custos & Impostos** — custo = fórmula + mão de obra + processo + manutenção (por lote, unidade e kg); impostos conforme regime (ICMS/PIS/COFINS/IPI ou DAS); formação de preço com margem; **simulação tributária por UF**.

**Gestão:** Estoque (movimentos, mínimos, alertas) · Produção (ordens PCP + MRP com sugestão de compras e ocupação de capacidade) · Notas Fiscais (chave de acesso + XML 4.00 em homologação) · Dashboards (BI de custos e financeiro) · Configurações (empresas, usuários, NCM/IPI, ICMS por UF).

**Exportações:** Excel (custos, pedidos, estoque, colaboradores) e PDF (relatório de custo, pedido).

## Regras de cálculo

- **Colaborador:** custo mensal = salário × (1 + encargos%) + VT + VA + outros; custo-hora = custo mensal ÷ horas/mês.
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
│   ├── auth/                # JWT, papéis (admin/gestor/operador), empresa ativa
│   ├── custos/              # motor de custos, impostos e simulação por UF
│   ├── nfe/                 # chave de acesso + XML layout 4.00
│   ├── producao/            # ordens (PCP) + MRP
│   ├── export/              # Excel (exceljs) e PDF (pdfkit)
│   ├── integracao/          # BrasilAPI: CNPJ (Receita) e NCM
│   └── ...                  # pedidos, produtos, linhas, colaboradores, utilidades, estoque, dashboards, fiscal
└── frontend/src/pages/      # uma página por aba
```
