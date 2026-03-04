// --- CONFIGURACIÓN GLOBAL ---
const BASE_URL = '';
let currentMode = 'ventas'; 
let editId = null;

let allDataGlobal = []; 
let filteredData = [];  
let currentPage = 1;
const itemsPerPage = 10;

// CIRUGÍA: Variables dinámicas del usuario autenticado
let currentUserNombre = "";

// --- INICIALIZACIÓN Y GOOGLE AUTH ---
document.addEventListener('DOMContentLoaded', () => {
    const tokenGuardado = localStorage.getItem('paycheckToken');
    const nombreGuardado = localStorage.getItem('paycheckUserName');

    if (tokenGuardado && nombreGuardado) {
        currentUserNombre = nombreGuardado;
        mostrarDashboard();
    } else {
        // Inicializar el botón de Google (AQUÍ DEBES PEGAR TU CLIENT ID)
        google.accounts.id.initialize({
            client_id: "45355639696-ed54unj8jme9cfdehcu9o1mu700occc2.apps.googleusercontent.com", 
            callback: handleCredentialResponse
        });
        google.accounts.id.renderButton(
            document.getElementById("buttonDiv"),
            { theme: "outline", size: "large", shape: "pill", width: 280 }
        );
    }
});

// Función que se ejecuta cuando el usuario se loguea exitosamente en Google
function handleCredentialResponse(response) {
    const token = response.credential;
    
    // Decodificamos el pase de Google para leer el nombre del usuario
    try {
        const payloadBase64 = token.split('.')[1];
        const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(decodedJson);
        
        // Guardamos su primer nombre (ej. "Oscar", "Tanya")
        currentUserNombre = (payload.given_name || payload.name || "").toLowerCase();
        
        localStorage.setItem('paycheckToken', token);
        localStorage.setItem('paycheckUserName', currentUserNombre);
        
        mostrarDashboard();
    } catch (e) {
        console.error("Error decodificando token", e);
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
    localStorage.removeItem('paycheckUserName');
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

function toggleCasado() {
    const chk = document.getElementById('chkCasado');
    const divOpts = document.getElementById('divCasadoOptions');
    if(chk && divOpts) {
        chk.checked ? divOpts.classList.remove('d-none') : divOpts.classList.add('d-none');
        calcularMatematica();
    }
}

function toggleTipoPagoMaquila() {
    const isPack = document.getElementById('maqTipoPack').checked;
    const packContainer = document.getElementById('maqPackContainer');
    const pctContainer = document.getElementById('maqPorcentajeContainer');
    
    if(isPack) {
        packContainer.classList.remove('d-none');
        pctContainer.classList.add('d-none');
    } else {
        packContainer.classList.add('d-none');
        pctContainer.classList.remove('d-none');
    }
    calcularMaquila();
}

// --- LÓGICA MATEMÁTICA PRINCIPAL ---

function calcularMiVolumen(item) {
    if (item.type !== 'venta') return 0;
    
    let monto = parseFloat(item.monto) || 0;
    let numVend = parseInt(item.num_vendedores) || 1;
    let liner = parseInt(item.es_liner) === 1 ? 1 : 0;
    
    let partesTotales = numVend + liner;
    let volumenPorPersona = monto / partesTotales; 

    let esCasado = parseInt(item.es_casado) === 1;
    let tipoCasado = item.tipo_casado || 'Comisión'; 
    
    // CIRUGÍA: Ya no está hardcodeado a "Tanya". Toma el nombre del usuario de Google.
    let nombreUsuario = currentUserNombre; 
    let listaVendedores = (item.vendedores || "").toLowerCase();
    let nombreLiner = (item.nombre_liner || "").toLowerCase();
    
    let participeDirectamente = listaVendedores.includes(nombreUsuario) || nombreLiner.includes(nombreUsuario);
    let miVolumen = 0;

    if (participeDirectamente) {
        miVolumen = volumenPorPersona;
        if (esCasado && (tipoCasado === 'Volumen' || tipoCasado === 'Ambas')) {
            miVolumen = miVolumen / 2;
        }
    } else {
        if (esCasado && (tipoCasado === 'Volumen' || tipoCasado === 'Ambas')) {
            miVolumen = volumenPorPersona / 2;
        } else {
            miVolumen = 0;
        }
    }
    
    return miVolumen;
}

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
        const tipoCasado = document.getElementById('cmbTipoCasado').value;
        if (tipoCasado === 'Comisión' || tipoCasado === 'Ambas') {
            miParteDelPorcentaje = miParteDelPorcentaje / 2;
        }
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

    let deduccionReserva = 0;
    if (document.getElementById('chkReserva').checked) {
        deduccionReserva = (ingresoBrutoIndividual * 0.10);
    }

    let gastosAntesImpuestos = 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtRegalos').value) || 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtDonativos').value) || 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtMoveIn').value) || 0;
    
    const bonusWeeks = parseInt(document.getElementById('cmbBonusWeeks').value) || 0;
    gastosAntesImpuestos += (bonusWeeks * 20);

    let miParteGastosAntes = gastosAntesImpuestos / numVendedores;

    let subtotalGravable = ingresoBrutoIndividual - deduccionReserva - miParteGastosAntes;

    const impuestoPorcentaje = parseFloat(document.getElementById('txtImpuestosPorcentaje').value) || 0;
    let deduccionImpuestos = 0;
    if (impuestoPorcentaje > 0 && subtotalGravable > 0) {
        deduccionImpuestos = subtotalGravable * (impuestoPorcentaje / 100);
    }

    let subtotalPostImpuestos = subtotalGravable - deduccionImpuestos;

    let gastosDespuesImpuestos = 20; 
    if (document.getElementById('chkAntilavado').checked) gastosDespuesImpuestos += 10;
    if (document.getElementById('chkExploreForm').checked) gastosDespuesImpuestos += 10;

    let miParteGastosDespues = gastosDespuesImpuestos / numVendedores;
    let pagoNetoFinal = subtotalPostImpuestos - miParteGastosDespues;
    
    document.getElementById('txtPagoTotal').value = pagoNetoFinal.toFixed(2);
}

function calcularMaquila() {
    const isPack = document.getElementById('maqTipoPack').checked;
    let importeBase = 0;

    if (isPack) {
        const pack = document.getElementById('maqPack').value;
        if (pack === 'Full') importeBase = 150.88;
        else if (pack === '1/2') importeBase = 150.88 / 2; // 75.44
    } else {
        const vol = parseFloat(document.getElementById('maqVolumen').value) || 0;
        const pct = parseFloat(document.getElementById('maqPorcentaje').value) || 0;
        importeBase = vol * (pct / 100);
    }

    let deduccionReserva = 0;
    if (document.getElementById('maqReserva').checked) {
        deduccionReserva = importeBase * 0.10;
    }

    const impPct = parseFloat(document.getElementById('maqImpuestos').value) || 0;
    let deduccionImpuestos = importeBase * (impPct / 100);

    let pagoNeto = importeBase - deduccionReserva - deduccionImpuestos;
    document.getElementById('maqPago').value = pagoNeto.toFixed(2);
}


// --- KPI: CÁLCULOS EN FRONTEND ---
function actualizarTableroFinanciero(inicio = null, fin = null) {
    const lblTotal = document.getElementById('lblTotalCobrar');
    const lblVolumen = document.getElementById('lblTotalVolumen');
    const lblExplore = document.getElementById('lblTotalExplore');
    const lblRango = document.getElementById('lblRangoFechas');

    if (!inicio || !fin) {
        if (lblTotal) lblTotal.innerText = '$0.00';
        if (lblVolumen) lblVolumen.innerText = '$0.00';
        if (lblExplore) lblExplore.innerText = '$0.00';
        if (lblRango) lblRango.innerText = 'Selecciona un rango de fechas';
        return; 
    }

    let granTotalComision = 0;
    let granTotalVolumen = 0;
    let granTotalExplore = 0;

    filteredData.forEach(item => {
        if (item.status === 'Cerrada') {
            granTotalComision += (parseFloat(item.pago_total) || 0);

            if (item.type === 'venta') {
                granTotalVolumen += calcularMiVolumen(item);

                let esExplore = parseInt(item.es_explore_package) === 1;
                let esExploreHoy = parseInt(item.explore_es_hoy) === 1;

                if (esExplore && esExploreHoy) {
                    let numVend = parseInt(item.num_vendedores) || 1;
                    let bonoNeto = 225 * 0.77; 
                    let miBonoExplore = bonoNeto / numVend; 
                    granTotalExplore += miBonoExplore;
                }
            }
        }
    });

    if (lblTotal) lblTotal.innerText = `$${granTotalComision.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (lblVolumen) lblVolumen.innerText = `$${granTotalVolumen.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (lblExplore) lblExplore.innerText = `$${granTotalExplore.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (lblRango) lblRango.innerText = `Del ${inicio} al ${fin}`;
}

// --- CARGA DE DATOS ---
async function cargarDatosUnificados() {
    try {
        const resVentas = await fetch(`${BASE_URL}/api/ventas`, { headers: { 'Authorization': localStorage.getItem('paycheckToken') } });
        if (resVentas.status === 403) { cerrarSesion(); return; }
        const jsonVentas = await resVentas.json();
        
        const resMaquilas = await fetch(`${BASE_URL}/api/maquilas`, { headers: { 'Authorization': localStorage.getItem('paycheckToken') } });
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
        verificarAlertas();

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

function buscarContrato() {
    const query = document.getElementById('txtBuscador').value.toLowerCase().trim();
    
    if (query === '') {
        if (document.getElementById('filtroInicio').value && document.getElementById('filtroFin').value) {
            aplicarFiltro();
        } else {
            filteredData = allDataGlobal;
            currentPage = 1;
            renderTable();
        }
        return;
    }

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
    buscarContrato(); 
}

function cambiarPagina(direction) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const newPage = parseInt(currentPage) + parseInt(direction);

    if (newPage > 0 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
    }
}

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
        
        let exploreStar = (item.type === 'venta' && item.es_explore_package === 1) ? '<i class="bi bi-star-fill text-info ms-1" style="font-size: 0.85rem;" title="Explore Package"></i>' : '';
        
        let miVolumenDisplay = item.type === 'venta' ? calcularMiVolumen(item) : 0;
        let miVolFormatted = miVolumenDisplay.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        let pagoTotalFormatted = (parseFloat(item.pago_total) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        let esPorcentaje = item.tipo_pago === 'porcentaje' || (parseFloat(item.maq_volumen) > 0);
        let volMaquilaFormatted = (parseFloat(item.maq_volumen) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        if (item.type === 'venta') {
            const tipoSocioDisplay = item.tipo_socio ? item.tipo_socio : 'N/A';
            detalleHTML = `
                <div>${iconType} <span class="fw-bold text-dark">${item.cliente_nombre || '--'}</span></div>
                <div class="small text-muted">${item.nacionalidad || ''} | ${tipoSocioDisplay}</div> 
            `;
            montosCombinadosPC = `
                <div class="fw-bold text-success" title="Total del Contrato: $${(item.monto || 0).toLocaleString()}">$${miVolFormatted} <span class="small text-muted fw-normal">Mi Vol.</span></div>
                <div class="fw-bold text-primary mt-1 pt-1 border-top" style="font-size:0.95rem">$${pagoTotalFormatted} <span class="small text-muted fw-normal">Neto</span></div>
            `;
        } else {
            detalleHTML = `
                <div>${iconType} <span class="fw-bold text-dark">${item.nombre_socio || '--'}</span></div>
                <div class="small text-muted">${esPorcentaje ? (item.maq_porcentaje || 0) + '% del Vol' : 'Pack: ' + (item.pack_nivel || 'None')}</div>
            `;
            montosCombinadosPC = `
                <div class="fw-bold text-info" style="font-size:0.85rem">${esPorcentaje ? '$' + volMaquilaFormatted + ' <span class="small text-muted fw-normal">Vol.</span>' : '<span class="text-muted small">--</span>'}</div>
                <div class="fw-bold text-success mt-1 pt-1 border-top">$${pagoTotalFormatted} <span class="small text-muted fw-normal">Total</span></div>
            `;
        }

        let mobileCol = `
            <div class="d-md-none d-flex flex-column align-items-end justify-content-center">
                ${item.status !== 'Cerrada' ? `<span class="badge ${badgeColor} mb-1" style="font-size:0.65rem;">${item.status}</span>` : ''}
                
                ${item.type === 'venta' 
                    ? `<span class="fw-bold text-info" style="font-size: 0.85rem;" title="Total Contrato: $${(item.monto || 0).toLocaleString()}">Mi Vol: $${miVolFormatted}</span>` 
                    : (esPorcentaje ? `<span class="fw-bold text-info" style="font-size: 0.85rem;">Vol: $${volMaquilaFormatted}</span>` : '')
                }
                <span class="fw-bold text-success" style="font-size: 1.25rem;" title="Comisión / Pago Neto">$${pagoTotalFormatted}</span>
                
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

       const fila = `
            <tr>
                <td class="align-middle">
                    <div class="fw-bold text-dark">${item.fecha || '--'}</div>
                    <div class="small text-muted">#${item.contrato || 'N/A'}${exploreStar}</div>
                    ${item.type === 'venta' ? `<div class="d-md-none text-secondary fw-bold mt-1" style="font-size: 0.75rem;">${item.nacionalidad || ''}</div>` : ''}
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

    const fm = (val) => val ? `$${parseFloat(val).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '$0.00';
    const badgeStatus = item.status === 'Cerrada' ? 'bg-success' : (item.status === 'Caída' || item.status === 'Cancelada' ? 'bg-danger' : 'bg-warning text-dark');

    let statusBlock = `<span class="badge ${badgeStatus} fs-6 mb-1">${item.status}</span>`;
    if(item.status === 'Pendiente' && item.fecha_pendiente) {
        statusBlock += `<div class="text-warning fw-bold small mt-1"><i class="bi bi-calendar-event me-1"></i>Cierre: ${item.fecha_pendiente}</div>`;
    }

    let html = '';
    if (type === 'venta') { 
        let exploreIndicator = '<span class="text-muted small">No incluye Explore Package</span>';
        if (item.es_explore_package === 1) {
            const fechaVal = item.promesa_pago || item.promesa || '';
            let textoFecha = (item.explore_es_hoy === 1) ? 'HOY' : fechaVal;
            exploreIndicator = `<div class="alert alert-info py-1 px-2 mb-0 small fw-bold"><i class="bi bi-star-fill me-1"></i>EXPLORE: ${textoFecha}</div>`;
        }
        const reservaTxt = (item.es_reserva === 1) ? '10%' : 'No';
        
        let miVolumen = calcularMiVolumen(item);

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
                        <div class="col-4 border-end border-success-subtle">
                            <small class="d-block text-success fw-bold text-uppercase">Mi Volumen</small>
                            <span class="fs-4 fw-bold text-dark">${fm(miVolumen)}</span>
                            <div class="small text-muted mt-1" style="font-size: 0.75rem; line-height: 1;">Total: ${fm(item.monto)}</div>
                        </div>
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
        let calcInfo = '';
        let esPorcentaje = item.tipo_pago === 'porcentaje' || (parseFloat(item.maq_volumen) > 0);
        
        if (esPorcentaje) {
            calcInfo = `<span class="badge bg-info text-dark mb-1">Porcentaje</span><br>Base: ${item.maq_porcentaje || 0}% de $${(parseFloat(item.maq_volumen) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        } else {
            calcInfo = `<span class="badge bg-primary mb-1">Pack</span><br>Nivel: ${item.pack_nivel || 'None'}`;
        }

        html = `
            <div class="container-fluid px-0">
                <div class="row mb-3 border-bottom pb-3 align-items-center">
                    <div class="col-6"><small class="text-muted d-block text-uppercase fw-bold">Fecha de Ingreso</small><span class="fs-5 fw-bold text-dark">${item.fecha}</span></div>
                    <div class="col-6 text-end">${statusBlock}</div>
                </div>
                <div class="row mb-3">
                    <div class="col-12">
                        <h6 class="text-primary fw-bold text-uppercase small mb-2">Datos del Socio</h6>
                        <div class="detail-card p-3 shadow-sm border border-secondary-subtle">
                            <div class="fs-5 fw-bold mb-1">${item.nombre_socio}</div>
                            <div class="text-muted">Contrato: <strong>${item.contrato}</strong></div>
                        </div>
                    </div>
                </div>
                <h6 class="text-primary fw-bold text-uppercase small mb-2 mt-4">Análisis de Pago</h6>
                <div class="row mb-3 g-2">
                    <div class="col-md-6 mb-2">
                        <div class="p-3 border rounded bg-light h-100 shadow-sm">
                            <small class="d-block text-muted text-uppercase fw-bold mb-1">Cálculo Base</small>
                            <strong>${calcInfo}</strong>
                        </div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <div class="p-3 border border-success-subtle rounded bg-success-subtle h-100 shadow-sm text-center">
                            <small class="d-block text-success text-uppercase fw-bold mb-1">Pago Neto</small>
                            <strong class="fs-3 text-success">${fm(item.pago_total)}</strong>
                        </div>
                    </div>
                </div>
                <div class="row mb-3">
                    <div class="col-12">
                        <small class="text-muted fw-bold text-uppercase d-block mb-2">Deducciones Aplicadas</small>
                        <div class="d-flex gap-3">
                            <span class="badge ${item.maq_reserva === 1 ? 'bg-dark' : 'bg-light text-muted border'} px-3 py-2">Fondo Reserva (10%)</span>
                            <span class="badge ${(item.maq_impuestos || 0) > 0 ? 'bg-danger' : 'bg-light text-muted border'} px-3 py-2">Impuestos: ${item.maq_impuestos || 0}%</span>
                        </div>
                    </div>
                </div>
                <div class="row mt-4 border-top pt-3">
                    <div class="col-12"><small class="text-muted fw-bold text-uppercase">Vendedores Involucrados:</small> <span class="fw-bold text-dark d-block mt-1">${item.vendedores || 'No especificados'}</span></div>
                </div>
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
        if(chkCasado) { 
            chkCasado.checked = (item.es_casado === 1); 
            document.getElementById('txtCasadoName').value = item.nombre_casado || ''; 
            document.getElementById('cmbTipoCasado').value = item.tipo_casado || 'Comisión'; 
            toggleCasado(); 
        }

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
        
        if(item.explore_es_hoy !== 1) {
            document.getElementById('txtFechaPromesa').value = item.promesa_pago || item.promesa || '';
        }
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
        document.getElementById('frmVenta').scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        calcularMatematica(); 

    } else {
        document.getElementById('maqFecha').value = item.fecha;
        document.getElementById('maqContrato').value = item.contrato;
        document.getElementById('maqSocio').value = item.nombre_socio;
        document.getElementById('maqVendedores').value = item.vendedores;
        document.getElementById('maqStatus').value = item.status;
        document.getElementById('maqPack').value = item.pack_nivel || 'None';
        
        let esPorcentaje = item.tipo_pago === 'porcentaje' || (parseFloat(item.maq_volumen) > 0);
        if(esPorcentaje) {
            document.getElementById('maqTipoPorcentaje').checked = true;
        } else {
            document.getElementById('maqTipoPack').checked = true;
        }
        toggleTipoPagoMaquila();

        document.getElementById('maqVolumen').value = item.maq_volumen || '';
        document.getElementById('maqPorcentaje').value = item.maq_porcentaje || '';
        document.getElementById('maqReserva').checked = (item.maq_reserva === 1);
        document.getElementById('maqImpuestos').value = item.maq_impuestos || '';

        document.getElementById('txtFechaPendienteMaq').value = item.fecha_pendiente || '';
        togglePendiente('maquila');
        
        calcularMaquila(); 

        document.getElementById('btnGuardarMaquila').innerHTML = '<i class="bi bi-pencil-square fs-5"></i><span>ACTUALIZAR DATOS</span>';
        document.getElementById('btnCancelarEditMaquila').classList.remove('d-none');
        document.getElementById('frmMaquila').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        
        const divCasadoOpts = document.getElementById('divCasadoOptions');
        if(divCasadoOpts) divCasadoOpts.classList.add('d-none');
        document.getElementById('cmbTipoCasado').value = 'Comisión';

        toggleExplore(); 
        toggleExploreHoy(); 
        togglePendiente('venta');
        calcularMatematica();
    } else {
        document.getElementById('frmMaquila').reset();
        document.getElementById('maqFecha').valueAsDate = new Date();
        document.getElementById('btnGuardarMaquila').innerHTML = '<i class="bi bi-floppy-fill fs-5"></i><span>GUARDAR PAPERWORK</span>';
        document.getElementById('btnCancelarEditMaquila').classList.add('d-none');
        document.getElementById('maqTipoPack').checked = true;
        toggleTipoPagoMaquila();
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

    const valorFechaPromesa = document.getElementById('chkExploreHoy').checked ? '' : document.getElementById('txtFechaPromesa').value;

    const payload = {
        cliente: document.getElementById('txtCliente').value,
        contrato: document.getElementById('txtContrato').value,
        monto: parseFloat(document.getElementById('txtMonto').value) || 0,
        status: document.getElementById('cmbStatus').value,
        fecha: document.getElementById('txtFecha').value,
        promesa: valorFechaPromesa,
        promesa_pago: valorFechaPromesa,
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
        tipo_casado: document.getElementById('cmbTipoCasado').value,
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

    const oldItem = editId ? allDataGlobal.find(x => String(x._id || x.id) === String(editId) && x.type === 'venta') : null;

    if (payload.status === 'Caída' || payload.status === 'Cancelada') {
        payload.pago_total = 0; 
        if (!payload.monto && oldItem) {
            payload.monto = oldItem.monto;
        }
    } else if (!payload.monto) {
        Swal.fire('Atención', 'Falta ingresar el Monto de la venta.', 'warning'); 
        return;
    }

    if (!payload.cliente) { 
        Swal.fire('Atención', 'Falta el nombre del Cliente.', 'warning'); 
        return; 
    }

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
        fecha_pendiente: document.getElementById('txtFechaPendienteMaq').value,
        
        tipo_pago: document.getElementById('maqTipoPack').checked ? 'pack' : 'porcentaje',
        maq_volumen: parseFloat(document.getElementById('maqVolumen').value) || 0,
        maq_porcentaje: parseFloat(document.getElementById('maqPorcentaje').value) || 0,
        maq_reserva: document.getElementById('maqReserva').checked ? 1 : 0,
        maq_impuestos: parseFloat(document.getElementById('maqImpuestos').value) || 0
    };

    const oldItem = editId ? allDataGlobal.find(x => String(x._id || x.id) === String(editId) && x.type === 'maquila') : null;

    if (payload.status === 'Cancelada') {
        payload.pago_total = 0; 
        
        if (oldItem) {
            let esViejoPorcentaje = payload.tipo_pago === 'porcentaje' || oldItem.tipo_pago === 'porcentaje' || parseFloat(oldItem.maq_volumen) > 0;
            
            if (esViejoPorcentaje) {
                payload.tipo_pago = 'porcentaje';
                payload.maq_volumen = payload.maq_volumen || oldItem.maq_volumen || 0;
                payload.maq_porcentaje = payload.maq_porcentaje || oldItem.maq_porcentaje || 0;
            } else {
                payload.tipo_pago = 'pack';
                payload.pack_nivel = (payload.pack_nivel && payload.pack_nivel !== 'None') ? payload.pack_nivel : (oldItem.pack_nivel || 'None');
            }
        }
    } else if (!payload.pago_total) {
        Swal.fire('Atención', 'Revisa los montos y cálculos. El pago no puede quedar vacío.', 'warning'); 
        return;
    }

    if (!payload.nombre_socio) { 
        Swal.fire('Atención', 'Falta el Nombre del Socio.', 'warning'); 
        return; 
    }

    await enviarDatos(endpoint, method, payload, 'maquila');
}

async function enviarDatos(url, method, data, mode) {
    try {
        const res = await fetch(BASE_URL + url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('paycheckToken') },
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
                    headers: { 'Authorization': localStorage.getItem('paycheckToken') }
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

function verificarAlertas() {
    const container = document.getElementById('alertasContainer');
    const lista = document.getElementById('alertasLista');
    if (!container || !lista) return;

    let alertasHTML = '';
    let totalEnElAire = 0;
    let hayAlertas = false;

    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    filteredData.forEach(item => {
        if (item.status === 'Pendiente' && item.fecha_pendiente) {
            let [yyyy, mm, dd] = item.fecha_pendiente.split('-');
            let fechaPend = new Date(yyyy, mm - 1, dd);
            fechaPend.setHours(0,0,0,0);

            let diffTime = hoy.getTime() - fechaPend.getTime();
            let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays % 7 === 0) {
                hayAlertas = true;
                let monto = parseFloat(item.pago_total) || 0;
                totalEnElAire += monto;
                alertasHTML += generarCardAlerta(item.type, item, monto, diffDays === 0 ? 'HOY' : `Hace ${diffDays} días`);
            }
        }

        const fechaPromesaString = item.promesa_pago || item.promesa; 
        
        if (item.type === 'venta' && parseInt(item.es_explore_package) === 1 && parseInt(item.explore_es_hoy) === 0 && fechaPromesaString) {
            let [yyyy, mm, dd] = fechaPromesaString.split('-');
            let fechaPromesa = new Date(yyyy, mm - 1, dd);
            fechaPromesa.setHours(0,0,0,0);

            let diffTime = hoy.getTime() - fechaPromesa.getTime();
            let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays % 7 === 0) {
                hayAlertas = true;
                let numVend = parseInt(item.num_vendedores) || 1;
                let bonoNeto = 225 * 0.77;
                let miBono = bonoNeto / numVend;
                totalEnElAire += miBono;
                
                let textoDias = diffDays === 0 ? 'HOY' : `Hace ${diffDays} días`;
                alertasHTML += generarCardAlerta('explore', item, miBono, textoDias);
            }
        }
    });

    if (hayAlertas) {
        let tituloAlerta = `<h5 class="fw-bold text-danger mb-3" style="letter-spacing: -0.5px;"><i class="bi bi-exclamation-triangle-fill me-2 fs-4"></i>Atención: Tienes $${totalEnElAire.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} USD en el aire esperando a ser cobrados.</h5>`;

        lista.innerHTML = `<div class="card p-3 p-md-4 border border-danger shadow-lg" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 24px;">
                            ${tituloAlerta}
                            <div class="d-flex flex-column gap-3">${alertasHTML}</div>
                           </div>`;
        container.classList.remove('d-none');
    } else {
        container.classList.add('d-none');
        lista.innerHTML = '';
    }
}

function generarCardAlerta(alertaType, item, monto, tiempoText) {
    const fm = (val) => `$${val.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    const id = item._id || item.id;

    if (alertaType === 'venta' || alertaType === 'maquila') {
        let isMaq = alertaType === 'maquila';
        let badgeClass = isMaq ? 'bg-secondary' : 'bg-danger';
        let badgeText = isMaq ? 'Paperwork Pendiente' : 'Venta Pendiente';
        
        return `
            <div class="bg-white p-3 rounded-4 shadow-sm border ${isMaq ? 'border-secondary-subtle' : 'border-danger-subtle'} d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                    <span class="badge ${badgeClass} mb-1 text-uppercase" style="letter-spacing:1px;">${badgeText}</span>
                    <h6 class="fw-bold text-dark mb-0 fs-5">${item.cliente_nombre || item.nombre_socio}</h6>
                    <small class="text-danger fw-bold"><i class="bi bi-calendar-x me-1"></i>Vencimiento de Cierre: ${tiempoText}</small>
                </div>
                <div class="text-md-end d-flex flex-column align-items-md-end">
                    <span class="fs-4 fw-bold text-success">${fm(monto)}</span>
                    <button class="btn btn-sm btn-outline-dark mt-1 rounded-pill fw-bold shadow-sm px-3" onclick="iniciarEdicion('${alertaType}', '${id}')">
                        <i class="bi bi-pencil-fill me-1"></i>Ir a Editar a Cerrada
                    </button>
                </div>
            </div>
        `;
    } else if (alertaType === 'explore') {
        return `
            <div class="bg-white p-3 rounded-4 shadow-sm border border-warning d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                    <span class="badge bg-warning text-dark mb-1 text-uppercase" style="letter-spacing:1px;">Explore Package</span>
                    <h6 class="fw-bold text-dark mb-0 fs-5">${item.cliente_nombre}</h6>
                    <small class="text-warning-emphasis fw-bold"><i class="bi bi-calendar-check me-1"></i>Promesa: ${tiempoText}</small>
                </div>
                <div class="text-md-end d-flex flex-column align-items-md-end">
                    <span class="fs-4 fw-bold text-primary">${fm(monto)}</span>
                    <div class="btn-group mt-2 shadow-sm rounded-pill w-100">
                        <button class="btn btn-sm btn-success fw-bold px-3 rounded-start-pill w-50" onclick="resolverExplore('${id}', 'pagado')"><i class="bi bi-check-circle-fill me-1"></i>Paid</button>
                        <button class="btn btn-sm btn-dark fw-bold px-3 rounded-end-pill w-50" onclick="resolverExplore('${id}', 'caido')"><i class="bi bi-x-circle-fill me-1"></i>Failed</button>
                    </div>
                </div>
            </div>
        `;
    }
}

async function resolverExplore(id, accion) {
    const item = allDataGlobal.find(x => String(x._id || x.id) === String(id) && x.type === 'venta');
    if(!item) return;

    let payload = { ...item };
    
    if (accion === 'pagado') {
        payload.explore_es_hoy = 1; 
        payload.promesa = ''; 
        payload.promesa_pago = ''; 
        if (payload.status === 'Pendiente') {
            payload.status = 'Cerrada';
        }
    } else if (accion === 'caido') {
        payload.status = 'Caída';
        payload.pago_total = 0;
        payload.promesa = '';
        payload.promesa_pago = '';
    }

    try {
        Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
        
        const res = await fetch(`${BASE_URL}/api/ventas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('paycheckToken') },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.message) {
            Swal.fire({ icon: 'success', title: accion === 'pagado' ? '¡Cobrado y Cerrado!' : 'Marcado como Caída', showConfirmButton: false, timer: 1500 });
            cargarDatosUnificados(); 
        } else { 
            Swal.fire('Error', result.error, 'error'); 
        }
    } catch (e) { 
        Swal.fire('Error', 'Problema de conexión', 'error'); 
    }
}