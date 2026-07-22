import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SERVER_URL = `http://${window.location.hostname}:4000`;

const PALETTE = {
  carbon: "#1C1C1E",
  papel: "#EFEAE0",
  brasa: "#C1440E",
  menta: "#3F7A63",
  acero: "#7A8B99",
  mostaza: "#D9A441",
};

const MENU = [
  { id: "e1", cat: "Entradas", name: "Papa a la huancaína", price: 12 },
  { id: "e2", cat: "Entradas", name: "Causa limeña", price: 14 },
  { id: "e3", cat: "Entradas", name: "Anticuchos", price: 16 },
  { id: "f1", cat: "Fondos", name: "Lomo saltado", price: 28 },
  { id: "f2", cat: "Fondos", name: "Ají de gallina", price: 22 },
  { id: "f3", cat: "Fondos", name: "Arroz con pollo", price: 20 },
  { id: "f4", cat: "Fondos", name: "Ceviche mixto", price: 26 },
  { id: "b1", cat: "Bebidas", name: "Chicha morada", price: 8 },
  { id: "b2", cat: "Bebidas", name: "Inca Kola", price: 6 },
  { id: "b3", cat: "Bebidas", name: "Agua mineral", price: 4 },
  { id: "p1", cat: "Postres", name: "Suspiro limeño", price: 10 },
  { id: "p2", cat: "Postres", name: "Mazamorra morada", price: 9 },
];

const CATS = ["Entradas", "Fondos", "Bebidas", "Postres"];
const MESAS = Array.from({ length: 12 }, (_, i) => i + 1);
const STATUS_FLOW = ["pendiente", "preparando", "listo"];
const STATUS_LABEL = { pendiente: "Pendiente", preparando: "Preparando", listo: "Listo", entregado: "Entregado" };
const STATUS_COLOR = { pendiente: PALETTE.brasa, preparando: PALETTE.mostaza, listo: PALETTE.menta, entregado: PALETTE.acero };

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function minutesAgo(ts) {
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

function TicketEdge({ flip }) {
  const style = {
    height: "10px",
    width: "100%",
    backgroundImage:
      "linear-gradient(-45deg, transparent 5px, var(--paper) 5px), linear-gradient(45deg, transparent 5px, var(--paper) 5px)",
    backgroundSize: "10px 10px",
    backgroundRepeat: "repeat-x",
    backgroundPosition: "0 100%",
    transform: flip ? "rotate(180deg)" : "none",
  };
  return <div style={style} />;
}

function LoginView({ socket, onLogin, conectado }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = (e) => {
    e.preventDefault();
    if (!usuario || !password || !socket) return;
    setCargando(true);
    setError("");
    socket.emit("login", { usuario, password }, (res) => {
      setCargando(false);
      if (res && res.ok) {
        onLogin({ usuario: res.usuario, nombre: res.nombre, rol: res.rol });
      } else {
        setError((res && res.mensaje) || "No se pudo iniciar sesión");
      }
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#faf8f3",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={entrar}
        style={{
          background: PALETTE.papel,
          padding: "28px 26px",
          borderRadius: "8px",
          width: "280px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ textAlign: "center", fontWeight: 800, letterSpacing: "1px", fontSize: "18px", color: PALETTE.carbon, marginBottom: "4px" }}>
          COMANDAS
        </div>
        <div style={{ textAlign: "center", fontSize: "12px", color: conectado ? PALETTE.menta : PALETTE.brasa, marginBottom: "18px" }}>
          {conectado ? "● Conectado al servidor" : "○ Conectando..."}
        </div>

        <label style={{ fontSize: "12px", color: PALETTE.acero }}>Usuario</label>
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={{ width: "100%", padding: "8px", marginTop: "4px", marginBottom: "12px", borderRadius: "4px", border: "1px solid #ccc" }}
        />

        <label style={{ fontSize: "12px", color: PALETTE.acero }}>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "8px", marginTop: "4px", marginBottom: "12px", borderRadius: "4px", border: "1px solid #ccc" }}
        />

        {error && <div style={{ color: PALETTE.brasa, fontSize: "12px", marginBottom: "10px" }}>{error}</div>}

        <button
          type="submit"
          disabled={!conectado || cargando}
          style={{
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: "4px",
            background: PALETTE.carbon,
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {cargando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function MeseroView({ orders, socket }) {
  const [mesa, setMesa] = useState(1);
  const [cat, setCat] = useState("Entradas");
  const [cart, setCart] = useState([]);
  const [notas, setNotas] = useState("");
  const [enviado, setEnviado] = useState(false);

  const addItem = (item) => {
    setCart((prev) => {
      const found = prev.find((c) => c.id === item.id);
      if (found) return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...item, qty: 1 }];
    });
  };
  const removeItem = (id) => {
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c)).filter((c) => c.qty > 0)
    );
  };

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const enviar = () => {
    if (cart.length === 0) return;
    const nuevo = {
      id: uid(),
      mesa,
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
      notas,
      status: "pendiente",
      createdAt: Date.now(),
    };
    socket.emit("nuevo-pedido", nuevo);
    setCart([]);
    setNotas("");
    setEnviado(true);
    setTimeout(() => setEnviado(false), 1800);
  };

  const misPedidos = orders
    .filter((o) => o.mesa === mesa && o.status !== "entregado")
    .sort((a, b) => b.createdAt - a.createdAt);

  const marcarEntregado = (id) => {
    socket.emit("actualizar-estado", { id, status: "entregado" });
  };

  return (
    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 380px", minWidth: "300px" }}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", letterSpacing: "1px", color: PALETTE.acero, marginBottom: "6px" }}>
            MESA
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {MESAS.map((m) => (
              <button
                key={m}
                onClick={() => setMesa(m)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "6px",
                  border: mesa === m ? `2px solid ${PALETTE.carbon}` : "1px solid #ccc",
                  background: mesa === m ? PALETTE.carbon : "#fff",
                  color: mesa === m ? "#fff" : PALETTE.carbon,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "none",
                background: cat === c ? PALETTE.carbon : "#e4e0d6",
                color: cat === c ? "#fff" : PALETTE.carbon,
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {MENU.filter((i) => i.cat === cat).map((item) => (
            <button
              key={item.id}
              onClick={() => addItem(item)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                border: "1px solid #d8d3c6",
                borderRadius: "8px",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "14px", color: PALETTE.carbon }}>{item.name}</div>
              <div style={{ fontSize: "12px", color: PALETTE.acero }}>S/ {item.price.toFixed(2)}</div>
            </button>
          ))}
        </div>

        {misPedidos.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <div style={{ fontSize: "12px", letterSpacing: "1px", color: PALETTE.acero, marginBottom: "6px" }}>
              PEDIDOS DE ESTA MESA
            </div>
            {misPedidos.map((o) => (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  background: "#fff",
                  border: "1px solid #e2ddd0",
                  borderRadius: "6px",
                  marginBottom: "6px",
                  fontSize: "13px",
                }}
              >
                <span>
                  {o.items.map((it) => `${it.qty}x ${it.name}`).join(", ")}{" "}
                  <span style={{ color: STATUS_COLOR[o.status], fontWeight: 700, marginLeft: "6px" }}>
                    · {STATUS_LABEL[o.status]}
                  </span>
                </span>
                {o.status === "listo" && (
                  <button
                    onClick={() => marcarEntregado(o.id)}
                    style={{
                      border: "none",
                      background: PALETTE.menta,
                      color: "#fff",
                      padding: "4px 10px",
                      borderRadius: "5px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Entregar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: "0 0 260px" }}>
        <div
          style={{
            background: PALETTE.papel,
            borderRadius: "4px",
            fontFamily: "'Courier New', monospace",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          <TicketEdge />
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ textAlign: "center", fontWeight: 700, letterSpacing: "2px", marginBottom: "4px" }}>
              COMANDA
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: "12px",
                marginBottom: "12px",
                borderBottom: "1px dashed #999",
                paddingBottom: "8px",
              }}
            >
              MESA {mesa}
            </div>
            {cart.length === 0 && (
              <div style={{ fontSize: "12px", color: "#888", textAlign: "center", padding: "12px 0" }}>
                Sin productos aún
              </div>
            )}
            {cart.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span>
                  {c.qty}x {c.name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  S/ {(c.price * c.qty).toFixed(2)}
                  <button
                    onClick={() => removeItem(c.id)}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: PALETTE.brasa, fontWeight: 700 }}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
            {cart.length > 0 && (
              <div
                style={{
                  borderTop: "1px dashed #999",
                  marginTop: "8px",
                  paddingTop: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                <span>TOTAL</span>
                <span>S/ {total.toFixed(2)}</span>
              </div>
            )}
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas (ej: sin cebolla)"
              style={{
                width: "100%",
                marginTop: "10px",
                fontFamily: "inherit",
                fontSize: "12px",
                padding: "6px",
                border: "1px dashed #999",
                background: "transparent",
                resize: "none",
              }}
              rows={2}
            />
            <button
              onClick={enviar}
              disabled={cart.length === 0}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "10px",
                border: "none",
                borderRadius: "4px",
                background: cart.length === 0 ? "#ccc" : PALETTE.carbon,
                color: "#fff",
                fontWeight: 700,
                letterSpacing: "1px",
                cursor: cart.length === 0 ? "default" : "pointer",
              }}
            >
              {enviado ? "ENVIADO ✓" : "ENVIAR A COCINA"}
            </button>
          </div>
          <TicketEdge flip />
        </div>
      </div>
    </div>
  );
}

function CocinaView({ orders, socket }) {
  const avanzar = (id, status) => {
    const idx = STATUS_FLOW.indexOf(status);
    const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    socket.emit("actualizar-estado", { id, status: next });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
      {STATUS_FLOW.map((st) => {
        const items = orders.filter((o) => o.status === st).sort((a, b) => a.createdAt - b.createdAt);
        return (
          <div key={st}>
            <div
              style={{
                textAlign: "center",
                padding: "8px",
                borderRadius: "6px 6px 0 0",
                background: STATUS_COLOR[st],
                color: "#fff",
                fontWeight: 700,
                letterSpacing: "1px",
                fontSize: "13px",
              }}
            >
              {STATUS_LABEL[st].toUpperCase()} · {items.length}
            </div>
            <div
              style={{
                background: "#f4f2ec",
                minHeight: "200px",
                padding: "10px",
                borderRadius: "0 0 6px 6px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {items.length === 0 && (
                <div style={{ fontSize: "12px", color: "#999", textAlign: "center", padding: "20px 0" }}>
                  Nada por aquí
                </div>
              )}
              {items.map((o) => {
                const mins = minutesAgo(o.createdAt);
                const urgente = st !== "listo" && mins >= 10;
                return (
                  <div
                    key={o.id}
                    style={{
                      background: "#fff",
                      borderRadius: "4px",
                      border: `1px solid ${urgente ? PALETTE.brasa : "#ddd"}`,
                      padding: "10px 12px",
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>
                      <span>MESA {o.mesa}</span>
                      <span style={{ color: urgente ? PALETTE.brasa : PALETTE.acero }}>{mins} min</span>
                    </div>
                    {o.items.map((it, i) => (
                      <div key={i} style={{ fontSize: "13px" }}>
                        {it.qty}x {it.name}
                      </div>
                    ))}
                    {o.notas && (
                      <div style={{ fontSize: "12px", fontStyle: "italic", color: PALETTE.brasa, marginTop: "6px" }}>
                        “{o.notas}”
                      </div>
                    )}
                    {st !== "listo" && (
                      <button
                        onClick={() => avanzar(o.id, st)}
                        style={{
                          marginTop: "8px",
                          width: "100%",
                          border: "none",
                          borderRadius: "4px",
                          padding: "6px",
                          background: PALETTE.carbon,
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {st === "pendiente" ? "Empezar a preparar →" : "Marcar listo →"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CajaView({ orders, socket }) {
  const entregados = orders
    .filter((o) => o.status === "entregado")
    .sort((a, b) => a.createdAt - b.createdAt);

  const totalOrden = (o) => o.items.reduce((s, it) => s + (it.price || 0) * it.qty, 0);
  const totalGeneral = entregados.reduce((s, o) => s + totalOrden(o), 0);

  const cobrar = (id) => socket.emit("eliminar-pedido", id);

  return (
    <div>
      <div
        style={{
          background: PALETTE.carbon,
          color: "#fff",
          padding: "14px 18px",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontWeight: 700 }}>Cuentas por cobrar: {entregados.length}</span>
        <span style={{ fontWeight: 700 }}>Total: S/ {totalGeneral.toFixed(2)}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
        {entregados.length === 0 && (
          <div style={{ fontSize: "13px", color: "#999", gridColumn: "1 / -1", textAlign: "center", padding: "30px 0" }}>
            No hay cuentas pendientes de cobro
          </div>
        )}
        {entregados.map((o) => (
          <div
            key={o.id}
            style={{
              background: PALETTE.papel,
              borderRadius: "4px",
              fontFamily: "'Courier New', monospace",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <TicketEdge />
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ textAlign: "center", fontWeight: 700, marginBottom: "8px", borderBottom: "1px dashed #999", paddingBottom: "8px" }}>
                MESA {o.mesa}
              </div>
              {o.items.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span>
                    {it.qty}x {it.name}
                  </span>
                  <span>S/ {((it.price || 0) * it.qty).toFixed(2)}</span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px dashed #999",
                  marginTop: "8px",
                  paddingTop: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                }}
              >
                <span>TOTAL</span>
                <span>S/ {totalOrden(o).toFixed(2)}</span>
              </div>
              <button
                onClick={() => cobrar(o.id)}
                style={{
                  width: "100%",
                  marginTop: "10px",
                  padding: "9px",
                  border: "none",
                  borderRadius: "4px",
                  background: PALETTE.menta,
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cobrar
              </button>
            </div>
            <TicketEdge flip />
          </div>
        ))}
      </div>
    </div>
  );
}

const ROL_LABEL = { mesero: "Mesero", cocina: "Cocina", caja: "Caja" };

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem("comandas-session");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [orders, setOrders] = useState([]);
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on("connect", () => setConectado(true));
    socket.on("disconnect", () => setConectado(false));
    socket.on("pedidos", (data) => setOrders(data));

    return () => socket.disconnect();
  }, []);

  const handleLogin = (s) => {
    localStorage.setItem("comandas-session", JSON.stringify(s));
    setSession(s);
  };

  const handleLogout = () => {
    localStorage.removeItem("comandas-session");
    setSession(null);
  };

  if (!session) {
    return <LoginView socket={socketRef.current} onLogin={handleLogin} conectado={conectado} />;
  }

  return (
    <div style={{ "--paper": PALETTE.papel, fontFamily: "system-ui, sans-serif", background: "#faf8f3", padding: "20px", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: PALETTE.carbon, letterSpacing: "1px" }}>
            COMANDAS · {ROL_LABEL[session.rol]}
          </div>
          <div style={{ fontSize: "12px", color: conectado ? PALETTE.menta : PALETTE.brasa }}>
            {conectado ? `● ${session.nombre}` : "○ Conectando..."}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 14px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            background: "#fff",
            color: PALETTE.carbon,
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {session.rol === "mesero" && <MeseroView orders={orders} socket={socketRef.current} />}
      {session.rol === "cocina" && <CocinaView orders={orders} socket={socketRef.current} />}
      {session.rol === "caja" && <CajaView orders={orders} socket={socketRef.current} />}
    </div>
  );
}