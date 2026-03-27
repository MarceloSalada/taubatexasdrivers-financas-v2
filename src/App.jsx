import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Car,
  DollarSign,
  CalendarDays,
  Save,
  Trash2,
  TrendingUp,
  LogOut,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import "./styles.css";

const currency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);

const parseNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value ?? "")
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const defaultCosts = {
  financing: 0,
  insurance: 0,
  ipva: 0,
  oilMaintenance: 0,
  reserveMaintenance: 0,
  cellphone: 0,
  washing: 0,
  otherMonthly: 0,
};

const pieColors = ["#2563eb", "#60a5fa", "#0f172a", "#38bdf8", "#1d4ed8"];

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tab, setTab] = useState("daily");
  const [dailyForm, setDailyForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    gross: "",
    km: "",
    fuelPrice: "",
    consumption: "",
    extras: "",
  });
  const [monthlyCosts, setMonthlyCosts] = useState(defaultCosts);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadEntries();
      loadMonthlyCosts();
    } else {
      setEntries([]);
      setMonthlyCosts(defaultCosts);
    }
  }, [session]);

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Conta criada. Se a confirmação de email estiver ativa no Supabase, confirme seu email antes de entrar.");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(error.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function loadEntries() {
    setLoadingData(true);

    const { data, error } = await supabase
      .from("diarias")
      .select("*")
      .order("date", { ascending: false });

    setLoadingData(false);

    if (error) {
      alert("Erro ao carregar diárias: " + error.message);
      return;
    }

    setEntries(data || []);
  }

  async function loadMonthlyCosts() {
    const { data, error } = await supabase
      .from("monthly_costs")
      .select("*")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      alert("Erro ao carregar custos mensais: " + error.message);
      return;
    }

    if (!data) {
      const { error: insertError } = await supabase.from("monthly_costs").insert({
        user_id: session.user.id,
        financing: 0,
        insurance: 0,
        ipva: 0,
        oilmaintenance: 0,
        reservemaintenance: 0,
        cellphone: 0,
        washing: 0,
        othermonthly: 0,
      });

      if (insertError) {
        alert("Erro ao criar custos mensais: " + insertError.message);
        return;
      }

      setMonthlyCosts(defaultCosts);
      return;
    }

    setMonthlyCosts({
      financing: Number(data.financing || 0),
      insurance: Number(data.insurance || 0),
      ipva: Number(data.ipva || 0),
      oilMaintenance: Number(data.oilmaintenance || 0),
      reserveMaintenance: Number(data.reservemaintenance || 0),
      cellphone: Number(data.cellphone || 0),
      washing: Number(data.washing || 0),
      otherMonthly: Number(data.othermonthly || 0),
    });
  }

  async function saveMonthlyCosts() {
    const payload = {
      user_id: session.user.id,
      financing: monthlyCosts.financing,
      insurance: monthlyCosts.insurance,
      ipva: monthlyCosts.ipva,
      oilmaintenance: monthlyCosts.oilMaintenance,
      reservemaintenance: monthlyCosts.reserveMaintenance,
      cellphone: monthlyCosts.cellphone,
      washing: monthlyCosts.washing,
      othermonthly: monthlyCosts.otherMonthly,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("monthly_costs")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      alert("Erro ao salvar custos mensais: " + error.message);
      return;
    }

    alert("Custos mensais salvos com sucesso.");
  }

  const preview = useMemo(() => {
    const gross = parseNumber(dailyForm.gross);
    const km = parseNumber(dailyForm.km);
    const fuelPrice = parseNumber(dailyForm.fuelPrice);
    const consumption = parseNumber(dailyForm.consumption);
    const extras = parseNumber(dailyForm.extras);
    const fuelCost = km > 0 && consumption > 0 ? (km / consumption) * fuelPrice : 0;
    const totalCost = fuelCost + extras;
    const profit = gross - totalCost;
    const revenuePerKm = km > 0 ? gross / km : 0;
    const profitPerKm = km > 0 ? profit / km : 0;

    return {
      gross,
      km,
      fuelPrice,
      consumption,
      extras,
      fuelCost,
      totalCost,
      profit,
      revenuePerKm,
      profitPerKm,
    };
  }, [dailyForm]);

  const monthlyFixedCosts = useMemo(
    () =>
      monthlyCosts.financing +
      monthlyCosts.insurance +
      monthlyCosts.ipva +
      monthlyCosts.oilMaintenance +
      monthlyCosts.reserveMaintenance +
      monthlyCosts.cellphone +
      monthlyCosts.washing +
      monthlyCosts.otherMonthly,
    [monthlyCosts]
  );

  const summary = useMemo(() => {
    const grossMonth = entries.reduce((acc, item) => acc + Number(item.gross || 0), 0);
    const fuelMonth = entries.reduce((acc, item) => acc + Number(item.fuelcost || 0), 0);
    const extrasMonth = entries.reduce((acc, item) => acc + Number(item.extras || 0), 0);
    const totalVariable = fuelMonth + extrasMonth;
    const netMonth = grossMonth - totalVariable - monthlyFixedCosts;
    const workedDays = entries.length;
    const avgProfit = workedDays
      ? entries.reduce((acc, item) => acc + Number(item.profit || 0), 0) / workedDays
      : 0;

    return {
      grossMonth,
      fuelMonth,
      extrasMonth,
      totalVariable,
      monthlyFixedCosts,
      netMonth,
      workedDays,
      avgProfit,
      annualNet: netMonth * 12,
      reserve12: monthlyCosts.reserveMaintenance * 12,
      reserve24: monthlyCosts.reserveMaintenance * 24,
      reserve36: monthlyCosts.reserveMaintenance * 36,
    };
  }, [entries, monthlyFixedCosts, monthlyCosts.reserveMaintenance]);

  const chartData = useMemo(
    () => [
      { name: "Receita", valor: summary.grossMonth },
      { name: "Variáveis", valor: summary.totalVariable },
      { name: "Fixos", valor: summary.monthlyFixedCosts },
      { name: "Lucro", valor: summary.netMonth },
    ],
    [summary]
  );

  const dailyChart = useMemo(
    () =>
      entries.map((item) => ({
        dia: new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        lucro: Number(Number(item.profit || 0).toFixed(2)),
      })),
    [entries]
  );

  const expensePie = useMemo(
    () =>
      [
        { name: "Combustível", value: summary.fuelMonth },
        { name: "Extras", value: summary.extrasMonth },
        { name: "Fixos", value: summary.monthlyFixedCosts },
      ].filter((item) => item.value > 0),
    [summary]
  );

  async function saveDailyEntry() {
    if (!dailyForm.date || preview.gross <= 0 || preview.km <= 0 || preview.fuelPrice <= 0 || preview.consumption <= 0) {
      alert("Preencha Data, Ganho, KM, Combustível e Consumo.");
      return;
    }

    const payload = {
      user_id: session.user.id,
      date: dailyForm.date,
      gross: preview.gross,
      km: preview.km,
      fuelprice: preview.fuelPrice,
      consumption: preview.consumption,
      extras: preview.extras,
      fuelcost: preview.fuelCost,
      totalcost: preview.totalCost,
      profit: preview.profit,
    };

    const { error } = await supabase.from("diarias").insert(payload);

    if (error) {
      alert("Erro ao salvar diária: " + error.message);
      return;
    }

    setDailyForm({
      date: new Date().toISOString().slice(0, 10),
      gross: "",
      km: "",
      fuelPrice: "",
      consumption: "",
      extras: "",
    });

    await loadEntries();
    setTab("history");
  }

  async function removeEntry(id) {
    const { error } = await supabase.from("diarias").delete().eq("id", id);

    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }

    await loadEntries();
  }

  async function clearAll() {
    if (!window.confirm("Apagar todas as diárias?")) return;

    const { error } = await supabase.from("diarias").delete().eq("user_id", session.user.id);

    if (error) {
      alert("Erro ao limpar diárias: " + error.message);
      return;
    }

    await loadEntries();
  }

  const setMonthlyValue = (key, value) => {
    setMonthlyCosts((current) => ({ ...current, [key]: parseNumber(value) }));
  };

  const kpis = [
    { title: "Lucro do mês", value: currency(summary.netMonth), icon: TrendingUp },
    { title: "Receita do mês", value: currency(summary.grossMonth), icon: DollarSign },
    { title: "Dias lançados", value: String(summary.workedDays), icon: CalendarDays },
    { title: "Média por dia", value: currency(summary.avgProfit), icon: Car },
  ];

  const costFields = [
    ["financing", "Financiamento / aluguel", "Parcela do carro ou aluguel mensal"],
    ["insurance", "Seguro", "Valor mensal do seguro"],
    ["ipva", "IPVA", "Valor mensal proporcional do IPVA"],
    ["oilMaintenance", "Manutenção óleo", "Reserva para trocas de óleo e filtros"],
    ["reserveMaintenance", "Manutenção reserva", "Reserva mensal para manutenção futura"],
    ["cellphone", "Internet / celular", "Plano de dados, internet ou celular"],
    ["washing", "Lavagem", "Lavagens e limpeza do carro"],
    ["otherMonthly", "Outros custos mensais", "Qualquer outro custo fixo mensal"],
  ];

  if (loadingAuth) {
    return (
      <div className="app-shell">
        <div className="container">
          <div className="card">Carregando autenticação...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-shell">
        <div className="container auth-container">
          <div className="card auth-card">
            <h1>TaubatexasDrivers - Finanças V2</h1>
            <p className="section-help">Entre com seu email e senha para salvar tudo na nuvem.</p>

            <div className="tabs auth-tabs">
              <button
                className={`tab-btn ${authMode === "login" ? "active" : ""}`}
                onClick={() => setAuthMode("login")}
              >
                Entrar
              </button>
              <button
                className={`tab-btn ${authMode === "signup" ? "active" : ""}`}
                onClick={() => setAuthMode("signup")}
              >
                Criar conta
              </button>
            </div>

            <div className="form-grid">
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@gmail.com"
                />
              </Field>

              <Field label="Senha">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                />
              </Field>
            </div>

            {authMode === "login" ? (
              <button className="primary-btn" onClick={signIn}>
                Entrar
              </button>
            ) : (
              <button className="primary-btn" onClick={signUp}>
                Criar conta
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="hero card">
          <div>
            <h1>TaubatexasDrivers - Finanças V2</h1>
            <p>Controle diário, custos mensais, histórico, gráficos e login.</p>
            <small className="muted">Logado como: {session.user.email}</small>
          </div>

          <div className="hero-actions">
            <button className="danger-btn" onClick={clearAll}>
              <Trash2 size={16} /> Limpar diárias
            </button>
            <button className="outline-btn" onClick={signOut}>
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          {kpis.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="card kpi-card">
                <div>
                  <span className="muted">{item.title}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className="icon-wrap">
                  <Icon size={18} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="tabs">
          {[
            ["daily", "Diária"],
            ["history", "Registro"],
            ["monthly", "Custos"],
            ["dashboard", "Gráficos"],
          ].map(([key, label]) => (
            <button key={key} className={`tab-btn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "daily" && (
          <div className="two-col">
            <div className="card">
              <h2>Lançamento diário</h2>
              <div className="form-grid">
                <Field label="Data">
                  <input type="date" value={dailyForm.date} onChange={(e) => setDailyForm({ ...dailyForm, date: e.target.value })} />
                </Field>
                <Field label="Ganho bruto">
                  <input value={dailyForm.gross} onChange={(e) => setDailyForm({ ...dailyForm, gross: e.target.value })} placeholder="320" />
                </Field>
                <Field label="KM rodado">
                  <input value={dailyForm.km} onChange={(e) => setDailyForm({ ...dailyForm, km: e.target.value })} placeholder="210" />
                </Field>
                <div className="inline-grid">
                  <Field label="Combustível">
                    <input value={dailyForm.fuelPrice} onChange={(e) => setDailyForm({ ...dailyForm, fuelPrice: e.target.value })} placeholder="5,87" />
                  </Field>
                  <Field label="Consumo km/L">
                    <input value={dailyForm.consumption} onChange={(e) => setDailyForm({ ...dailyForm, consumption: e.target.value })} placeholder="13" />
                  </Field>
                </div>
                <Field label="Custos extras do dia">
                  <input value={dailyForm.extras} onChange={(e) => setDailyForm({ ...dailyForm, extras: e.target.value })} placeholder="20" />
                </Field>
              </div>
              <button className="primary-btn" onClick={saveDailyEntry}>
                <Save size={16} /> Salvar diária
              </button>
            </div>

            <div className="card">
              <h2>Prévia automática</h2>
              {[
                ["Custo combustível", currency(preview.fuelCost)],
                ["Custos extras", currency(preview.extras)],
                ["Custo total do dia", currency(preview.totalCost)],
                ["Receita por KM", currency(preview.revenuePerKm)],
                ["Lucro por KM", currency(preview.profitPerKm)],
              ].map(([label, value]) => (
                <div key={label} className="metric-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
              <div className="profit-box">
                <span>Lucro diário</span>
                <strong>{currency(preview.profit)}</strong>
              </div>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="card">
            <h2>Registro das diárias</h2>
            <div className="list">
              {loadingData ? (
                <div className="empty-box">Carregando...</div>
              ) : entries.length === 0 ? (
                <div className="empty-box">Nenhuma diária lançada ainda.</div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="entry-card">
                    <div className="entry-body">
                      <div className="entry-date">
                        {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </div>
                      <div className="entry-line">Ganho: {currency(Number(entry.gross))} • KM: {Number(entry.km)}</div>
                      <div className="entry-line">Combustível: {currency(Number(entry.fuelcost))} • Extras: {currency(Number(entry.extras))}</div>
                      <div className="entry-profit">Lucro: {currency(Number(entry.profit))}</div>
                    </div>
                    <button className="outline-btn" onClick={() => removeEntry(entry.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "monthly" && (
          <div className="card">
            <h2>Custos mensais</h2>
            <p className="section-help">Preencha cada campo e clique em salvar.</p>
            <div className="monthly-grid">
              {costFields.map(([key, label, hint]) => (
                <div key={key} className="cost-card">
                  <label>{label}</label>
                  <small>{hint}</small>
                  <input
                    value={String(monthlyCosts[key] || "")}
                    onChange={(e) => setMonthlyValue(key, e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              ))}
            </div>

            <div className="profit-box">
              <span>Total de custos mensais</span>
              <strong>{currency(monthlyFixedCosts)}</strong>
            </div>

            <button className="primary-btn" onClick={saveMonthlyCosts}>
              <Save size={16} /> Salvar custos mensais
            </button>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="dashboard-grid">
            <div className="card chart-card">
              <h2>Receita x custos x lucro</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                  <XAxis dataKey="name" stroke="#334155" />
                  <YAxis stroke="#334155" />
                  <Tooltip formatter={(v) => currency(v)} />
                  <Bar dataKey="valor" radius={[10, 10, 0, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card">
              <h2>Lucro por dia</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                  <XAxis dataKey="dia" stroke="#334155" />
                  <YAxis stroke="#334155" />
                  <Tooltip formatter={(v) => currency(v)} />
                  <Line type="monotone" dataKey="lucro" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card">
              <h2>Distribuição de custos</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={expensePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {expensePie.map((_, index) => (
                      <Cell key={index} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => currency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>Projeção</h2>
              {[
                ["Lucro líquido mensal", currency(summary.netMonth)],
                ["Lucro líquido anual", currency(summary.annualNet)],
                ["Reserva manutenção 12m", currency(summary.reserve12)],
                ["Reserva manutenção 24m", currency(summary.reserve24)],
                ["Reserva manutenção 36m", currency(summary.reserve36)],
              ].map(([label, value]) => (
                <div key={label} className="metric-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
