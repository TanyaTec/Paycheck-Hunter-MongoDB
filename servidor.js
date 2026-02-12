require('dotenv').config(); // <--- CAMBIO 1: Carga las variables de seguridad
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PUERTO = process.env.PORT || 3000; // Ajuste menor: Permite que Render asigne puerto o usa el 3000
const SECRET_TOKEN = process.env.PASSWORD_APP;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- 1. CONEXIÓN A MONGODB ---
// CAMBIO 2: Ahora leemos la conexión del archivo .env oculto
const URI_NUBE = process.env.MONGO_URI;

mongoose.connect(URI_NUBE)
    .then(() => console.log('☁️ Conectado a MongoDB ATLAS (Nube)'))
    .catch(err => console.error('Error conectando a Atlas:', err));

// --- 2. DEFINICIÓN DE ESQUEMAS (SCHEMAS) ---

// Configuración para que el frontend reciba 'id' en lugar de '_id'
const esquemaConfig = {
    toJSON: { 
        virtuals: true,
        versionKey: false,
        transform: function (doc, ret) { delete ret._id; }
    }
};

// Esquema de Ventas (Todo en un solo documento, sin joins)
const VentaSchema = new mongoose.Schema({
    // Datos Cliente (Integrados)
    cliente_nombre: { type: String, required: true },
    
    // Datos Contrato
    contrato: String,
    monto: Number,
    status: String,
    fecha: String,
    promesa_pago: String,
    usuario: String,
    
    // Clasificación
    tipo_socio: String, // New / Upgrade
    pack_nivel: String, // Full, 1/2...
    nacionalidad: String,
    
    // Deducciones Booleanas (Checkboxes)
    deduccion_antilavado: Number, // 1 o 0
    deduccion_explore: Number,
    deduccion_meseros: Number,
    es_explore_package: Number,
    explore_es_hoy: Number,
    es_reserva: Number,
    
    // Deducciones Numéricas
    monto_regalos: Number,
    monto_donativos: Number,
    monto_movein: Number,
    porcentaje_impuestos: Number,
    bonus_weeks: Number,
    
    // Métodos de Pago
    amex: Number,
    msi_6: Number,
    
    // Equipo de Ventas
    num_vendedores: Number,
    vendedores: String,
    es_liner: Number,
    nombre_liner: String,
    es_casado: Number,
    nombre_casado: String,
    
    // Finales
    pago_total: Number,
    comentarios: String,
    fecha_pendiente: String
}, esquemaConfig);

// Esquema de Maquilas
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

// Modelos
const Venta = mongoose.model('Venta', VentaSchema);
const Maquila = mongoose.model('Maquila', MaquilaSchema);

// --- 3. MIDDLEWARE DE SEGURIDAD ---
function guardiaDeSeguridad(req, res, next) {
    const tokenEntrante = req.headers['authorization'];
    if (tokenEntrante === SECRET_TOKEN) {
        next();
    } else {
        res.status(403).json({ error: "Acceso Denegado" });
    }
}

// --- 4. ENDPOINTS API (ADAPTADOS A MONGO) ---

// === VENTAS ===

app.get('/api/ventas', guardiaDeSeguridad, async (req, res) => {
    try {
        // .sort({_id: -1}) ordena por el más reciente (descendente)
        const ventas = await Venta.find().sort({ fecha: -1 });
        res.json({ message: "success", data: ventas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ventas', guardiaDeSeguridad, async (req, res) => {
    try {
        const data = req.body;
        
        // Creamos el objeto documento
        // Nota: Mapeamos 'data.cliente' a 'cliente_nombre'
        const nuevaVenta = new Venta({
            ...data,
            cliente_nombre: data.cliente 
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
        // Preparamos los datos para actualizar, mapeando cliente de nuevo
        const datosActualizar = {
            ...data,
            cliente_nombre: data.cliente
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

// === MAQUILAS ===

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

app.put('/api/maquilas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        await Maquila.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Maquila actualizada" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/maquilas/:id', guardiaDeSeguridad, async (req, res) => {
    try {
        await Maquila.findByIdAndDelete(req.params.id);
        res.json({ message: "deleted" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// === NUEVO: ENDPOINT DE INTELIGENCIA DE NEGOCIOS (AGGREGATION FRAMEWORK) ===
// Este endpoint utiliza el motor de Mongo para sumar, reemplazando el bucle del frontend
app.get('/api/kpi-totales', guardiaDeSeguridad, async (req, res) => {
    try {
        const { inicio, fin } = req.query;

        // 1. Construir el filtro base (Solo lo cobrado cuenta)
        let matchStage = { status: "Cerrada" };

        // 2. Si hay fechas, agregamos el filtro de rango al Match
        if (inicio && fin) {
            matchStage.fecha = { $gte: inicio, $lte: fin };
        }

        // 3. Agregación para VENTAS: Suma todos los 'pago_total' que coincidan con el match
        const reporteVentas = await Venta.aggregate([
            { $match: matchStage },
            { $group: { _id: null, total: { $sum: "$pago_total" } } }
        ]);

        // 4. Agregación para MAQUILAS: Suma todos los 'pago_total' que coincidan con el match
        const reporteMaquilas = await Maquila.aggregate([
            { $match: matchStage },
            { $group: { _id: null, total: { $sum: "$pago_total" } } }
        ]);

        // 5. Consolidar resultados (Si el array viene vacío es 0)
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