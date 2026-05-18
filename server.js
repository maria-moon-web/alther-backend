const express = require("express");
require("dotenv").config(); // 🔥 cargar variables primero

const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   SERVIR ARCHIVOS
========================= */
app.use("/uploads", express.static("uploads"));

/* =========================
   CONFIGURACION MULTER
========================= */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.mimetype.startsWith("image") || file.mimetype.startsWith("video")) {
      cb(null, "uploads/publicaciones");
    } else {
      cb(null, "uploads/documentos");
    }
  },
  filename: function (req, file, cb) {
    const nombre = Date.now() + path.extname(file.originalname);
    cb(null, nombre);
  },
});

const upload = multer({ storage });

/* =========================
   CONEXION A MONGODB (ATLAS)
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🔥 Conectado a MongoDB Atlas"))
  .catch(err => console.log("❌ Error Mongo:", err));

/* =========================
   MODELO USUARIO
========================= */
const UsuarioSchema = new mongoose.Schema({
  nombreUsuario: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bibliografia: String,
  numero: String,
  fotoPerfil: String
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);

/* =========================
   MODELO PUBLICACIONES
========================= */
const PublicacionSchema = new mongoose.Schema({
  usuario: String,
  userId: String,
  texto: String,
  imagen: String,
  fecha: { type: Date, default: Date.now }
});

const Publicacion = mongoose.model("Publicacion", PublicacionSchema);

/* =========================
   MODELO MENSAJES
========================= */
const MensajeSchema = new mongoose.Schema({
  remitente: String,
  destinatario: String,
  mensaje: String,
  fecha: { type: Date, default: Date.now }
});

const Mensaje = mongoose.model("Mensaje", MensajeSchema);

/* =========================
   REGISTRO
========================= */
app.post("/register", async (req, res) => {
  try {
    const { nombreUsuario, correo, password, bibliografia, numero } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const usuario = new Usuario({
      nombreUsuario,
      correo,
      password: hash,
      bibliografia,
      numero
    });

    await usuario.save();

    res.json({ success: true, message: "Usuario registrado" });

  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: "El correo ya existe" });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/* =========================
   LOGIN
========================= */
app.post("/login", async (req, res) => {
  try {
    const { correo, password } = req.body;

    const usuario = await Usuario.findOne({ correo });

    if (!usuario) {
      return res.status(400).json({ success: false, message: "Usuario no encontrado" });
    }

    const passwordCorrecta = await bcrypt.compare(password, usuario.password);

    if (!passwordCorrecta) {
      return res.status(400).json({ success: false, message: "Contraseña incorrecta" });
    }

    res.json({ success: true, usuario });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   FOTO DE PERFIL
========================= */
app.post("/foto-perfil", upload.single("imagen"), async (req, res) => {
  try {
    const { userId } = req.body;

    await Usuario.findByIdAndUpdate(userId, {
      fotoPerfil: req.file.path
    });

    res.json({ success: true, ruta: req.file.path });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   CREAR PUBLICACION
========================= */
app.post("/publicar", upload.single("imagen"), async (req, res) => {
  try {
    const nuevaPublicacion = new Publicacion({
      usuario: req.body.usuario,
      userId: req.body.userId,
      texto: req.body.texto,
      imagen: req.file ? req.file.path : null
    });

    await nuevaPublicacion.save();

    res.json({ success: true });

  } catch (error) {
    console.log("❌ ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   ACTUALIZAR PUBLICACION
========================= */
app.put("/publicacion/:id", async (req, res) => {
  try {
    const { texto } = req.body;
    const actualizacion = {};
    if (texto !== undefined) actualizacion.texto = texto;

    const publicacion = await Publicacion.findByIdAndUpdate(
      req.params.id,
      actualizacion,
      { new: true }
    );

    if (!publicacion) {
      return res.status(404).json({ success: false, message: "Publicación no encontrada" });
    }

    res.json({ success: true, publicacion });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   ELIMINAR PUBLICACION
========================= */
app.delete("/publicacion/:id", async (req, res) => {
  try {
    const publicacion = await Publicacion.findByIdAndDelete(req.params.id);
    if (!publicacion) {
      return res.status(404).json({ success: false, message: "Publicación no encontrada" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   OBTENER PUBLICACIONES
========================= */
app.get("/publicaciones", async (req, res) => {
  try {
    const publicaciones = await Publicacion.find().sort({ fecha: -1 });
    res.json(publicaciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   OBTENER PUBLICACIONES POR USUARIO
========================= */
app.get("/publicaciones/usuario/:userId", async (req, res) => {
  try {
    const publicaciones = await Publicacion.find({ userId: req.params.userId }).sort({ fecha: -1 });
    res.json(publicaciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   OBTENER USUARIO
========================= */
app.get("/usuario/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select("-password");
    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
    res.json({ success: true, usuario });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   ACTUALIZAR USUARIO
========================= */
app.put("/usuario/:id", async (req, res) => {
  try {
    const { nombreUsuario, bibliografia, numero } = req.body;
    const actualizacion = {};
    if (nombreUsuario !== undefined) actualizacion.nombreUsuario = nombreUsuario;
    if (bibliografia !== undefined) actualizacion.bibliografia = bibliografia;
    if (numero !== undefined) actualizacion.numero = numero;

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      actualizacion,
      { new: true }
    ).select("-password");

    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    res.json({ success: true, usuario });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   RUTAS CHAT
========================= */

// Obtener todos los usuarios
app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await Usuario.find().select("-password");
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener mensajes entre dos usuarios
app.get("/mensajes/:usuario1/:usuario2", async (req, res) => {
  try {
    const { usuario1, usuario2 } = req.params;
    const mensajes = await Mensaje.find({
      $or: [
        { remitente: usuario1, destinatario: usuario2 },
        { remitente: usuario2, destinatario: usuario1 }
      ]
    }).sort({ fecha: 1 });
    res.json(mensajes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensaje
app.post("/mensajes", async (req, res) => {
  try {
    const { remitente, destinatario, mensaje } = req.body;
    const nuevoMensaje = new Mensaje({ remitente, destinatario, mensaje });
    await nuevoMensaje.save();
    res.json(nuevoMensaje);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   SOCKET.IO
========================= */

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Unirse a una sala de chat entre dos usuarios
  socket.on('join_chat', (data) => {
    const { usuario1, usuario2 } = data;
    const room = [usuario1, usuario2].sort().join('_');
    socket.join(room);
    console.log(`Usuario ${socket.id} se unió a la sala ${room}`);
  });

  // Enviar mensaje
  socket.on('send_message', async (data) => {
    const { remitente, destinatario, mensaje } = data;
    const nuevoMensaje = new Mensaje({ remitente, destinatario, mensaje });
    await nuevoMensaje.save();

    const room = [remitente, destinatario].sort().join('_');
    io.to(room).emit('receive_message', nuevoMensaje);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

/* =========================
   SERVIDOR
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
