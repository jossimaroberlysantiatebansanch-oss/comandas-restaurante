import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DATA_FILE = "./pedidos.json";
const USUARIOS = [
  { usuario: "juan", password: "1234", rol: "mesero", nombre: "Juan" },
  { usuario: "maria", password: "1234", rol: "mesero", nombre: "María" },
  { usuario: "cocina1", password: "1234", rol: "cocina", nombre: "Cocina" },
  { usuario: "caja1", password: "1234", rol: "caja", nombre: "Caja" },
];

function cargarPedidos() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function guardarPedidos(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

let orders = cargarPedidos();

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.emit("pedidos", orders);
  socket.on("login", ({ usuario, password }, callback) => {
    const encontrado = USUARIOS.find(
      (u) => u.usuario === usuario && u.password === password
    );
    if (encontrado) {
      callback({ ok: true, usuario: encontrado.usuario, nombre: encontrado.nombre, rol: encontrado.rol });
    } else {
      callback({ ok: false, mensaje: "Usuario o contraseña incorrectos" });
    }
  });

  socket.on("nuevo-pedido", (pedido) => {
    orders.push(pedido);
    guardarPedidos(orders);
    io.emit("pedidos", orders);
  });

  socket.on("actualizar-estado", ({ id, status }) => {
    orders = orders.map((o) => (o.id === id ? { ...o, status } : o));
    guardarPedidos(orders);
    io.emit("pedidos", orders);
  });

  socket.on("eliminar-pedido", (id) => {
    orders = orders.filter((o) => o.id !== id);
    guardarPedidos(orders);
    io.emit("pedidos", orders);
  });
});

const PORT = 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor de comandas escuchando en el puerto ${PORT}`);
});