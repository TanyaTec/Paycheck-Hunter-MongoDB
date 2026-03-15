async function cargarDatosUnificados() {
    try {
        const resVentas = await fetch(`${BASE_URL}/api/ventas`, { headers: { 'Authorization': localStorage.getItem('paycheckToken') } });
        if (resVentas.status === 403) { cerrarSesion(); return; }
        const jsonVentas = await resVentas.json();
        
        const resMaquilas = await fetch(`${BASE_URL}/api/maquilas`, { headers: { 'Authorization': localStorage.getItem('paycheckToken') } });
        const jsonMaquilas = await resMaquilas.json();

        const dataVRaw = jsonVentas.data || [];
        const dataM = jsonMaquilas.data || [];

        // CIRUGÍA DE EXTRACCIÓN: Filtramos a los infiltrados de Cash
        const isCash = (v) => (v.cliente === 'BONO CASH' || v.cliente_nombre === 'BONO CASH');
        
        // Ventas puras en dólares
        const dataV = dataVRaw.filter(v => !isCash(v));
        // Bonos aislados en pesos
        const dataCashInVentas = dataVRaw.filter(v => isCash(v));
        
        const ventasEtiquetadas = dataV.map(v => ({ ...v, type: 'venta' }));
        const maquilasEtiquetadas = dataM.map(m => ({ ...m, type: 'maquila' }));
        
        // Le devolvemos su identidad de "bono_cash" y recuperamos los pesos del escondite
        const cashEtiquetados = dataCashInVentas.map(c => ({ 
            ...c, 
            type: 'bono_cash',
            monto_mxn: parseFloat(c.monto) || 0 
        }));

        // Unimos todos para la lógica interna
        allDataGlobal = [...ventasEtiquetadas, ...maquilasEtiquetadas, ...cashEtiquetados];
        allDataGlobal.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        filteredData = allDataGlobal; 
        currentPage = 1;
        
        renderTable(); 
        actualizarTotalesMesActual(); 
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
        if (document.getElementById('filtroInicio').value && document.getElementById('filtroFin').value) { aplicarFiltro(); } 
        else { filteredData = allDataGlobal; currentPage = 1; renderTable(); }
        return;
    }

    // Buscamos solo en Ventas y Maquilas (Ignoramos el Cash porque no es un contrato buscable)
    filteredData = allDataGlobal.filter(item => {
        if (item.type === 'bono_cash') return false; // Ignora los bonos cash en la búsqueda
        
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
    // Calculamos el total de páginas ignorando los bonos cash en el conteo de la tabla
    const dataVisualizable = filteredData.filter(item => item.type !== 'bono_cash');
    const totalPages = Math.ceil(dataVisualizable.length / itemsPerPage);
    const newPage = parseInt(currentPage) + parseInt(direction);
    if (newPage > 0 && newPage <= totalPages) { currentPage = newPage; renderTable(); }
}

function renderTable() {
    const tbody = document.getElementById('tablaResultados');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // Excluimos los bonos cash de la tabla de contratos
    const dataParaTabla = filteredData.filter(item => item.type !== 'bono_cash');
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = dataParaTabla.slice(startIndex, endIndex);

    document.getElementById('pageInfo').innerText = `Mostrando ${dataParaTabla.length > 0 ? startIndex + 1 : 0} - ${Math.min(endIndex, dataParaTabla.length)} de ${dataParaTabla.length}`;
    document.getElementById('btnPrev').disabled = currentPage === 1;
    document.getElementById('btnNext').disabled = endIndex >= dataParaTabla.length;

    if (pageData.length === 0) { document.getElementById('emptyState').classList.remove('d-none'); return; }
    document.getElementById('emptyState').classList.add('d-none');

    pageData.forEach(item => {
        const itemId = item._id || item.id;

        let badgeColor = item.status === 'Cerrada' ? 'bg-success' : (item.status === 'Cancelada' || item.status === 'Caída' ? 'bg-danger' : 'bg-warning text-dark');
        
        let pt = parseFloat(item.pago_total) || 0;
        let esDeuda = item.status === 'Caída' && pt < 0;

        let statusBlockPC = `<span class="badge ${badgeColor} rounded-pill">${item.status}</span>`;
        if (esDeuda) {
            statusBlockPC += `<div class="small text-danger mt-1 fw-bold" style="font-size:0.75rem"><i class="bi bi-exclamation-octagon-fill me-1"></i>Deuda</div>`;
        } else if(item.status === 'Pendiente' && item.fecha_pendiente) {
            statusBlockPC += `<div class="small text-muted mt-1 fw-bold" style="font-size:0.75rem"><i class="bi bi-clock-history me-1"></i>${item.fecha_pendiente}</div>`;
        }

        let detalleHTML = '', montosCombinadosPC = '';
        let iconType = item.type === 'venta' ? '<span class="badge bg-primary me-2">T.C.</span>' : '<span class="badge bg-secondary me-2">Paper</span>';
        
        let exploreStar = '';
        if (item.type === 'venta') {
            if (item.es_explore_package === 1) exploreStar += '<i class="bi bi-star-fill text-info ms-1" style="font-size: 0.85rem;" title="Explore Package"></i>';
            if (item.es_malibu === 1) exploreStar += '<i class="bi bi-star-fill ms-1" style="font-size: 0.85rem; color: #800000;" title="Bono Malibu"></i>';
        }
        
        let tempStatus = item.status;
        item.status = 'Cerrada'; 
        let miVolumenDisplay = item.type === 'venta' ? calcularMiVolumen(item) : 0;
        item.status = tempStatus; 
        
        let miVolFormatted = miVolumenDisplay.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        let originalPago = Math.abs(pt).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        let esPorcentaje = item.tipo_pago === 'porcentaje' || (parseFloat(item.maq_volumen) > 0);
        let volMaquilaFormatted = (parseFloat(item.maq_volumen) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        let volHtmlPC = '', volHtmlMobile = '';
        let pagoHtmlPC = '', pagoHtmlMobile = '';

        if (item.type === 'venta') {
            const tipoSocioDisplay = item.tipo_socio ? item.tipo_socio : 'N/A';
            detalleHTML = `
                <div>${iconType} <span class="fw-bold text-dark">${item.cliente_nombre || '--'}</span></div>
                <div class="small text-muted">${item.nacionalidad || ''} | ${tipoSocioDisplay}</div> 
            `;
            
            if (item.status === 'Caída') {
                volHtmlPC = `<div class="fw-bold text-muted" title="Volumen Perdido"><del class="text-danger">$${miVolFormatted}</del> <span class="small fw-normal">Mi Vol.</span></div>`;
                volHtmlMobile = `<span class="fw-bold text-muted" style="font-size: 0.85rem;"><del class="text-danger">Vol: $${miVolFormatted}</del></span>`;
            } else {
                volHtmlPC = `<div class="fw-bold text-primary" title="Total del Contrato: $${(item.monto || 0).toLocaleString()}">$${miVolFormatted} <span class="small text-muted fw-normal">Mi Vol.</span></div>`;
                volHtmlMobile = `<span class="fw-bold text-primary" style="font-size: 0.85rem;" title="Total Contrato: $${(item.monto || 0).toLocaleString()}">Mi Vol: $${miVolFormatted}</span>`;
            }
        } else {
            detalleHTML = `
                <div>${iconType} <span class="fw-bold text-dark">${item.nombre_socio || '--'}</span></div>
                <div class="small text-muted">${esPorcentaje ? (item.maq_porcentaje || 0) + '% del Vol' : 'Pack: ' + (item.pack_nivel || 'None')}</div>
            `;
            if (item.status === 'Cancelada') {
                volHtmlPC = `<div class="fw-bold text-muted" style="font-size:0.85rem">${esPorcentaje ? '<del class="text-danger">$' + volMaquilaFormatted + '</del> <span class="small fw-normal">Vol.</span>' : '<span class="text-muted small">--</span>'}</div>`;
                volHtmlMobile = esPorcentaje ? `<span class="fw-bold text-muted" style="font-size: 0.85rem;"><del class="text-danger">Vol: $${volMaquilaFormatted}</del></span>` : '';
            } else {
                volHtmlPC = `<div class="fw-bold text-primary" style="font-size:0.85rem">${esPorcentaje ? '$' + volMaquilaFormatted + ' <span class="small text-muted fw-normal">Vol.</span>' : '<span class="text-muted small">--</span>'}</div>`;
                volHtmlMobile = esPorcentaje ? `<span class="fw-bold text-primary" style="font-size: 0.85rem;">Vol: $${volMaquilaFormatted}</span>` : '';
            }
        }

        if (esDeuda) {
            pagoHtmlPC = `
                <div class="fw-bold text-success mt-1 pt-1 border-top" style="font-size:0.85rem">$${originalPago} <span class="small text-muted fw-normal">Cobrado</span></div>
                <div class="fw-bold text-danger" style="font-size:0.95rem">-$${originalPago} <span class="small fw-normal">Deuda</span></div>`;
            pagoHtmlMobile = `
                <div class="d-flex flex-column align-items-end mt-1">
                    <span class="fw-bold text-success" style="font-size: 0.8rem;">$${originalPago} <span class="small text-muted fw-normal">Cobrado</span></span>
                    <span class="fw-bold text-danger" style="font-size: 1.25rem;">-$${originalPago}</span>
                </div>`;
        } else if (item.status === 'Cerrada') {
            if (pt < 0) {
                pagoHtmlPC = `<div class="fw-bold text-danger mt-1 pt-1 border-top" style="font-size:0.95rem">-$${originalPago} <span class="small text-muted fw-normal">Neto</span></div>`;
                pagoHtmlMobile = `<span class="fw-bold text-danger" style="font-size: 1.25rem;">-$${originalPago}</span>`;
            } else {
                pagoHtmlPC = `<div class="fw-bold text-success mt-1 pt-1 border-top" style="font-size:0.95rem">$${originalPago} <span class="small text-muted fw-normal">Neto</span></div>`;
                pagoHtmlMobile = `<span class="fw-bold text-success" style="font-size: 1.25rem;">$${originalPago}</span>`;
            }
        } else {
            pagoHtmlPC = `<div class="fw-bold text-muted mt-1 pt-1 border-top" style="font-size:0.95rem">$0.00 <span class="small text-muted fw-normal">Neto</span></div>`;
            pagoHtmlMobile = `<span class="fw-bold text-muted" style="font-size: 1.25rem;">$0.00</span>`;
        }

        montosCombinadosPC = volHtmlPC + pagoHtmlPC;

        let mobileCol = `
            <div class="d-md-none d-flex flex-column align-items-end justify-content-center">
                ${item.status !== 'Cerrada' ? `<span class="badge ${badgeColor} mb-1" style="font-size:0.65rem;">${item.status}</span>` : ''}
                ${esDeuda ? `<span class="badge bg-danger mb-1" style="font-size:0.65rem;">Deuda Activa</span>` : ''}
                
                ${volHtmlMobile}
                ${pagoHtmlMobile}
                
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

        let mobileNameDisplay = item.type === 'venta' ? (item.cliente_nombre || '--') : (item.nombre_socio || '--');

        const fila = `
            <tr>
                <td class="align-middle">
                    <div class="fw-bold text-dark">${item.fecha || '--'}</div>
                    <div class="small text-muted">#${item.contrato || 'N/A'}${exploreStar}</div>
                    
                    <div class="d-md-none fw-bold text-dark mt-1" style="font-size: 0.85rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; padding-right: 10px;" title="${mobileNameDisplay}">
                        <i class="bi bi-person-fill text-muted me-1"></i>${mobileNameDisplay}
                    </div>
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

    let pt = parseFloat(item.pago_total) || 0;
    let esDeuda = item.status === 'Caída' && pt < 0;
    
    let pagoColor = pt < 0 ? 'text-danger' : 'text-success';
    let signo = pt < 0 ? '-' : '';
    let pagoTotalFormatted = signo + '$' + Math.abs(pt).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const fm = (val) => val ? `$${parseFloat(val).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '$0.00';
    const badgeStatus = item.status === 'Cerrada' ? 'bg-success' : (item.status === 'Caída' || item.status === 'Cancelada' ? 'bg-danger' : 'bg-warning text-dark');

    let statusBlock = `<span class="badge ${badgeStatus} fs-6 mb-1">${item.status}</span>`;
    if (esDeuda) {
        statusBlock += `<div class="text-danger fw-bold small mt-1"><i class="bi bi-exclamation-octagon-fill me-1"></i>Deuda Generada</div>`;
    } else if (item.status === 'Pendiente' && item.fecha_pendiente) {
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
        
        let malibuIndicator = '';
        if (item.es_malibu === 1 && parseFloat(item.monto_malibu) > 0) {
            malibuIndicator = `<div class="alert py-1 px-2 mb-0 small fw-bold mt-1 text-white shadow-sm" style="background-color:#800000;"><i class="bi bi-star-fill me-1 text-warning"></i>MALIBU: $${parseFloat(item.monto_malibu).toLocaleString('en-US', {minimumFractionDigits: 2})} Efectivo</div>`;
        }

        const reservaTxt = (item.es_reserva === 1) ? '10%' : 'No';
        
        let tempStatus = item.status;
        item.status = 'Cerrada'; 
        let miVolumen = calcularMiVolumen(item);
        item.status = tempStatus;

        html = `
            <div class="container-fluid px-0">
                <div class="row mb-3 border-bottom pb-3 align-items-center">
                     <div class="col-6"><small class="text-muted d-block text-uppercase fw-bold">Fecha Venta</small><span class="fs-5 fw-bold text-dark">${item.fecha}</span></div>
                     <div class="col-6 text-end">${statusBlock}<div class="d-flex flex-column align-items-end gap-1 mt-1">${exploreIndicator}${malibuIndicator}</div></div>
                </div>
                <div class="row mb-3">
                     <div class="col-md-7"><h6 class="text-primary fw-bold text-uppercase small mb-2">Información del Cliente</h6><div class="detail-card p-3"><div class="fs-5 fw-bold mb-1">${item.cliente_nombre}</div><div class="d-flex gap-2 mb-2"><span class="badge bg-secondary">${item.nacionalidad}</span><span class="badge bg-info text-dark">${item.tipo_socio || '--'}</span><span class="badge bg-light text-dark border">${item.pack_nivel} Pack</span></div></div></div>
                     <div class="col-md-5"><h6 class="text-primary fw-bold text-uppercase small mb-2">Equipo de Ventas</h6><div class="detail-card p-3"><div class="text-dark fw-bold">${item.vendedores || 'No asignado'}</div></div></div>
                </div>
                
                <h6 class="text-primary fw-bold text-uppercase small mb-2 mt-4">Resumen Financiero Histórico</h6>
                <div class="detail-card p-3 mb-3" style="background-color: #f0fdf4; border-color: #bbf7d0;">
                     <div class="d-flex flex-column flex-md-row text-center justify-content-between gap-3">
                        <div class="flex-fill">
                            <small class="d-block text-success fw-bold text-uppercase">Volumen Generado</small>
                            <span class="fs-3 fw-bold text-dark text-break" style="letter-spacing: -1px;">${fm(miVolumen)}</span>
                            <div class="small text-muted mt-1" style="font-size: 0.75rem; line-height: 1;">Total: ${fm(item.monto)}</div>
                        </div>
                        
                        <div class="d-none d-md-block border-end border-success-subtle"></div>
                        <div class="d-md-none border-bottom border-success-subtle w-100"></div>

                        <div class="flex-fill">
                            <small class="d-block ${pagoColor} fw-bold text-uppercase">Estatus de Pago</small>
                            <span class="fs-3 fw-bold ${pagoColor} text-break" style="letter-spacing: -1px;">${pagoTotalFormatted}</span>
                        </div>
                        
                        <div class="d-none d-md-block border-end border-success-subtle"></div>
                        <div class="d-md-none border-bottom border-success-subtle w-100"></div>

                        <div class="flex-fill d-flex flex-column justify-content-center align-items-center">
                            <small class="d-block text-muted text-uppercase fw-bold mb-2">Métodos</small>
                            <div>
                                ${item.amex ? '<span class="badge bg-primary me-1">AMEX</span>' : ''} 
                                ${item.msi_6 ? '<span class="badge bg-info text-dark">6MSI</span>' : ''} 
                                ${(!item.amex && !item.msi_6) ? '<span class="text-muted small">--</span>' : ''}
                            </div>
                        </div>
                     </div>
                </div>
                
                <h6 class="text-primary fw-bold text-uppercase small mb-2 mt-4">Desglose de Deducciones</h6>
                <div class="row g-2 text-center">
                    <div class="col-6 col-md-4"><div class="p-2 border rounded bg-white"><small class="d-block text-muted">Regalos</small><strong class="text-dark text-break">${fm(item.monto_regalos)}</strong></div></div>
                    <div class="col-6 col-md-4"><div class="p-2 border rounded bg-white"><small class="d-block text-muted">Donativos</small><strong class="text-dark text-break">${fm(item.monto_donativos)}</strong></div></div>
                    <div class="col-6 col-md-4"><div class="p-2 border rounded bg-white"><small class="d-block text-muted">Move In</small><strong class="text-dark text-break">${fm(item.monto_movein)}</strong></div></div>
                    <div class="col-6 col-md-4"><div class="p-2 border rounded bg-white"><small class="d-block text-primary">Reserva</small><strong class="text-primary">${reservaTxt}</strong></div></div>
                    <div class="col-6 col-md-4"><div class="p-2 border rounded bg-white"><small class="d-block text-danger">Impuestos</small><strong class="text-danger">${item.porcentaje_impuestos || 0}%</strong></div></div>
                    <div class="col-6 col-md-4"><div class="p-2 border rounded bg-white border-danger-subtle shadow-sm"><small class="d-block text-danger fw-bold">Chargeback</small><strong class="text-danger">${fm(item.monto_chargeback || 0)}</strong></div></div>
                </div>
                
                <div class="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-muted small text-uppercase">Deducciones Aplicadas:</span>
                    <div>
                        <span class="badge ${item.deduccion_meseros ? 'bg-secondary' : 'bg-light text-muted border'} me-1 mb-1">Meseros</span>
                        <span class="badge ${item.deduccion_antilavado ? 'bg-secondary' : 'bg-light text-muted border'} me-1 mb-1">Antilavado</span>
                        <span class="badge ${item.deduccion_explore ? 'bg-secondary' : 'bg-light text-muted border'} me-1 mb-1">Explore</span>
                        <span class="badge ${item.deduccion_rci ? 'bg-secondary' : 'bg-light text-muted border'} mb-1">RCI</span>
                    </div>
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
                            <small class="d-block ${pagoColor} text-uppercase fw-bold mb-1">Pago Neto</small>
                            <strong class="fs-3 ${pagoColor}">${pagoTotalFormatted}</strong>
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

    mostrarFormulario(); 

    if (type === 'venta' && currentMode !== 'ventas') switchTab('ventas');
    if (type === 'maquila' && currentMode !== 'maquila') switchTab('maquila');

    editId = String(item._id || item.id);
    window.isEditingLoad = true;

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
        document.getElementById('cmbStatus').value = item.status;
        
        let pt = parseFloat(item.pago_total) || 0;
        let cmbLiq = document.getElementById('cmbLiquidacionCaida');
        if(cmbLiq) {
            cmbLiq.value = (item.status === 'Caída' && pt < 0) ? 'liquidada' : 'no_liquidada';
        }
        
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
        
        const chkRCI = document.getElementById('chkRCI');
        if (chkRCI) chkRCI.checked = (item.deduccion_rci === 1);

        const chkExplore = document.getElementById('chkExplore');
        chkExplore.checked = (item.es_explore_package === 1);
        toggleExplore(); 

        const chkExploreHoy = document.getElementById('chkExploreHoy');
        chkExploreHoy.checked = (item.explore_es_hoy === 1);
        
        if(item.explore_es_hoy !== 1) {
            document.getElementById('txtFechaPromesa').value = item.promesa_pago || item.promesa || '';
        }
        toggleExploreHoy();

        const chkMalibu = document.getElementById('chkMalibu');
        if(chkMalibu) {
            chkMalibu.checked = (item.es_malibu === 1);
            document.getElementById('txtMalibuMonto').value = item.monto_malibu || '';
            toggleMalibu();
        }

        document.getElementById('chkReserva').checked = (item.es_reserva === 1); 
        document.getElementById('txtImpuestosPorcentaje').value = item.porcentaje_impuestos || ''; 
        document.getElementById('txtRegalos').value = item.monto_regalos || 0;
        document.getElementById('txtDonativos').value = item.monto_donativos || 0;
        document.getElementById('txtMoveIn').value = item.monto_movein || 0;
        document.getElementById('cmbBonusWeeks').value = item.bonus_weeks || 0;
        
        const txtChargeback = document.getElementById('txtChargeback');
        if(txtChargeback) txtChargeback.value = item.monto_chargeback || '';

        document.getElementById('txtComentarios').value = item.comentarios || '';
        document.getElementById('txtFechaPendienteVenta').value = item.fecha_pendiente || '';
        
        handleStatusChange('venta');

        document.getElementById('btnGuardarVenta').innerHTML = '<i class="bi bi-pencil-square fs-5"></i><span>ACTUALIZAR DATOS</span>';
        document.getElementById('btnCancelarEditVenta').classList.remove('d-none');
        
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
        handleStatusChange('maquila');
        
        calcularMaquila(); 

        document.getElementById('btnGuardarMaquila').innerHTML = '<i class="bi bi-pencil-square fs-5"></i><span>ACTUALIZAR DATOS</span>';
        document.getElementById('btnCancelarEditMaquila').classList.remove('d-none');
    }
    window.isEditingLoad = false;
}

function cancelarEdicion(mode) {
    editId = null;
    window.isEditingLoad = true;
    if (mode === 'ventas') {
        document.getElementById('frmVenta').reset();
        document.getElementById('txtFecha').valueAsDate = new Date();
        document.getElementById('btnGuardarVenta').innerHTML = '<i class="bi bi-floppy-fill me-2"></i>GUARDAR VENTA';
        document.getElementById('btnCancelarEditVenta').classList.add('d-none');
        
        document.getElementById('cmbNumVendedores').value = 1;
        renderVendedoresInputs();
        toggleLiner();
        
        const divCasadoOpts = document.getElementById('divCasadoOptions');
        if(divCasadoOpts) divCasadoOpts.classList.add('d-none');
        document.getElementById('cmbTipoCasado').value = 'Comisión';

        toggleExplore(); 
        toggleExploreHoy(); 
        
        const chkMalibu = document.getElementById('chkMalibu');
        if(chkMalibu) { chkMalibu.checked = false; toggleMalibu(); }

        let cmbLiq = document.getElementById('cmbLiquidacionCaida');
        if(cmbLiq) cmbLiq.value = 'no_liquidada';
        
        const cb = document.getElementById('txtChargeback');
        if(cb) cb.value = '';

        handleStatusChange('venta');
        calcularMatematica();
    } else {
        document.getElementById('frmMaquila').reset();
        document.getElementById('maqFecha').valueAsDate = new Date();
        document.getElementById('btnGuardarMaquila').innerHTML = '<i class="bi bi-floppy-fill me-2"></i>GUARDAR PAPERWORK';
        document.getElementById('btnCancelarEditMaquila').classList.add('d-none');
        document.getElementById('maqTipoPack').checked = true;
        toggleTipoPagoMaquila();
        handleStatusChange('maquila');
    }
    window.isEditingLoad = false;
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

    let pagoTotalLimpio = document.getElementById('txtPagoTotal').value.replace('$', '').replace('-', '');
    let pagoTotalNumerico = parseFloat(pagoTotalLimpio) || 0;
    
    if (document.getElementById('txtPagoTotal').value.includes('-')) {
        pagoTotalNumerico = -Math.abs(pagoTotalNumerico);
    }

    const payload = {
        cliente: document.getElementById('txtCliente').value,
        contrato: document.getElementById('txtContrato').value,
        monto: parseFloat(document.getElementById('txtMonto').value) || 0,
        status: document.getElementById('cmbStatus').value,
        liquidacion: document.getElementById('cmbLiquidacionCaida') ? document.getElementById('cmbLiquidacionCaida').value : 'no_liquidada',
        fecha: document.getElementById('txtFecha').value,
        promesa: valorFechaPromesa,
        promesa_pago: valorFechaPromesa,
        tipo_socio: document.querySelector('input[name="tipoSocio"]:checked').value,
        pack_nivel: document.getElementById('cmbPack').value,
        deduccion_antilavado: document.getElementById('chkAntilavado').checked ? 1 : 0,
        deduccion_explore: document.getElementById('chkExploreForm').checked ? 1 : 0,
        deduccion_meseros: document.getElementById('chkMeseros').checked ? 1 : 0,
        deduccion_rci: (document.getElementById('chkRCI') && document.getElementById('chkRCI').checked) ? 1 : 0,
        es_explore_package: document.getElementById('chkExplore').checked ? 1 : 0,
        explore_es_hoy: document.getElementById('chkExploreHoy').checked ? 1 : 0,
        es_malibu: document.getElementById('chkMalibu').checked ? 1 : 0,
        monto_malibu: parseFloat(document.getElementById('txtMalibuMonto').value) || 0,
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
        monto_chargeback: parseFloat(document.getElementById('txtChargeback') ? document.getElementById('txtChargeback').value : 0) || 0,
        nacionalidad: document.querySelector('input[name="nacionalidad"]:checked').value,
        pago_total: pagoTotalNumerico, 
        comentarios: document.getElementById('txtComentarios').value,
        fecha_pendiente: document.getElementById('txtFechaPendienteVenta').value,
        tipo: 'venta' // Aseguramos el tipo para el backend
    };

    const oldItem = editId ? allDataGlobal.find(x => String(x._id || x.id) === String(editId) && x.type === 'venta') : null;

    if (payload.status === 'Caída') {
        if (!payload.monto && oldItem) {
            payload.monto = oldItem.monto;
        }
    } else if (payload.status === 'Cancelada') {
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
        maq_impuestos: parseFloat(document.getElementById('maqImpuestos').value) || 0,
        tipo: 'maquila'
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
        
        if (result.message || res.ok) {
            let tipoAccion = mode === 'ventas' 
                ? (editId ? 'update_venta' : 'nueva_venta') 
                : (editId ? 'update_maquila' : 'nueva_maquila');
                
            detonarCelebracion(tipoAccion);
            cargarDatosUnificados(); 
        } else { 
            Swal.fire('Error', result.error || 'Error desconocido del servidor', 'error'); 
        }
    } catch (e) { 
        Swal.fire('Error', 'Problema de conexión', 'error'); 
    }
}

function eliminarItem(type, id) {
    if (!id || id === 'undefined') {
        Swal.fire('Error Técnico', 'ID de registro no válido.', 'error');
        return;
    }

    const endpointType = (type === 'venta' || type === 'bono_cash') ? 'ventas' : 'maquilas';

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
                totalEnElAire += Math.abs(monto);
                alertasHTML += generarCardAlerta(item.type, item, Math.abs(monto), diffDays === 0 ? 'HOY' : `Hace ${diffDays} días`);
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
        
        if (result.message || res.ok) {
            Swal.close();
            if (accion === 'pagado') {
                detonarCelebracion('pago_explore');
            } else {
                Swal.fire({ icon: 'success', title: 'Marcado como Caída', showConfirmButton: false, timer: 1500 });
            }
            cargarDatosUnificados(); 
        } else { 
            Swal.fire('Error', result.error, 'error'); 
        }
    } catch (e) { 
        Swal.fire('Error', 'Problema de conexión', 'error'); 
    }
}

// ==========================================
// LEDGER DE CASH (HISTORIAL Y EDICIÓN)
// ==========================================
function abrirHistorialCash() {
    const lista = document.getElementById('listaHistorialCash');
    if (!lista) return;

    const cashItems = allDataGlobal.filter(item => item.type === 'bono_cash');
    
    if (cashItems.length === 0) {
        lista.innerHTML = '<div class="text-center text-muted p-4 small"><i class="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>No hay bonos registrados aún.</div>';
    } else {
        let html = '';
        cashItems.forEach(item => {
            const monto = parseFloat(item.monto_mxn) || parseFloat(item.monto) || 0;
            const id = item._id || item.id;
            html += `
                <div class="d-flex justify-content-between align-items-center p-3 border rounded-3 mb-2 bg-light shadow-sm">
                    <div>
                        <div class="fw-bold text-dark small"><i class="bi bi-calendar-event me-1"></i>${item.fecha}</div>
                        <div class="text-success fw-bold fs-5 mt-1">$${monto.toLocaleString('en-US', {minimumFractionDigits:2})} <span class="small text-muted fw-normal" style="font-size:0.7rem;">MXN</span></div>
                    </div>
                    <div class="btn-group shadow-sm rounded-pill">
                        <button class="btn btn-sm btn-white border-secondary-subtle px-3" onclick="editarBonoCash('${id}')" title="Editar"><i class="bi bi-pencil-fill text-primary"></i></button>
                        <button class="btn btn-sm btn-white border-secondary-subtle px-3" onclick="eliminarItem('bono_cash', '${id}')" title="Borrar"><i class="bi bi-trash-fill text-danger"></i></button>
                    </div>
                </div>
            `;
        });
        lista.innerHTML = html;
    }

    const modal = new bootstrap.Modal(document.getElementById('modalHistorialCash'));
    modal.show();
}

function editarBonoCash(id) {
    const item = allDataGlobal.find(x => String(x._id || x.id) === String(id) && x.type === 'bono_cash');
    if (!item) return;

    // 1. Ocultar el Ledger
    const modalHistorialEl = document.getElementById('modalHistorialCash');
    const modalHistorial = bootstrap.Modal.getInstance(modalHistorialEl);
    if (modalHistorial) modalHistorial.hide();

    // 2. Preparar el Modal de Ingreso con los datos
    document.getElementById('txtFechaCash').value = item.fecha;
    document.getElementById('txtMontoCash').value = item.monto_mxn || item.monto;
    
    // 3. Variable secreta para saber que editamos
    window.editIdCash = String(id);
    
    // 4. Cambiar estilo del botón a "Modo Edición"
    const btnGuardar = document.querySelector('#modalCash button.btn.py-3');
    if(btnGuardar) {
        btnGuardar.innerHTML = '<i class="bi bi-pencil-square me-1"></i> ACTUALIZAR CASH';
        btnGuardar.classList.replace('text-dark', 'text-white');
        btnGuardar.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
        btnGuardar.style.border = 'none';
    }

    // 5. Mostrar Modal de Cash (con delay sutil para transición suave)
    setTimeout(() => {
        const modalCash = new bootstrap.Modal(document.getElementById('modalCash'));
        modalCash.show();
    }, 300);
}