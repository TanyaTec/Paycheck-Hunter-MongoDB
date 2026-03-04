require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PUERTO = process.env.PORT || 3000; 

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const VIP_USERS = process.env.VIP_USERS ? process.env.VIP_USERS.split(',').map(e => e.trim().toLowerCase()) : [];

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- 1. DEFINICIÓN DE ESQUEMAS (MULTI-TENANT BLINDADO) ---
const esquemaConfig = {
    virtuals: true,
    versionKey: false
};

const VentaSchema = new mongoose.Schema({
    propietario: { type: String, required: true },
    cliente_nombre: { type: String, required: true },
    contrato: String,
    monto: Number,
    status: String,
    fecha: String,
    promesa_pago: String,
    usuario: String, 
    tipo_socio: String, 
    pack_nivel: String, 
    nacionalidad: String,
    deduccion_antilavado: Number, 
    deduccion_explore: Number,
    deduccion_meseros: Number,
    es_explore_package: Number,
    explore_es_hoy: Number,
    es_reserva: Number,
    monto_regalos: Number,
    monto_donativos: Number,
    monto_movein: Number,
    porcentaje_impuestos: Number,
    bonus_weeks: Number,
    amex: Number,
    msi_6: Number,
    num_vendedores: Number,
    vendedores: String,
    es_liner: Number,
    nombre_liner: String,
    es_casado: Number,
    nombre_casado: String,
    tipo_casado: String, 
    pago_total: Number,
    comentarios: String,
    fecha_pendiente: String
}, esquemaConfig);

const MaquilaSchema = new mongoose.Schema({
    propietario: { type: String, required: true },
    contrato: String,
    fecha: String,
    nombre_socio: String,
    vendedores: String,
    status: String,
    pack_nivel: String,
    pago_total: Number,
    fecha_pendiente: String,
    tipo_pago: String,
    maq_volumen: Number,
    maq_porcentaje: Number,
    maq_reserva: Number,
    maq_impuestos: Number
}, esquemaConfig);

const Venta = mongoose.model('Venta', VentaSchema, 'ventas');
const Maquila = mongoose.model('Maquila', MaquilaSchema, 'maquilas');

// --- 2. CONEXIÓN A MONGODB ATLAS Y RESCATE DE DATOS ---
const URI_NUBE = process.env.MONGO_URI;

mongoose.connect(URI_NUBE)
    .then(async () => {
        console.log('☁️ Conectado a MongoDB ATLAS (Nube)');
        
        // 🚨 SCRIPT DE RESCATE QUIRÚRGICO: Recuperar datos huérfanos
        try {
            const rescatarVentas = await Venta.updateMany(
                { propietario: { $exists: false } }, 
                { $set: { propietario: "tanya.medina.dev@gmail.com" } }
            );
            const rescatarMaquilas = await Maquila.updateMany(
                { propietario: { $exists: false } }, 
                { $set: { propietario: "tanya.medina.dev@gmail.com" } }
            );
            
            if (rescatarVentas.modifiedCount > 0 || rescatarMaquilas.modifiedCount > 0) {
                console.log(`✅ ¡Rescate exitoso! Se reclamaron ${rescatarVentas.modifiedCount} ventas y ${rescatarMaquilas.modifiedCount} paperworks huérfanos para Tanya.`);
            }
        } catch (e) {
            console.error('❌ Error en el rescate de datos:', e);
        }
    })
    .catch(err => console.error('❌ Error conectando a Atlas:', err));


// --- 3. MIDDLEWARE DE SEGURIDAD (CADENERO GOOGLE VIP) ---
async function guardiaDeSeguridad(req, res, next) {
    const tokenEntrante = req.headers['authorization'];
    
    if (!tokenEntrante) {
        return res.status(403).json({ error: "Falta credencial de acceso." });
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: tokenEntrante,
            audience: GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const emailUsuario = payload['email'].toLowerCase();
        const nombreUsuario = payload['given_name'] || payload['name']; 

        if (!VIP_USERS.includes(emailUsuario)) {
            console.log(`⛔ Intento de acceso bloqueado para: ${emailUsuario}`);
            return res.status(403).json({ error: "Suscripción Inactiva. Contacta al administrador." });
        }

        req.usuarioEmail = emailUsuario;
        req.usuarioNombre = nombreUsuario;
        next();

    } catch (error) {
        console.error("❌ Error escaneando token de Google:", error.message);
        res.status(403).json({ error: "Sesión expirada o credencial inválida." });
    }
}

// --- 4. ENDPOINTS API (FILTRADOS POR PROPIETARIO) ---

// === VENTAS ===
app.get('/api/ventas', guardiaDeSeguridad, async (req, res) => {
    try {
        const ventas = await Venta.find({ propietario: req.usuarioEmail }).sort({ fecha: -1 });
        res.json({ message: "success", data: ventas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ventas', guardiaDeSeguridad, async (req, res) => {
    try {
        const data = req.body;
        const nuevaVenta = new Venta({
            ...data,
            cliente_nombre: data.cliente || data.cliente_nombre,
            propietario: req.usuarioEmail,
            usuario: req.usuarioNombre     
        });
        const ventaGuardada = await nuevaVenta.save();
        res.json({ message: "Venta guardada", id: ventaGuardada.id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/ventas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        const data = req.body;
        const datosActualizar = {
            ...data,
            cliente_nombre: data.cliente || data.cliente_nombre,
            usuario: req.usuarioNombre 
        };
        await Venta.findOneAndUpdate({ _id: req.params.id, propietario: req.usuarioEmail }, datosActualizar);
        res.json({ message: "Venta actualizada" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/ventas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        await Venta.findOneAndDelete({ _id: req.params.id, propietario: req.usuarioEmail });
        res.json({ message: "deleted" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// === MAQUILAS (PAPERWORK) ===
app.get('/api/maquilas', guardiaDeSeguridad, async (req, res) => {
    try {
        const maquilas = await Maquila.find({ propietario: req.usuarioEmail }).sort({ fecha: -1 });
        res.json({ message: "success", data: maquilas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/maquilas', guardiaDeSeguridad, async (req, res) => {
    try {
        const nuevaMaquila = new Maquila({
            ...req.body,
            propietario: req.usuarioEmail
        });
        const maquilaGuardada = await nuevaMaquila.save();
        res.json({ message: "Maquila guardada", id: maquilaGuardada.id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/maquilas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        await Maquila.findOneAndUpdate({ _id: req.params.id, propietario: req.usuarioEmail }, req.body);
        res.json({ message: "Maquila actualizada" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/maquilas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        await Maquila.findOneAndDelete({ _id: req.params.id, propietario: req.usuarioEmail });
        res.json({ message: "deleted" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// === ENDPOINT DE INTELIGENCIA DE NEGOCIOS (KPIs) ===
app.get('/api/kpi-totales', guardiaDeSeguridad, async (req, res) => {
    try {
        const { inicio, fin } = req.query;
        let matchStage = { status: "Cerrada", propietario: req.usuarioEmail };

        if (inicio && fin) {
            matchStage.fecha = { $gte: inicio, $lte: fin };
        }

        const reporteVentas = await Venta.aggregate([
            { $match: matchStage },
            { $group: { _id: null, total: { $sum: "$pago_total" } } }
        ]);

        const reporteMaquilas = await Maquila.aggregate([
            { $match: matchStage },
            { $group: { _id: null, total: { $sum: "$pago_total" } } }
        ]);

        const totalVentas = reporteVentas.length > 0 ? reporteVentas[0].total : 0;
        const totalMaquilas = reporteMaquilas.length > 0 ? reporteMaquilas[0].total : 0;

        res.json({ 
            message: "Cálculo realizado por MongoDB Aggregation", 
            granTotal: totalVentas + totalMaquilas 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PUERTO, () => {
    console.log(`🚀 Servidor Multi-tenant corriendo en http://localhost:${PUERTO}`);
});