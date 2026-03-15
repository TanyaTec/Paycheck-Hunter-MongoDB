// --- CONFIGURACIÓN GLOBAL ---
const BASE_URL = '';
let currentMode = 'ventas'; 
let editId = null;

let allDataGlobal = []; 
let filteredData = [];  
let currentPage = 1;
const itemsPerPage = 20;
window.isEditingLoad = false;

let currentUserNombre = "";

const successMessages = {
    'nueva_venta': { icon: '🚀', title: '¡Venta Cerrada!', msg: '¡Excelente trabajo, Closer! Una comisión más al bolsillo.', btn: '¡A seguir facturando! 💸' },
    'update_venta': { icon: '📝', title: '¡Datos Actualizados!', msg: 'Los datos de la venta han sido ajustados con precisión.', btn: 'Entendido' },
    'nueva_maquila': { icon: '🤝', title: '¡Paperwork Listo!', msg: 'Un trámite menos, un paso más cerca de tu meta.', btn: '¡Excelente!' },
    'update_maquila': { icon: '📝', title: '¡Paperwork Actualizado!', msg: 'Documentación al día y en orden.', btn: 'Entendido' },
    'pago_explore': { icon: '💰', title: '¡Explore Cobrado!', msg: 'Ese bono ya está en la bolsa. ¡Felicidades!', btn: '¡A celebrar! 🎉' },
    // Añadimos mensaje de éxito para Cash
    'nuevo_cash': { icon: '💰', title: '¡Cash Registrado!', msg: 'Tu bono en efectivo ha sido guardado exitosamente.', btn: '¡Excelente!' }
};

// --- NAVEGACIÓN Y VISTAS ---
function mostrarFormulario() {
    document.getElementById('vistaDashboard').classList.add('d-none');
    const fab = document.getElementById('fabMobile');
    if(fab) fab.classList.add('d-none');
    
    const vistaForm = document.getElementById('vistaFormulario');
    vistaForm.classList.remove('d-none');
    
    vistaForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ocultarFormulario() {
    document.getElementById('vistaFormulario').classList.add('d-none');
    
    const vistaDash = document.getElementById('vistaDashboard');
    vistaDash.classList.remove('d-none');
    
    const fab = document.getElementById('fabMobile');
    if(fab) fab.classList.remove('d-none');
    
    cancelarEdicion(currentMode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function detonarCelebracion(tipoAccion) {
    const config = successMessages[tipoAccion] || successMessages['nueva_venta'];
    
    document.getElementById('celIcon').innerText = config.icon;
    document.getElementById('celTitle').innerText = config.title;
    document.getElementById('celMessage').innerText = config.msg;
    document.getElementById('celButton').innerText = config.btn;

    const modalEl = document.getElementById('modalCelebracion');
    const modal = new bootstrap.Modal(modalEl);
    
    modalEl.addEventListener('hidden.bs.modal', function onModalHidden() {
        ocultarFormulario();
        modalEl.removeEventListener('hidden.bs.modal', onModalHidden);
    });

    modal.show();

    if (tipoAccion === 'nueva_venta' || tipoAccion === 'pago_explore' || tipoAccion === 'nuevo_cash') {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#00c6ff', '#0072ff', '#fbbf24', '#ffffff'], zIndex: 10000 });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tokenGuardado = localStorage.getItem('paycheckToken');
    const nombreGuardado = localStorage.getItem('paycheckUserName');

    if (tokenGuardado && nombreGuardado) {
        currentUserNombre = nombreGuardado;
        mostrarDashboard();
    }
});

async function handleCredentialResponse(response) {
    const googleToken = response.credential;
    try {
        const res = await fetch(`${BASE_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ googleToken })
        });
        const data = await res.json();
        
        if (res.ok && data.token) {
            currentUserNombre = data.nombre.toLowerCase();
            localStorage.setItem('paycheckToken', data.token); 
            localStorage.setItem('paycheckUserName', currentUserNombre);
            localStorage.setItem('paycheckUserPic', data.picture || "");
            mostrarDashboard();
        } else {
            throw new Error(data.error || "Acceso denegado por el servidor");
        }
    } catch (e) {
        const errorMsg = document.getElementById('loginError');
        if(errorMsg) {
            errorMsg.innerHTML = `<p class="text-danger fw-bold bg-danger-subtle p-2 rounded-3 small mb-0 border border-danger-subtle d-flex align-items-center justify-content-center gap-1"><i class="bi bi-exclamation-triangle-fill"></i> ${e.message}</p>`;
            errorMsg.classList.remove('d-none');
        }
    }
}

function mostrarDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    
    if(loginScreen) loginScreen.classList.add('d-none');
    if(appContent) appContent.classList.remove('d-none');

    const greetingEl = document.getElementById('userGreetingName');
    const profilePicEl = document.getElementById('userProfilePic');
    const userInitialsEl = document.getElementById('userInitials');
    const picUrl = localStorage.getItem('paycheckUserPic');

    if (currentUserNombre) {
        const nombreFormateado = currentUserNombre.charAt(0).toUpperCase() + currentUserNombre.slice(1);
        if(greetingEl) greetingEl.innerText = nombreFormateado;
        
        if (picUrl && profilePicEl) {
            profilePicEl.src = picUrl;
            profilePicEl.classList.remove('d-none');
            if(userInitialsEl) userInitialsEl.classList.add('d-none');
        } else if (userInitialsEl) {
            userInitialsEl.innerText = nombreFormateado.charAt(0);
            userInitialsEl.classList.remove('d-none');
            if(profilePicEl) profilePicEl.classList.add('d-none');
        }
    }
    
    cargarDatosUnificados(); 
}

function cerrarSesion() {
    localStorage.removeItem('paycheckToken');
    localStorage.removeItem('paycheckUserName');
    localStorage.removeItem('paycheckUserPic');
    location.reload(); 
}

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
    try { cancelarEdicion(mode); limpiarFiltro(false); } catch(e) {}
}

function toggleExplore() {
    const check = document.getElementById('chkExplore');
    const fields = document.getElementById('exploreFields');
    if(check && fields) check.checked ? fields.classList.remove('d-none') : fields.classList.add('d-none');
}

function toggleExploreHoy() {
    const chk = document.getElementById('chkExploreHoy');
    const dateInput = document.getElementById('txtFechaPromesa');
    if (chk && dateInput) {
        if (chk.checked) { dateInput.value = ''; dateInput.disabled = true; } 
        else { dateInput.disabled = false; }
    }
}

function toggleMalibu() {
    const check = document.getElementById('chkMalibu');
    const fields = document.getElementById('malibuFields');
    if(check && fields) check.checked ? fields.classList.remove('d-none') : fields.classList.add('d-none');
}

function handleStatusChange(mode) {
    const val = mode === 'venta' ? document.getElementById('cmbStatus').value : document.getElementById('maqStatus').value;
    const divPend = mode === 'venta' ? document.getElementById('divFechaPendienteVenta') : document.getElementById('divFechaPendienteMaq');
    
    if (val === 'Pendiente') divPend.classList.remove('d-none');
    else divPend.classList.add('d-none');

    if (mode === 'venta') {
        const divCaida = document.getElementById('divCaidaOpciones');
        if (val === 'Caída') {
            if(divCaida) divCaida.classList.remove('d-none');
            
            if (!window.isEditingLoad) {
                Swal.fire({
                    title: 'Venta Cancelada',
                    text: '¿Esta comisión ya se te había pagado (liquidado) en tu quincena anterior?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, ya la cobré',
                    cancelButtonText: 'No, aún no la cobraba',
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#6c757d',
                    reverseButtons: true
                }).then((result) => {
                    if (result.isConfirmed) {
                        document.getElementById('cmbLiquidacionCaida').value = 'liquidada';
                        Swal.fire({
                            title: 'Deuda Generada', 
                            text: 'El monto original se retendrá en el historial pero restará de tus futuras comisiones.', 
                            icon: 'info', 
                            timer: 3500, 
                            showConfirmButton: false
                        });
                    } else {
                        document.getElementById('cmbLiquidacionCaida').value = 'no_liquidada';
                    }
                    calcularMatematica();
                });
            }
        } else {
            if(divCaida) divCaida.classList.add('d-none');
            document.getElementById('cmbLiquidacionCaida').value = 'no_liquidada';
            calcularMatematica();
        }
    }
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
        packContainer.classList.remove('d-none'); pctContainer.classList.add('d-none');
    } else {
        packContainer.classList.add('d-none'); pctContainer.classList.remove('d-none');
    }
    calcularMaquila();
}

function renderVendedoresInputs() {
    const cmb = document.getElementById('cmbNumVendedores');
    if(!cmb) return;
    const num = parseInt(cmb.value);
    const container = document.getElementById('containerVendedores');
    let html = '';
    for(let i=1; i<=num; i++) {
        html += `<label class="form-label text-muted small">Nombre Vendedor ${i}</label><input type="text" class="form-control mb-2 form-control-sm" id="vend_${i}" placeholder="Nombre...">`;
    }
    container.innerHTML = html;
    calcularMatematica(); 
}

function toggleLiner() {
    const chk = document.getElementById('chkLiner');
    const input = document.getElementById('txtLinerName');
    if(chk && input) { chk.checked ? input.classList.remove('d-none') : input.classList.add('d-none'); calcularMatematica(); }
}

async function guardarBonoCashEnFirebase(montoMxn, fecha) {
    const token = localStorage.getItem('paycheckToken');
    if (!token) {
        Swal.fire('Error', 'No estás autenticado.', 'error');
        return;
    }

    // CABALLO DE TROYA V2
    const registroBono = {
        cliente: 'BONO CASH',
        cliente_nombre: 'BONO CASH',
        contrato: 'CASH',
        monto: montoMxn, 
        pago_total: 0,   
        status: 'Cerrada',
        nacionalidad: 'Mexicano',
        tipo_socio: 'N/A',
        pack_nivel: 'None',
        fecha: fecha
    };

    // EL DETECTOR DE EDICIÓN
    const idEdit = window.editIdCash;
    const method = idEdit ? 'PUT' : 'POST';
    const url = idEdit ? `${BASE_URL}/api/ventas/${idEdit}` : `${BASE_URL}/api/ventas`;

    try {
        const response = await fetch(url, { 
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify(registroBono)
        });

        if (response.ok) {
            const modalEl = document.getElementById('modalCash');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            
            cargarDatosUnificados();
            detonarCelebracion('nuevo_cash');

        } else if (response.status === 403 || response.status === 401) {
            cerrarSesion();
        } else {
            const err = await response.json();
            throw new Error(err.error || 'Error al guardar el bono.');
        }
    } catch (error) {
        console.error("Error guardando Bono Cash:", error);
        Swal.fire('Error', error.message, 'error');
    }
}