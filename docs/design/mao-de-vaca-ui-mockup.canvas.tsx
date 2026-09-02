/**
 * Mockup interativo de UI — Mão de Vaca
 *
 * Fonte versionada em docs/design/. Para visualizar no Cursor, use a cópia
 * interativa em ~/.cursor/projects/.../canvases/mao-de-vaca-ui-mockup.canvas.tsx.
 *
 * Especificação escrita: docs/design/UI_REFERENCE.md
 */
import type { ReactNode } from "react";
import {
  BarChart,
  Button,
  Card,
  CardBody,
  Divider,
  Grid,
  H2,
  H3,
  Pill,
  Row,
  Select,
  Spacer,
  Stack,
  Stat,
  Text,
  TextInput,
  UsageBar,
  mergeStyle,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type Screen =
  | "login"
  | "onboarding"
  | "dashboard"
  | "lancamentos"
  | "importar"
  | "contas"
  | "cartoes"
  | "relatorios";

const SCREENS: { id: Screen; label: string }[] = [
  { id: "login", label: "Login" },
  { id: "onboarding", label: "Onboarding" },
  { id: "dashboard", label: "Visão geral" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "importar", label: "Importar" },
  { id: "contas", label: "Contas" },
  { id: "cartoes", label: "Cartões" },
  { id: "relatorios", label: "Relatórios" },
];

const NAV_ITEMS: { id: Screen; label: string }[] = [
  { id: "dashboard", label: "Visão geral" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "importar", label: "Importar" },
  { id: "contas", label: "Contas" },
  { id: "cartoes", label: "Cartões" },
  { id: "relatorios", label: "Relatórios" },
];

const RECENT_TX = [
  { desc: "iFood", cat: "Alimentação", value: "- R$ 42,90", date: "02 set" },
  { desc: "Uber", cat: "Transporte", value: "- R$ 18,50", date: "01 set" },
  { desc: "Salário", cat: "Receita", value: "+ R$ 8.200", date: "01 set" },
];

const CATEGORY_SEGMENTS = [
  { id: "alim", value: 1240, color: "green" as const },
  { id: "mor", value: 2100, color: "blue" as const },
  { id: "trans", value: 380, color: "purple" as const },
  { id: "lazer", value: 520, color: "orange" as const },
];

const CATEGORY_LABELS = [
  { name: "Moradia", amount: "R$ 2.100", pct: "52%" },
  { name: "Alimentação", amount: "R$ 1.240", pct: "31%" },
  { name: "Lazer", amount: "R$ 520", pct: "13%" },
];

const ACCOUNTS = [
  { label: "Nubank CC", bank: "Nubank" },
  { label: "Conta corrente", bank: "Itaú" },
];

type InvoiceStatus = "aberta" | "parcial" | "quitada";

type Invoice = {
  id: string;
  cardId: string;
  ref: string;
  due: string;
  total: string;
  balance: string;
  status: InvoiceStatus;
  items: { desc: string; value: string; date: string }[];
};

const CARDS = [
  { id: "visa-nubank", label: "Visa Nubank", bank: "Nubank" },
  { id: "master-inter", label: "Master Inter", bank: "Inter" },
];

const INVOICES: Invoice[] = [
  {
    id: "set-2026",
    cardId: "visa-nubank",
    ref: "Set/2026",
    due: "10 out",
    total: "R$ 1.842",
    balance: "R$ 1.842",
    status: "aberta",
    items: [
      { desc: "Amazon", value: "R$ 189,90", date: "28 ago" },
      { desc: "iFood", value: "R$ 42,90", date: "02 set" },
      { desc: "Uber", value: "R$ 18,50", date: "01 set" },
    ],
  },
  {
    id: "ago-2026",
    cardId: "visa-nubank",
    ref: "Ago/2026",
    due: "10 set",
    total: "R$ 2.105",
    balance: "R$ 800",
    status: "parcial",
    items: [
      { desc: "Mercado Livre", value: "R$ 320,00", date: "15 ago" },
      { desc: "Netflix", value: "R$ 55,90", date: "12 ago" },
    ],
  },
  {
    id: "jul-2026",
    cardId: "visa-nubank",
    ref: "Jul/2026",
    due: "10 ago",
    total: "R$ 1.950",
    balance: "R$ 0",
    status: "quitada",
    items: [
      { desc: "Posto Shell", value: "R$ 280,00", date: "20 jul" },
      { desc: "Farmácia", value: "R$ 67,30", date: "18 jul" },
    ],
  },
  {
    id: "set-2026-inter",
    cardId: "master-inter",
    ref: "Set/2026",
    due: "15 out",
    total: "R$ 640",
    balance: "R$ 640",
    status: "aberta",
    items: [
      { desc: "Spotify", value: "R$ 21,90", date: "28 ago" },
      { desc: "iFood", value: "R$ 38,50", date: "30 ago" },
    ],
  },
];

function invoiceStatusLabel(status: InvoiceStatus): string {
  if (status === "aberta") return "Aberta";
  if (status === "parcial") return "Parcial";
  return "Quitada";
}

function invoiceStatusTone(
  status: InvoiceStatus,
): "info" | "warning" | "success" {
  if (status === "aberta") return "info";
  if (status === "parcial") return "warning";
  return "success";
}

function DesignPrinciples() {
  return (
    <Stack gap={6}>
      <H2>Mockup — Mão de Vaca</H2>
      <Text tone="secondary">
        Layout calmo, uma ideia por tela, navegação lateral fixa. Paleta quente,
        acento verde, tipografia generosa e poucos números por vez. Use os
        chips abaixo para alternar telas.
      </Text>
      <Text size="small" tone="tertiary">
        Princípios: hierarquia clara · regime competência/caixa sempre visível ·
        ações secundárias discretas · listas curtas com “ver tudo”
      </Text>
    </Stack>
  );
}

function ScreenPicker({
  screen,
  onChange,
}: {
  screen: Screen;
  onChange: (next: Screen) => void;
}) {
  return (
    <Row gap={6} wrap>
      {SCREENS.map((item) => (
        <Pill
          active={screen === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </Pill>
      ))}
    </Row>
  );
}

function RegimeToggle({
  regime,
  onChange,
}: {
  regime: "competence" | "cash";
  onChange: (next: "competence" | "cash") => void;
}) {
  return (
    <Row gap={4}>
      <Pill
        active={regime === "competence"}
        onClick={() => onChange("competence")}
        size="sm"
      >
        Competência
      </Pill>
      <Pill
        active={regime === "cash"}
        onClick={() => onChange("cash")}
        size="sm"
      >
        Caixa
      </Pill>
    </Row>
  );
}

function Sidebar({
  active,
  children,
}: {
  active: Screen;
  children?: ReactNode;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        minHeight: 560,
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${theme.stroke.secondary}`,
      }}
    >
      <aside
        style={{
          background: theme.bg.elevated,
          borderRight: `1px solid ${theme.stroke.secondary}`,
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <Text
          weight="semibold"
          style={{ padding: "4px 10px 16px", fontSize: 15 }}
        >
          Mão de Vaca
        </Text>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <div
              key={item.id}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: isActive ? theme.fill.tertiary : "transparent",
                color: isActive ? theme.text.primary : theme.text.secondary,
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
              }}
            >
              {item.label}
            </div>
          );
        })}
        <Spacer />
        <div style={{ padding: "8px 10px" }}>
          <Button variant="ghost" style={{ width: "100%" }}>
            Sair
          </Button>
        </div>
      </aside>
      <main
        style={{
          background: theme.fill.quaternary,
          padding: "28px 32px",
          overflow: "auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <Row align="center" justify="space-between" style={{ marginBottom: 28 }}>
      <Stack gap={4}>
        <H2 style={{ margin: 0 }}>{title}</H2>
        {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
      </Stack>
      {trailing}
    </Row>
  );
}

function LoginMock() {
  const theme = useHostTheme();
  return (
    <div
      style={{
        background: theme.fill.quaternary,
        minHeight: 520,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        border: `1px solid ${theme.stroke.secondary}`,
      }}
    >
      <Stack gap={24} style={{ width: "100%", maxWidth: 360, padding: 24 }}>
        <Stack gap={6} style={{ textAlign: "center" }}>
          <Text weight="semibold" style={{ fontSize: 22 }}>
            Mão de Vaca
          </Text>
          <Text tone="secondary" size="small">
            Seu controle financeiro pessoal
          </Text>
        </Stack>
        <Card>
          <CardBody>
            <Stack gap={16}>
              <Stack gap={6}>
                <Text weight="medium" size="small">
                  Usuário
                </Text>
                <TextInput value="mao" onChange={() => undefined} />
              </Stack>
              <Stack gap={6}>
                <Text weight="medium" size="small">
                  Senha
                </Text>
                <TextInput
                  type="password"
                  value="••••••••"
                  onChange={() => undefined}
                />
              </Stack>
              <Button variant="primary">Entrar</Button>
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    </div>
  );
}

function OnboardingMock() {
  return (
    <Sidebar active="dashboard">
      <div style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
        <Stack gap={24}>
          <Stack gap={8}>
            <Text weight="semibold" style={{ fontSize: 20 }}>
              Vamos começar
            </Text>
            <Text tone="secondary">
              Cadastre uma conta ou cartão para importar seus extratos. Você
              pode fazer isso depois.
            </Text>
          </Stack>
          <Stack gap={10}>
            <Button variant="primary">Cadastrar conta</Button>
            <Button variant="secondary">Cadastrar cartão</Button>
            <Button variant="ghost">Pular por agora</Button>
          </Stack>
        </Stack>
      </div>
    </Sidebar>
  );
}

function DashboardMock() {
  const [regime, setRegime] = useCanvasState<"competence" | "cash">(
    "dashboard-regime",
    "competence",
  );
  const theme = useHostTheme();
  const heroValue = regime === "competence" ? "R$ 4.240" : "R$ 3.180";
  const heroLabel =
    regime === "competence"
      ? "Gastos em setembro · competência"
      : "Saídas em setembro · caixa";

  return (
    <Sidebar active="dashboard">
      <PageHeader
        title="Setembro 2026"
        subtitle="Resumo do mês"
        trailing={<RegimeToggle regime={regime} onChange={setRegime} />}
      />

      <Stack gap={32}>
        <div>
          <Text
            style={{
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {heroValue}
          </Text>
          <Text tone="secondary" size="small" style={{ marginTop: 6 }}>
            {heroLabel}
          </Text>
        </div>

        <Stack gap={12}>
          <Row align="center" justify="space-between">
            <H3 style={{ margin: 0, fontSize: 14 }}>Por categoria</H3>
            <Text size="small" tone="tertiary">
              top 3
            </Text>
          </Row>
          <UsageBar
            total={4240}
            segments={CATEGORY_SEGMENTS}
            topLeftLabel="R$ 4.240 gastos"
          />
          <Stack gap={8}>
            {CATEGORY_LABELS.map((cat) => (
              <Row align="center" justify="space-between">
                <Text size="small">{cat.name}</Text>
                <Row gap={12}>
                  <Text size="small" tone="secondary">
                    {cat.pct}
                  </Text>
                  <Text size="small" weight="medium">
                    {cat.amount}
                  </Text>
                </Row>
              </Row>
            ))}
          </Stack>
        </Stack>

        <Stack gap={12}>
          <Row align="center" justify="space-between">
            <H3 style={{ margin: 0, fontSize: 14 }}>Recentes</H3>
            <Button variant="ghost">Ver todos</Button>
          </Row>
          <Stack gap={0}>
            {RECENT_TX.map((tx, i) => (
              <div key={tx.desc}>
                {i > 0 ? <Divider /> : null}
                <Row
                  align="center"
                  justify="space-between"
                  style={{ padding: "12px 0" }}
                >
                  <Stack gap={2}>
                    <Text weight="medium" size="small">
                      {tx.desc}
                    </Text>
                    <Text size="small" tone="tertiary">
                      {tx.cat} · {tx.date}
                    </Text>
                  </Stack>
                  <Text
                    size="small"
                    weight="semibold"
                    style={{
                      color: tx.value.startsWith("+")
                        ? theme.text.primary
                        : theme.text.secondary,
                    }}
                  >
                    {tx.value}
                  </Text>
                </Row>
              </div>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Sidebar>
  );
}

function LancamentosMock() {
  const [regime, setRegime] = useCanvasState<"competence" | "cash">(
    "lanc-regime",
    "competence",
  );

  return (
    <Sidebar active="lancamentos">
      <PageHeader
        title="Lançamentos"
        trailing={<RegimeToggle regime={regime} onChange={setRegime} />}
      />

      <Stack gap={16}>
        <Row gap={8}>
          <TextInput
            placeholder="Buscar descrição…"
            onChange={() => undefined}
            style={{ flex: 1, maxWidth: 280 }}
          />
          <Select
            value="set-2026"
            options={[
              { value: "set-2026", label: "Setembro 2026" },
              { value: "ago-2026", label: "Agosto 2026" },
            ]}
            onChange={() => undefined}
          />
        </Row>

        <Stack gap={0}>
          {[
            ...RECENT_TX,
            {
              desc: "Spotify",
              cat: "Assinaturas",
              value: "- R$ 21,90",
              date: "28 ago",
            },
            {
              desc: "Farmácia",
              cat: "Saúde",
              value: "- R$ 67,30",
              date: "27 ago",
            },
          ].map((tx, i) => (
            <div key={`${tx.desc}-${i}`}>
              {i > 0 ? <Divider /> : null}
              <Row
                align="center"
                justify="space-between"
                style={{ padding: "14px 0" }}
              >
                <Stack gap={2}>
                  <Text weight="medium">{tx.desc}</Text>
                  <Text size="small" tone="tertiary">
                    {tx.cat} · {tx.date}
                  </Text>
                </Stack>
                <Text weight="semibold" tone="secondary">
                  {tx.value}
                </Text>
              </Row>
            </div>
          ))}
        </Stack>
      </Stack>
    </Sidebar>
  );
}

function ImportarMock() {
  const theme = useHostTheme();
  return (
    <Sidebar active="importar">
      <PageHeader
        title="Importar"
        subtitle="Envie um CSV do seu banco ou cartão"
      />

      <div style={{ maxWidth: 440 }}>
        <Stack gap={20}>
          <Stack gap={8}>
            <Text weight="medium" size="small">
              Tipo
            </Text>
            <Row gap={6}>
              <Pill active>Extrato de conta</Pill>
              <Pill>Fatura de cartão</Pill>
            </Row>
          </Stack>

          <Stack gap={8}>
            <Text weight="medium" size="small">
              Origem
            </Text>
            <Select
              value="nubank-cc"
              options={[
                { value: "nubank-cc", label: "Nubank CC" },
                { value: "itau", label: "Conta corrente · Itaú" },
              ]}
              onChange={() => undefined}
            />
          </Stack>

          <div
            style={{
              border: `1.5px dashed ${theme.stroke.secondary}`,
              borderRadius: 10,
              padding: "32px 20px",
              textAlign: "center",
            }}
          >
            <Stack gap={8}>
              <Text weight="medium">Arraste o CSV aqui</Text>
              <Text size="small" tone="secondary">
                ou clique para escolher o arquivo
              </Text>
            </Stack>
          </div>

          <Button variant="primary">Pré-visualizar</Button>
        </Stack>
      </div>
    </Sidebar>
  );
}

function ContasMock() {
  return (
    <Sidebar active="contas">
      <PageHeader
        title="Contas"
        subtitle="Contas bancárias de movimentação"
        trailing={<Button variant="primary">Adicionar conta</Button>}
      />

      <Stack gap={0}>
        {ACCOUNTS.map((item, i) => (
          <div key={item.label}>
            {i > 0 ? <Divider /> : null}
            <Row
              align="center"
              justify="space-between"
              style={{ padding: "16px 0" }}
            >
              <Stack gap={4}>
                <Text weight="semibold">{item.label}</Text>
                <Pill size="sm">{item.bank}</Pill>
              </Stack>
              <Button variant="ghost">Editar</Button>
            </Row>
          </div>
        ))}
      </Stack>
    </Sidebar>
  );
}

function CartoesMock() {
  const theme = useHostTheme();
  const [cardId, setCardId] = useCanvasState("cartoes-card", "visa-nubank");
  const [invoiceId, setInvoiceId] = useCanvasState<string | null>(
    "cartoes-fatura",
    "set-2026",
  );

  const card = CARDS.find((c) => c.id === cardId) ?? CARDS[0];
  const cardInvoices = INVOICES.filter((inv) => inv.cardId === card.id);
  const openInvoice =
    cardInvoices.find((inv) => inv.status === "aberta") ??
    cardInvoices.find((inv) => inv.status === "parcial");
  const selectedInvoice =
    cardInvoices.find((inv) => inv.id === invoiceId) ?? null;

  return (
    <Sidebar active="cartoes">
      <PageHeader
        title="Cartões"
        subtitle="Faturas e saldo em aberto por cartão"
        trailing={<Button variant="primary">Adicionar cartão</Button>}
      />

      <Stack gap={24}>
        <Row gap={6} wrap>
          {CARDS.map((c) => (
            <Pill
              active={cardId === c.id}
              onClick={() => {
                setCardId(c.id);
                const first = INVOICES.find((inv) => inv.cardId === c.id);
                setInvoiceId(first?.id ?? null);
              }}
            >
              {c.label}
            </Pill>
          ))}
        </Row>

        {openInvoice ? (
          <Stack gap={6}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {openInvoice.balance}
            </Text>
            <Text tone="secondary" size="small">
              Saldo em aberto · fatura {openInvoice.ref} · vence{" "}
              {openInvoice.due}
            </Text>
          </Stack>
        ) : null}

        <Stack gap={12}>
          <H3 style={{ margin: 0, fontSize: 14 }}>
            Faturas · {card.label}
          </H3>
          <Stack gap={0}>
            {cardInvoices.map((inv, i) => (
              <div key={inv.id}>
                {i > 0 ? <Divider /> : null}
                <Row
                  align="center"
                  justify="space-between"
                  style={{
                    padding: "14px 0",
                    background:
                      invoiceId === inv.id
                        ? theme.fill.tertiary
                        : "transparent",
                    margin: invoiceId === inv.id ? "0 -8px" : 0,
                    paddingLeft: invoiceId === inv.id ? 8 : 0,
                    paddingRight: invoiceId === inv.id ? 8 : 0,
                    borderRadius: invoiceId === inv.id ? 8 : 0,
                  }}
                >
                  <Stack gap={4}>
                    <Row gap={8} align="center">
                      <Text weight="semibold">{inv.ref}</Text>
                      <Pill size="sm" tone={invoiceStatusTone(inv.status)}>
                        {invoiceStatusLabel(inv.status)}
                      </Pill>
                    </Row>
                    <Text size="small" tone="tertiary">
                      Vence {inv.due} · total {inv.total}
                      {inv.status !== "quitada"
                        ? ` · saldo ${inv.balance}`
                        : null}
                    </Text>
                  </Stack>
                  <Button variant="ghost" onClick={() => setInvoiceId(inv.id)}>
                    Ver
                  </Button>
                </Row>
              </div>
            ))}
          </Stack>
        </Stack>

        {selectedInvoice ? (
          <Stack gap={12}>
            <Row align="center" justify="space-between">
              <H3 style={{ margin: 0, fontSize: 14 }}>
                Lançamentos · {selectedInvoice.ref}
              </H3>
              {selectedInvoice.status !== "quitada" ? (
                <Button variant="secondary">Vincular pagamento</Button>
              ) : null}
            </Row>
            <Stack gap={0}>
              {selectedInvoice.items.map((item, i) => (
                <div key={item.desc}>
                  {i > 0 ? <Divider /> : null}
                  <Row
                    align="center"
                    justify="space-between"
                    style={{ padding: "10px 0" }}
                  >
                    <Stack gap={2}>
                      <Text size="small" weight="medium">
                        {item.desc}
                      </Text>
                      <Text size="small" tone="tertiary">
                        {item.date}
                      </Text>
                    </Stack>
                    <Text size="small" weight="semibold" tone="secondary">
                      {item.value}
                    </Text>
                  </Row>
                </div>
              ))}
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Sidebar>
  );
}

function RelatoriosMock() {
  const [regime, setRegime] = useCanvasState<"competence" | "cash">(
    "rel-regime",
    "competence",
  );

  return (
    <Sidebar active="relatorios">
      <PageHeader
        title="Relatórios"
        subtitle="Evolução dos últimos 6 meses"
        trailing={<RegimeToggle regime={regime} onChange={setRegime} />}
      />

      <Stack gap={28}>
        <Grid columns={3} gap={20}>
          <Stat value="R$ 4.240" label="Gastos no mês" />
          <Stat value="R$ 1.240" label="Maior categoria" />
          <Stat value="-12%" label="vs. mês anterior" tone="success" />
        </Grid>

        <Stack gap={10}>
          <H3 style={{ margin: 0, fontSize: 14 }}>Evolução mensal</H3>
          <BarChart
            categories={["Abr", "Mai", "Jun", "Jul", "Ago", "Set"]}
            series={[
              {
                name: "Gastos",
                data: [3800, 4100, 3950, 4500, 4200, 4240],
                tone: "neutral",
              },
            ]}
            height={180}
          />
          <Text size="small" tone="tertiary">
            Fonte: lançamentos importados · regime{" "}
            {regime === "competence" ? "competência" : "caixa"} · abr–set 2026
          </Text>
        </Stack>

        <Stack gap={10}>
          <H3 style={{ margin: 0, fontSize: 14 }}>Distribuição por categoria</H3>
          <UsageBar total={4240} segments={CATEGORY_SEGMENTS} />
          <Row gap={16} wrap>
            {CATEGORY_LABELS.map((cat) => (
              <Text size="small" tone="secondary">
                {cat.name} {cat.pct}
              </Text>
            ))}
          </Row>
        </Stack>
      </Stack>
    </Sidebar>
  );
}

export default function MaoDeVacaUiMockup() {
  const [screen, setScreen] = useCanvasState<Screen>("screen", "dashboard");

  return (
    <Stack
      gap={20}
      style={mergeStyle({ padding: 16 }, { maxWidth: 960, margin: "0 auto" })}
    >
      <DesignPrinciples />
      <ScreenPicker screen={screen} onChange={setScreen} />

      {screen === "login" ? <LoginMock /> : null}
      {screen === "onboarding" ? <OnboardingMock /> : null}
      {screen === "dashboard" ? <DashboardMock /> : null}
      {screen === "lancamentos" ? <LancamentosMock /> : null}
      {screen === "importar" ? <ImportarMock /> : null}
      {screen === "contas" ? <ContasMock /> : null}
      {screen === "cartoes" ? <CartoesMock /> : null}
      {screen === "relatorios" ? <RelatoriosMock /> : null}
    </Stack>
  );
}
