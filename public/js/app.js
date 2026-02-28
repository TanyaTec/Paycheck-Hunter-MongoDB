// --- CONFIGURACIÓN GLOBAL ---
const BASE_URL = '';
const SECRET_TOKEN = "Ytbaf1lgbt"; 
let currentMode = 'ventas'; 
let editId = null;

let allDataGlobal = []; 
let filteredData = [];  
let currentPage = 1;
const itemsPerPage = 10;

// --- INICIALIZACIÓN SEGURA ---
document.addEventListener('DOMContentLoaded', () => {
    const tokenGuardado = localStorage.getItem('paycheckToken');
    if (tokenGuardado === SECRET_TOKEN) {
        mostrarDashboard();
    }

    const passInput = document.getElementById('txtPassword');
    if (passInput) {
        passInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') login();
        });
    }
});

// --- FUNCIÓN LOGIN ---
function login() {
    const pass = document.getElementById('txtPassword').value;
    if (pass === "Ytbaf1lgbt") {
        localStorage.setItem('paycheckToken', SECRET_TOKEN);
        mostrarDashboard();
    } else {
        const errorMsg = document.getElementById('loginError');
        if(errorMsg) errorMsg.classList.remove('d-none');
    }
}

function mostrarDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    
    if(loginScreen) loginScreen.classList.add('d-none');
    if(appContent) appContent.classList.remove('d-none');
    
    cargarDatosUnificados(); 
}

function cerrarSesion() {
    localStorage.removeItem('paycheckToken');
    location.reload(); 
}

// --- NAVEGACIÓN Y UI ---
function switchTab(mode) {
    currentMode = mode;
    
    document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
    
    if (mode === 'ventas') {
        document.getElementById('nav-ventas').classList.add('active');
        document.getElementById('tabVentas').classList.remove('d-none');
        document.getElementById('tabMaquila').classList.add('d-none');
    } else {
        document.getElementById('nav-maquila').classList.add('active');
        document.getElementById('tabVentas').classList.add('d-none');
        document.getElementById('tabMaquila').classList.remove('d-none');
    }

    try {
        cancelarEdicion(mode); 
        limpiarFiltro(false);
    } catch(e) { console.error("Error reseteando formulario", e); }
}

function toggleExplore() {
    const check = document.getElementById('chkExplore');
    const fields = document.getElementById('exploreFields');
    if(check && fields) {
        check.checked ? fields.classList.remove('d-none') : fields.classList.add('d-none');
    }
}

function toggleExploreHoy() {
    const chk = document.getElementById('chkExploreHoy');
    const dateInput = document.getElementById('txtFechaPromesa');
    if (chk && dateInput) {
        if (chk.checked) {
            dateInput.value = ''; 
            dateInput.disabled = true; 
        } else {
            dateInput.disabled = false; 
        }
    }
}

function togglePendiente(mode) {
    const val = mode === 'venta' ? document.getElementById('cmbStatus').value : document.getElementById('maqStatus').value;
    const div = mode === 'venta' ? document.getElementById('divFechaPendienteVenta') : document.getElementById('divFechaPendienteMaq');
    if (val === 'Pendiente') div.classList.remove('d-none');
    else div.classList.add('d-none');
}

// --- LÓGICA MATEMÁTICA ---
function renderVendedoresInputs() {
    const cmb = document.getElementById('cmbNumVendedores');
    if(!cmb) return;

    const num = parseInt(cmb.value);
    const container = document.getElementById('containerVendedores');
    let html = '';
    
    for(let i=1; i<=num; i++) {
        html += `
            <label class="form-label text-muted small">Nombre Vendedor ${i}</label>
            <input type="text" class="form-control mb-2 form-control-sm" id="vend_${i}" placeholder="Nombre...">
        `;
    }
    container.innerHTML = html;
    calcularMatematica(); 
}

function toggleLiner() {
    const chk = document.getElementById('chkLiner');
    const input = document.getElementById('txtLinerName');
    if(chk && input) {
        chk.checked ? input.classList.remove('d-none') : input.classList.add('d-none');
        calcularMatematica();
    }
}

function toggleCasado() {
    const chk = document.getElementById('chkCasado');
    const input = document.getElementById('txtCasadoName');
    if(chk && input) {
        chk.checked ? input.classList.remove('d-none') : input.classList.add('d-none');
        calcularMatematica();
    }
}

function calcularMatematica() {
    const txtMonto = document.getElementById('txtMonto');
    if(!txtMonto) return;

    const monto = parseFloat(txtMonto.value) || 0;
    const importe = monto * 0.86207;
    document.getElementById('txtImporteBase').value = importe.toFixed(2);

    const radioNew = document.getElementById('radioNew');
    let tasa = (radioNew && radioNew.checked) ? 9.0 : 8.0;

    if (document.getElementById('chkMSI').checked) tasa -= 1.5;
    if (document.getElementById('chkLiner').checked) tasa -= 3.5;

    let dineroPorcentajeTotal = importe * (tasa / 100);

    const numVendedores = parseInt(document.getElementById('cmbNumVendedores').value) || 1;
    let miParteDelPorcentaje = dineroPorcentajeTotal / numVendedores;

    if (document.getElementById('chkCasado').checked) {
        miParteDelPorcentaje = miParteDelPorcentaje / 2;
    }

    const pack = document.getElementById('cmbPack').value;
    let bonusPack = 0;
    switch (pack) {
        case 'Full': bonusPack = 150.88; break;
        case '1/2': bonusPack = 150.88 / 2; break;
        case '1/3': bonusPack = 150.88 / 3; break;
        case '1/4': bonusPack = 150.88 / 4; break;
        default: bonusPack = 0; break;
    }

    let ingresoBrutoIndividual = miParteDelPorcentaje + bonusPack;

    // --- CIRUGÍA MATEMÁTICA: Extracción de impuestos sobre Subtotal Gravable ---
    
    // 1. Deducir Reserva
    let deduccionReserva = 0;
    if (document.getElementById('chkReserva').checked) {
        deduccionReserva = (ingresoBrutoIndividual * 0.10);
    }

    // 2. Gastos que se extraen ANTES de impuestos
    let gastosAntesImpuestos = 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtRegalos').value) || 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtDonativos').value) || 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtMoveIn').value) || 0;
    
    const bonusWeeks = parseInt(document.getElementById('cmbBonusWeeks').value) || 0;
    gastosAntesImpuestos += (bonusWeeks * 20);

    let miParteGastosAntes = gastosAntesImpuestos / numVendedores;

    // 3. Calculamos el Nuevo Subtotal Gravable
    let subtotalGravable = ingresoBrutoIndividual - deduccionReserva - miParteGastosAntes;

    // 4. Extraemos el porcentaje de impuestos SOBRE el subtotal gravable
    const impuestoPorcentaje = parseFloat(document.getElementById('txtImpuestosPorcentaje').value) || 0;
    let deduccionImpuestos = 0;
    if (impuestoPorcentaje > 0 && subtotalGravable > 0) {
        deduccionImpuestos = subtotalGravable * (impuestoPorcentaje / 100);
    }

    // 5. Subtotal después de impuestos
    let subtotalPostImpuestos = subtotalGravable - deduccionImpuestos;

    // 6. Gastos finales (propinas y fees que se descuentan al final)
    let gastosDespuesImpuestos = 20; // meseros default
    if (document.getElementById('chkAntilavado').checked) gastosDespuesImpuestos += 10;
    if (document.getElementById('chkExploreForm').checked) gastosDespuesImpuestos += 10;

    let miParteGastosDespues = gastosDespuesImpuestos / numVendedores;

    // 7. Pago Neto Final
    let pagoNetoFinal = subtotalPostImpuestos - miParteGastosDespues;
    
    // -------------------------------------------------------------------------

    document.getElementById('txtPagoTotal').value = pagoNetoFinal.toFixed(2);
}

// --- ACTUALIZAR KPI ---
async function actualizarTableroFinanciero(inicio = null, fin = null) {
    const lblTotal = document.getElementById('lblTotalCobrar');
    const lblRango = document.getElementById('lblRangoFechas');

    if (!inicio || !fin) {
        if (lblTotal) lblTotal.innerText = '$0.00';
        if (lblRango) lblRango.innerText = 'Selecciona un rango de fechas';
        return; 
    }

    try {
        let url = `${BASE_URL}/api/kpi-totales?inicio=${inicio}&fin=${fin}`;
        
        const res = await fetch(url, { headers: { 'Authorization': SECRET_TOKEN } });
        const data = await res.json();

        if (lblTotal) {
            lblTotal.innerText = `$${(data.granTotal || 0).toLocaleString()}`;
        }
        if (lblRango) {
            lblRango.innerText = `Del ${inicio} al ${fin}`;
        }
    } catch (error) {
        console.error("Error calculando KPIs:", error);
    }
}

// --- CARGA DE DATOS ---
async function cargarDatosUnificados() {
    try {
        const resVentas = await fetch(`${BASE_URL}/api/ventas`, { headers: { 'Authorization': SECRET_TOKEN } });
        const jsonVentas = await resVentas.json();
        const resMaquilas = await fetch(`${BASE_URL}/api/maquilas`, { headers: { 'Authorization': SECRET_TOKEN } });
        const jsonMaquilas = await resMaquilas.json();

        const dataV = jsonVentas.data || [];
        const dataM = jsonMaquilas.data || [];

        const ventasEtiquetadas = dataV.map(v => ({ ...v, type: 'venta' }));
        const maquilasEtiquetadas = dataM.map(m => ({ ...m, type: 'maquila' }));

        allDataGlobal = [...ventasEtiquetadas, ...maquilasEtiquetadas];
        allDataGlobal.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        filteredData = allDataGlobal; 
        currentPage = 1;
        
        renderTable(); 
        actualizarTableroFinanciero();

    } catch (error) { console.error("Error cargando datos:", error); }
}

function aplicarFiltro() {
    const inicio = document.getElementById('filtroInicio').value;
    const fin = document.getElementById('filtroFin').value;

    if (inicio && fin) {
        filteredData = allDataGlobal.filter(item => item.fecha >= inicio && item.fecha <= fin);
        currentPage = 1; 
        renderTable(); 
        actualizarTableroFinanciero(inicio, fin);
    } else {
        Swal.fire('Atención', 'Selecciona un rango de fechas.', 'info');
    }
}

function limpiarFiltro(recargar = true) {
    document.getElementById('filtroInicio').value = '';
    document.getElementById('filtroFin').value = '';
    
    filteredData = allDataGlobal; 
    currentPage = 1;
    renderTable(); 
    
    if (recargar) actualizarTableroFinanciero();
}

// --- CIRUGÍA: BÚSQUEDA RÁPIDA DE CONTRATOS ---
function buscarContrato() {
    const query = document.getElementById('txtBuscador').value.toLowerCase().trim();
    
    if (query === '') {
        // Si borran la búsqueda, regresamos a mostrar lo que indique el filtro de fechas (si lo hay)
        if (document.getElementById('filtroInicio').value && document.getElementById('filtroFin').value) {
            aplicarFiltro();
        } else {
            filteredData = allDataGlobal;
            currentPage = 1;
            renderTable();
        }
        return;
    }

    // Buscamos en toda la base de datos sin alterar el KPI financiero
    filteredData = allDataGlobal.filter(item => {
        const cliente = (item.cliente_nombre || '').toLowerCase();
        const socio = (item.nombre_socio || '').toLowerCase();
        const contrato = (item.contrato || '').toLowerCase();
        const fecha = (item.fecha || '').toLowerCase();
        
        return cliente.includes(query) || socio.includes(query) || contrato.includes(query) || fecha.includes(query);
    });
    
    currentPage = 1;
    renderTable();
}

function limpiarBuscador() {
    document.getElementById('txtBuscador').value = '';
    buscarContrato(); // Vuelve a renderizar la tabla normal
}
// ---------------------------------------------

function cambiarPagina(direction) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const newPage = parseInt(currentPage) + parseInt(direction);

    if (newPage > 0 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
    }
}

// --- RENDERIZADO: BOTONES NEGROS ---
function renderTable() {
    const tbody = document.getElementById('tablaResultados');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    document.getElementById('pageInfo').innerText = `Mostrando ${filteredData.length > 0 ? startIndex + 1 : 0} - ${Math.min(endIndex, filteredData.length)} de ${filteredData.length}`;
    document.getElementById('btnPrev').disabled = currentPage === 1;
    document.getElementById('btnNext').disabled = endIndex >= filteredData.length;

    if (pageData.length === 0) { 
        document.getElementById('emptyState').classList.remove('d-none'); 
        return; 
    }
    document.getElementById('emptyState').classList.add('d-none');

    pageData.forEach(item => {
        const itemId = item._id || item.id;

        let badgeColor = item.status === 'Cerrada' ? 'bg-success' : (item.status === 'Cancelada' || item.status === 'Caída' ? 'bg-danger' : 'bg-warning text-dark');
        
        let statusBlockPC = `<span class="badge ${badgeColor} rounded-pill">${item.status}</span>`;
        if(item.status === 'Pendiente' && item.fecha_pendiente) {
            statusBlockPC += `<div class="small text-muted mt-1 fw-bold" style="font-size:0.75rem"><i class="bi bi-clock-history me-1"></i>${item.fecha_pendiente}</div>`;
        }

        let detalleHTML = '', montosCombinadosPC = '';
        let iconType = item.type === 'venta' ? '<span class="badge bg-primary me-2">T.C.</span>' : '<span class="badge bg-secondary me-2">Paper</span>';
        
        // CIRUGÍA: Detectar Explore Package y crear la estrellita azul
        let exploreStar = (item.type === 'venta' && item.es_explore_package === 1) ? '<i class="bi bi-star-fill text-info ms-1" style="font-size: 0.85rem;" title="Explore Package"></i>' : '';
        if (item.type === 'venta') {
            const tipoSocioDisplay = item.tipo_socio ? item.tipo_socio : 'N/A';
            detalleHTML = `
                <div>${iconType} <span class="fw-bold text-dark">${item.cliente_nombre || '--'}</span></div>
                <div class="small text-muted">${item.nacionalidad || ''} | ${tipoSocioDisplay}</div> 
            `;
            montosCombinadosPC = `
                <div class="fw-bold text-success">$${(item.monto || 0).toLocaleString()} <span class="small text-muted fw-normal">Venta</span></div>
                <div class="fw-bold text-primary mt-1 pt-1 border-top" style="font-size:0.95rem">$${(item.pago_total || 0).toLocaleString()} <span class="small text-muted fw-normal">Neto</span></div>
            `;
        } else {
            detalleHTML = `
                <div>${iconType} <span class="fw-bold text-dark">${item.nombre_socio || '--'}</span></div>
                <div class="small text-muted">Pack: ${item.pack_nivel || '--'}</div>
            `;
            montosCombinadosPC = `
                <div class="text-muted small">--</div>
                <div class="fw-bold text-success mt-1 pt-1 border-top">$${(item.pago_total || 0).toLocaleString()} <span class="small text-muted fw-normal">Total</span></div>
            `;
        }

        // BOTONES NEGROS EN MÓVIL (btn-outline-dark)
        let mobileCol = `
            <div class="d-md-none d-flex flex-column align-items-end justify-content-center">
                ${item.status !== 'Cerrada' ? `<span class="badge ${badgeColor} mb-1" style="font-size:0.65rem;">${item.status}</span>` : ''}
                <span class="fw-bold text-success" style="font-size: 1.25rem;">$${(item.pago_total || 0).toLocaleString()}</span>
                
                <div class="btn-group mt-2">
                    <button onclick="verDetalle('${item.type}', '${itemId}')" class="btn btn-outline-dark py-1 px-3 shadow-sm"><i class="bi bi-eye-fill"></i></button>
                    <button onclick="iniciarEdicion('${item.type}', '${itemId}')" class="btn btn-outline-dark py-1 px-3 shadow-sm"><i class="bi bi-pencil-fill"></i></button>
                    <button onclick="eliminarItem('${item.type}', '${itemId}')" class="btn btn-outline-dark py-1 px-3 shadow-sm"><i class="bi bi-trash-fill"></i></button>
                </div>
            </div>
            <div class="d-none d-md-block">
                ${montosCombinadosPC}
            </div>
        `;

        // BOTONES NEGROS EN ESCRITORIO (btn-dark)
       const fila = `
            <tr>
                <td class="align-middle">
                    <div class="fw-bold text-dark">${item.fecha || '--'}</div>
                    <div class="small text-muted">#${item.contrato || 'N/A'}${exploreStar}</div>
                    <div class="d-md-none mt-1 small">${iconType}</div>
                </td>
                <td class="align-middle d-none d-md-table-cell">${detalleHTML}</td>
                <td class="align-middle d-none d-md-table-cell">${statusBlockPC}</td>
                <td class="align-middle text-end text-md-start">${mobileCol}</td>
                <td class="text-end align-middle d-none d-md-table-cell">
                    <div class="btn-group" role="group">
                        <button onclick="verDetalle('${item.type}', '${itemId}')" class="btn btn-sm btn-dark shadow-sm"><i class="bi bi-eye-fill"></i></button>
                        <button onclick="iniciarEdicion('${item.type}', '${itemId}')" class="btn btn-sm btn-dark shadow-sm border-start border-secondary"><i class="bi bi-pencil-fill"></i></button>
                        <button onclick="eliminarItem('${item.type}', '${itemId}')" class="btn btn-sm btn-dark shadow-sm border-start border-secondary"><i class="bi bi-trash-fill"></i></button>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
}

function verDetalle(type, id) {
    const item = allDataGlobal.find(x => String(x._id || x.id) === String(id) && x.type === type);
    if(!item) return;

    const modalTitle = document.getElementById('modalTitulo');
    const modalBody = document.getElementById('modalCuerpo');
    modalTitle.innerHTML = `<i class="bi bi-file-earmark-text me-2"></i>Ficha Técnica: #${item.contrato}`;

    const fm = (val) => val ? `$${val.toLocaleString()}` : '$0';
    const badgeStatus = item.status === 'Cerrada' ? 'bg-success' : (item.status === 'Caída' || item.status === 'Cancelada' ? 'bg-danger' : 'bg-warning text-dark');

    let statusBlock = `<span class="badge ${badgeStatus} fs-6 mb-1">${item.status}</span>`;
    if(item.status === 'Pendiente' && item.fecha_pendiente) {
        statusBlock += `<div class="text-warning fw-bold small mt-1"><i class="bi bi-calendar-event me-1"></i>Cierre: ${item.fecha_pendiente}</div>`;
    }

    let html = '';
    if (type === 'venta') { 
        let exploreIndicator = '<span class="text-muted small">No incluye Explore Package</span>';
        if (item.es_explore_package === 1) {
            let textoFecha = (item.explore_es_hoy === 1) ? 'HOY' : (item.promesa_pago || '');
            exploreIndicator = `<div class="alert alert-info py-1 px-2 mb-0 small fw-bold"><i class="bi bi-star-fill me-1"></i>EXPLORE: ${textoFecha}</div>`;
        }
        const reservaTxt = (item.es_reserva === 1) ? '10%' : 'No';

        html = `
            <div class="container-fluid px-0">
                <div class="row mb-3 border-bottom pb-3 align-items-center">
                     <div class="col-6"><small class="text-muted d-block text-uppercase fw-bold">Fecha Venta</small><span class="fs-5 fw-bold text-dark">${item.fecha}</span></div>
                     <div class="col-6 text-end">${statusBlock}<div>${exploreIndicator}</div></div>
                </div>
                <div class="row mb-3">
                     <div class="col-md-7"><h6 class="text-primary fw-bold text-uppercase small mb-2">Información del Cliente</h6><div class="detail-card p-3"><div class="fs-5 fw-bold mb-1">${item.cliente_nombre}</div><div class="d-flex gap-2 mb-2"><span class="badge bg-secondary">${item.nacionalidad}</span><span class="badge bg-info text-dark">${item.tipo_socio || '--'}</span><span class="badge bg-light text-dark border">${item.pack_nivel} Pack</span></div></div></div>
                     <div class="col-md-5"><h6 class="text-primary fw-bold text-uppercase small mb-2">Equipo de Ventas</h6><div class="detail-card p-3"><div class="text-dark fw-bold">${item.vendedores || 'No asignado'}</div></div></div>
                </div>
                <h6 class="text-primary fw-bold text-uppercase small mb-2 mt-4">Resumen Financiero</h6>
                <div class="detail-card p-3 mb-3" style="background-color: #f0fdf4; border-color: #bbf7d0;">
                     <div class="row text-center">
                        <div class="col-4 border-end border-success-subtle"><small class="d-block text-success fw-bold text-uppercase">Monto Venta</small><span class="fs-4 fw-bold text-dark">${fm(item.monto)}</span></div>
                        <div class="col-4 border-end border-success-subtle"><small class="d-block text-success fw-bold text-uppercase">Pago Neto</small><span class="fs-4 fw-bold text-dark">${fm(item.pago_total)}</span></div>
                        <div class="col-4"><small class="d-block text-muted text-uppercase fw-bold">Métodos</small><div class="mt-1">${item.amex ? '<span class="badge bg-primary">AMEX</span>' : ''} ${item.msi_6 ? '<span class="badge bg-info text-dark">6MSI</span>' : ''}</div></div>
                     </div>
                </div>
                <h6 class="text-primary fw-bold text-uppercase small mb-2 mt-4">Desglose de Deducciones</h6>
                <div class="row g-2">
                    <div class="col-4"><div class="p-2 border rounded bg-white"><small class="d-block text-muted">Regalos</small><strong class="text-dark">${fm(item.monto_regalos)}</strong></div></div>
                    <div class="col-4"><div class="p-2 border rounded bg-white"><small class="d-block text-muted">Donativos</small><strong class="text-dark">${fm(item.monto_donativos)}</strong></div></div>
                    <div class="col-4"><div class="p-2 border rounded bg-white"><small class="d-block text-muted">Move In</small><strong class="text-dark">${fm(item.monto_movein)}</strong></div></div>
                    <div class="col-4"><div class="p-2 border rounded bg-white"><small class="d-block text-primary">Reserva</small><strong class="text-primary">${reservaTxt}</strong></div></div>
                    <div class="col-4"><div class="p-2 border rounded bg-white"><small class="d-block text-danger">Impuestos</small><strong class="text-danger">${item.porcentaje_impuestos || 0}%</strong></div></div>
                    <div class="col-4"><div class="p-2 border rounded bg-white"><small class="d-block text-success">Bonus Weeks</small><strong class="text-success">${item.bonus_weeks}</strong></div></div>
                </div>
                <div class="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-muted small text-uppercase">Deducciones Aplicadas:</span>
                    <div><span class="badge ${item.deduccion_meseros ? 'bg-secondary' : 'bg-light text-muted border'} me-2">Meseros</span><span class="badge ${item.deduccion_antilavado ? 'bg-secondary' : 'bg-light text-muted border'} me-2">Antilavado</span><span class="badge ${item.deduccion_explore ? 'bg-secondary' : 'bg-light text-muted border'}">Explore</span></div>
                </div>
                ${item.comentarios ? `<div class="mt-4 p-3 bg-light rounded border"><h6 class="text-muted fw-bold small text-uppercase mb-1">Comentarios</h6><p class="mb-0 small text-dark">${item.comentarios}</p></div>` : ''}
            </div>
        `;
    } else { 
        html = `
            <div class="container-fluid px-0">
                <div class="row mb-3 border-bottom pb-3"><div class="col-6"><small class="text-muted d-block text-uppercase fw-bold">Fecha</small><span class="fs-5 fw-bold text-dark">${item.fecha}</span></div><div class="col-6 text-end">${statusBlock}</div></div>
                <div class="row mb-3"><div class="col-12"><h6 class="text-primary fw-bold text-uppercase small mb-2">Datos del Socio</h6><div class="detail-card p-3"><div class="fs-5 fw-bold mb-1">${item.nombre_socio}</div><div class="text-muted">Contrato: <strong>${item.contrato}</strong></div></div></div></div>
                <div class="row mb-3"><div class="col-6"><div class="p-3 border rounded bg-light"><small class="d-block text-muted">Pack Nivel</small><strong>${item.pack_nivel}</strong></div></div><div class="col-6"><div class="p-3 border rounded bg-success-subtle"><small class="d-block text-success">Pago Total</small><strong class="fs-5 text-success">${fm(item.pago_total)}</strong></div></div></div>
                <div class="row"><div class="col-12"><small class="text-muted">Vendedores:</small> <span class="fw-bold">${item.vendedores || '--'}</span></div></div>
            </div>
        `;
    }
    modalBody.innerHTML = html;
    new bootstrap.Modal(document.getElementById('modalDetalle')).show();
}

function iniciarEdicion(type, id) {
    const item = allDataGlobal.find(x => String(x._id || x.id) === String(id) && x.type === type);
    if(!item) return;

    if (type === 'venta' && currentMode !== 'ventas') switchTab('ventas');
    if (type === 'maquila' && currentMode !== 'maquila') switchTab('maquila');

    editId = String(item._id || item.id);

    if (type === 'venta') {
        document.getElementById('txtFecha').value = item.fecha;
        document.getElementById('txtContrato').value = item.contrato || '';
        document.getElementById('txtCliente').value = item.cliente_nombre; 
        
        document.getElementById('cmbNumVendedores').value = item.num_vendedores || 1;
        renderVendedoresInputs(); 
        if (item.vendedores) {
            const nombres = item.vendedores.split(', ');
            nombres.forEach((nom, index) => {
                const input = document.getElementById(`vend_${index+1}`);
                if(input) input.value = nom;
            });
        }

        const chkLiner = document.getElementById('chkLiner');
        if(chkLiner) { chkLiner.checked = (item.es_liner === 1); document.getElementById('txtLinerName').value = item.nombre_liner || ''; toggleLiner(); }
        const chkCasado = document.getElementById('chkCasado');
        if(chkCasado) { chkCasado.checked = (item.es_casado === 1); document.getElementById('txtCasadoName').value = item.nombre_casado || ''; toggleCasado(); }

        document.getElementById('txtMonto').value = item.monto || 0;
        document.getElementById('txtPagoTotal').value = item.pago_total || 0;
        document.getElementById('cmbStatus').value = item.status;
        document.getElementById('cmbPack').value = item.pack_nivel;
        
        if(item.nacionalidad === 'Mexicano') document.getElementById('nacMexicano').checked = true;
        else document.getElementById('nacExtranjero').checked = true;

        if(item.tipo_socio === 'Upgrade') document.getElementById('radioUpgrade').checked = true;
        else document.getElementById('radioNew').checked = true;

        document.getElementById('chkAmex').checked = (item.amex === 1);
        document.getElementById('chkMSI').checked = (item.msi_6 === 1);
        document.getElementById('chkAntilavado').checked = (item.deduccion_antilavado === 1);
        document.getElementById('chkExploreForm').checked = (item.deduccion_explore === 1);
        document.getElementById('chkMeseros').checked = (item.deduccion_meseros === 1);
        
        const chkExplore = document.getElementById('chkExplore');
        chkExplore.checked = (item.es_explore_package === 1);
        toggleExplore(); 

        const chkExploreHoy = document.getElementById('chkExploreHoy');
        chkExploreHoy.checked = (item.explore_es_hoy === 1);
        if(item.explore_es_hoy !== 1) document.getElementById('txtFechaPromesa').value = item.promesa_pago || '';
        toggleExploreHoy();

        document.getElementById('chkReserva').checked = (item.es_reserva === 1); 
        document.getElementById('txtImpuestosPorcentaje').value = item.porcentaje_impuestos || ''; 
        document.getElementById('txtRegalos').value = item.monto_regalos || 0;
        document.getElementById('txtDonativos').value = item.monto_donativos || 0;
        document.getElementById('txtMoveIn').value = item.monto_movein || 0;
        document.getElementById('cmbBonusWeeks').value = item.bonus_weeks || 0;
        
        document.getElementById('txtComentarios').value = item.comentarios || '';
        document.getElementById('txtFechaPendienteVenta').value = item.fecha_pendiente || '';
        togglePendiente('venta');

        document.getElementById('btnGuardarVenta').innerHTML = '<i class="bi bi-pencil-square fs-5"></i><span>ACTUALIZAR DATOS</span>';
        document.getElementById('btnCancelarEditVenta').classList.remove('d-none');
        window.scrollTo(0,0); 
        calcularMatematica(); 

    } else {
        document.getElementById('maqFecha').value = item.fecha;
        document.getElementById('maqContrato').value = item.contrato;
        document.getElementById('maqSocio').value = item.nombre_socio;
        document.getElementById('maqVendedores').value = item.vendedores;
        document.getElementById('maqStatus').value = item.status;
        document.getElementById('maqPack').value = item.pack_nivel;
        document.getElementById('maqPago').value = item.pago_total;
        
        document.getElementById('txtFechaPendienteMaq').value = item.fecha_pendiente || '';
        togglePendiente('maquila');

        document.getElementById('btnGuardarMaquila').innerHTML = '<i class="bi bi-pencil-square fs-5"></i><span>ACTUALIZAR DATOS</span>';
        document.getElementById('btnCancelarEditMaquila').classList.remove('d-none');
        window.scrollTo(0,0);
    }
}

function cancelarEdicion(mode) {
    editId = null;
    if (mode === 'ventas') {
        document.getElementById('frmVenta').reset();
        document.getElementById('txtFecha').valueAsDate = new Date();
        document.getElementById('btnGuardarVenta').innerHTML = '<i class="bi bi-floppy-fill fs-5"></i><span>GUARDAR VENTA</span>';
        document.getElementById('btnCancelarEditVenta').classList.add('d-none');
        
        document.getElementById('cmbNumVendedores').value = 1;
        renderVendedoresInputs();
        toggleLiner();
        toggleCasado();
        toggleExplore(); 
        toggleExploreHoy(); 
        togglePendiente('venta');
        calcularMatematica();
    } else {
        document.getElementById('frmMaquila').reset();
        document.getElementById('maqFecha').valueAsDate = new Date();
        document.getElementById('btnGuardarMaquila').innerHTML = '<i class="bi bi-floppy-fill fs-5"></i><span>GUARDAR PAPERWORK</span>';
        document.getElementById('btnCancelarEditMaquila').classList.add('d-none');
        togglePendiente('maquila');
    }
}

async function guardarVenta() {
    const method = editId ? 'PUT' : 'POST';
    const endpoint = editId ? `/api/ventas/${editId}` : '/api/ventas';

    const numVend = parseInt(document.getElementById('cmbNumVendedores').value);
    let nombresVendedores = [];
    for(let i=1; i<=numVend; i++) {
        const input = document.getElementById(`vend_${i}`);
        if(input) nombresVendedores.push(input.value);
    }
    const vendedoresStr = nombresVendedores.join(', ');

    const payload = {
        cliente: document.getElementById('txtCliente').value,
        contrato: document.getElementById('txtContrato').value,
        monto: parseFloat(document.getElementById('txtMonto').value),
        status: document.getElementById('cmbStatus').value,
        fecha: document.getElementById('txtFecha').value,
        promesa: document.getElementById('chkExploreHoy').checked ? '' : document.getElementById('txtFechaPromesa').value,
        usuario: "Tanya",
        tipo_socio: document.querySelector('input[name="tipoSocio"]:checked').value,
        pack_nivel: document.getElementById('cmbPack').value,
        deduccion_antilavado: document.getElementById('chkAntilavado').checked ? 1 : 0,
        deduccion_explore: document.getElementById('chkExploreForm').checked ? 1 : 0,
        deduccion_meseros: document.getElementById('chkMeseros').checked ? 1 : 0,
        es_explore_package: document.getElementById('chkExplore').checked ? 1 : 0,
        explore_es_hoy: document.getElementById('chkExploreHoy').checked ? 1 : 0,
        amex: document.getElementById('chkAmex').checked ? 1 : 0,
        msi_6: document.getElementById('chkMSI').checked ? 1 : 0,
        num_vendedores: numVend,
        vendedores: vendedoresStr, 
        es_liner: document.getElementById('chkLiner').checked ? 1 : 0,
        nombre_liner: document.getElementById('txtLinerName').value,
        es_casado: document.getElementById('chkCasado').checked ? 1 : 0,
        nombre_casado: document.getElementById('txtCasadoName').value,
        es_reserva: document.getElementById('chkReserva').checked ? 1 : 0,
        porcentaje_impuestos: parseFloat(document.getElementById('txtImpuestosPorcentaje').value) || 0,
        monto_regalos: parseFloat(document.getElementById('txtRegalos').value) || 0,
        monto_donativos: parseFloat(document.getElementById('txtDonativos').value) || 0,
        monto_movein: parseFloat(document.getElementById('txtMoveIn').value) || 0,
        bonus_weeks: parseInt(document.getElementById('cmbBonusWeeks').value) || 0,
        nacionalidad: document.querySelector('input[name="nacionalidad"]:checked').value,
        pago_total: parseFloat(document.getElementById('txtPagoTotal').value) || 0,
        comentarios: document.getElementById('txtComentarios').value,
        fecha_pendiente: document.getElementById('txtFechaPendienteVenta').value
    };

    if (!payload.cliente || !payload.monto) { Swal.fire('Atención', 'Falta el nombre del Cliente o el Monto.', 'warning'); return; }
    await enviarDatos(endpoint, method, payload, 'ventas');
}

async function guardarMaquila() {
    const method = editId ? 'PUT' : 'POST';
    const endpoint = editId ? `/api/maquilas/${editId}` : '/api/maquilas';

    const payload = {
        fecha: document.getElementById('maqFecha').value,
        contrato: document.getElementById('maqContrato').value,
        nombre_socio: document.getElementById('maqSocio').value,
        vendedores: document.getElementById('maqVendedores').value,
        status: document.getElementById('maqStatus').value,
        pack_nivel: document.getElementById('maqPack').value,
        pago_total: parseFloat(document.getElementById('maqPago').value) || 0,
        fecha_pendiente: document.getElementById('txtFechaPendienteMaq').value
    };

    if (!payload.nombre_socio || !payload.pago_total) { Swal.fire('Atención', 'Falta el Nombre del Socio o el Pago Total.', 'warning'); return; }
    await enviarDatos(endpoint, method, payload, 'maquila');
}

async function enviarDatos(url, method, data, mode) {
    try {
        const res = await fetch(BASE_URL + url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': SECRET_TOKEN },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.message) {
            Swal.fire({ icon: 'success', title: editId ? 'Registro Actualizado' : 'Registro Guardado', showConfirmButton: false, timer: 1500 });
            cancelarEdicion(mode); 
            cargarDatosUnificados(); 
        } else { Swal.fire('Error', result.error, 'error'); }
    } catch (e) { Swal.fire('Error', 'Problema de conexión', 'error'); }
}

function eliminarItem(type, id) {
    if (!id || id === 'undefined') {
        Swal.fire('Error Técnico', 'ID de registro no válido.', 'error');
        return;
    }

    const endpointType = type === 'venta' ? 'ventas' : 'maquilas';

    Swal.fire({
        title: '¿Eliminar registro?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`${BASE_URL}/api/${endpointType}/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': SECRET_TOKEN }
                });
                
                if (res.ok) {
                    Swal.fire('Eliminado', 'El registro ha sido borrado.', 'success');
                    cargarDatosUnificados(); 
                } else {
                    Swal.fire('Error', 'El servidor rechazó la eliminación (Código: ' + res.status + ')', 'error');
                }
            } catch (e) {
                console.error("Falla al conectar con el servidor:", e);
                Swal.fire('Error', 'Falla de red o conexión perdida.', 'error');
            }
        }
    });
}