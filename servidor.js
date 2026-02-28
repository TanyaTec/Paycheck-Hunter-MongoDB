require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PUERTO = process.env.PORT || 3000; 
const SECRET_TOKEN = process.env.PASSWORD_APP;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- 1. CONEXIÓN A MONGODB ATLAS ---
const URI_NUBE = process.env.MONGO_URI;

mongoose.connect(URI_NUBE)
    .then(() => console.log('☁️ Conectado a MongoDB ATLAS (Nube)'))
    .catch(err => console.error('❌ Error conectando a Atlas:', err));

// --- 2. DEFINICIÓN DE ESQUEMAS (SCHEMAS) ---

// Cambio quirúrgico: Simplificación de esquemaConfig para evitar errores de renderizado en el UI
const esquemaConfig = {
    virtuals: true,
    versionKey: false
};

const VentaSchema = new mongoose.Schema({
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
    pago_total: Number,
    comentarios: String,
    fecha_pendiente: String
}, esquemaConfig);

const MaquilaSchema = new mongoose.Schema({
    contrato: String,
    fecha: String,
    nombre_socio: String,
    vendedores: String,
    status: String,
    pack_nivel: String,
    pago_total: Number,
    fecha_pendiente: String
}, esquemaConfig);

// Cambio quirúrgico: Forzado de nombres de colección para coincidir con MongoDB Compass
const Venta = mongoose.model('Venta', VentaSchema, 'ventas');
const Maquila = mongoose.model('Maquila', MaquilaSchema, 'maquilas');

// --- 3. MIDDLEWARE DE SEGURIDAD ---
function guardiaDeSeguridad(req, res, next) {
    const tokenEntrante = req.headers['authorization'];
    if (tokenEntrante === SECRET_TOKEN) {
        next();
    } else {
        res.status(403).json({ error: "Acceso Denegado" });
    }
}

// --- 4. ENDPOINTS API ---

// === VENTAS ===
app.get('/api/ventas', guardiaDeSeguridad, async (req, res) => {
    try {
        const ventas = await Venta.find().sort({ fecha: -1 });
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
            cliente_nombre: data.cliente || data.cliente_nombre 
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
            cliente_nombre: data.cliente || data.cliente_nombre
        };
        await Venta.findByIdAndUpdate(req.params.id, datosActualizar);
        res.json({ message: "Venta actualizada" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/ventas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        await Venta.findByIdAndDelete(req.params.id);
        res.json({ message: "deleted" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// === MAQUILAS (PAPERWORK) ===
app.get('/api/maquilas', guardiaDeSeguridad, async (req, res) => {
    try {
        const maquilas = await Maquila.find().sort({ fecha: -1 });
        res.json({ message: "success", data: maquilas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/maquilas', guardiaDeSeguridad, async (req, res) => {
    try {
        const nuevaMaquila = new Maquila(req.body);
        const maquilaGuardada = await nuevaMaquila.save();
        res.json({ message: "Maquila guardada", id: maquilaGuardada.id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// CIRUGÍA: Faltaba la ruta PUT para poder Editar el Paperwork
app.put('/api/maquilas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        await Maquila.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Maquila actualizada" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// CIRUGÍA: Faltaba la ruta DELETE para poder Borrar el Paperwork
app.delete('/api/maquilas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        await Maquila.findByIdAndDelete(req.params.id);
        res.json({ message: "deleted" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// === ENDPOINT DE INTELIGENCIA DE NEGOCIOS (KPIs) ===
app.get('/api/kpi-totales', guardiaDeSeguridad, async (req, res) => {
    try {
        const { inicio, fin } = req.query;
        let matchStage = { status: "Cerrada" };

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
    console.log(`🚀 Servidor NoSQL corriendo en http://localhost:${PUERTO}`);
});