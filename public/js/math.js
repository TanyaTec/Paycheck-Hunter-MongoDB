function calcularMiVolumen(item) {
    if (item.type !== 'venta') return 0;
    if (item.status === 'Caída' || item.status === 'Cancelada') return 0;

    let monto = parseFloat(item.monto) || 0;
    let numVend = parseInt(item.num_vendedores) || 1;
    let liner = parseInt(item.es_liner) === 1 ? 1 : 0;
    
    let partesTotales = numVend + liner;
    let volumenPorPersona = monto / partesTotales; 

    let esCasado = parseInt(item.es_casado) === 1;
    let tipoCasado = item.tipo_casado || 'Comisión'; 
    let nombreUsuario = currentUserNombre; 
    let listaVendedores = (item.vendedores || "").toLowerCase();
    let nombreLiner = (item.nombre_liner || "").toLowerCase();
    
    let participeDirectamente = listaVendedores.includes(nombreUsuario) || nombreLiner.includes(nombreUsuario);
    let miVolumen = 0;

    if (participeDirectamente) {
        miVolumen = volumenPorPersona;
        if (esCasado && (tipoCasado === 'Volumen' || tipoCasado === 'Ambas')) miVolumen = miVolumen / 2;
    } else {
        if (esCasado && (tipoCasado === 'Volumen' || tipoCasado === 'Ambas')) miVolumen = volumenPorPersona / 2;
        else miVolumen = 0;
    }
    return miVolumen;
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

    let gastosAntesImpuestos = 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtRegalos').value) || 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtDonativos').value) || 0;
    gastosAntesImpuestos += parseFloat(document.getElementById('txtMoveIn').value) || 0;
    
    const bonusWeeks = parseInt(document.getElementById('cmbBonusWeeks').value) || 0;
    gastosAntesImpuestos += (bonusWeeks * 20);

    let miParteGastosAntes = gastosAntesImpuestos / numVendedores;
    let baseParaImpuestosYReserva = ingresoBrutoIndividual - miParteGastosAntes;

    const impuestoPorcentaje = parseFloat(document.getElementById('txtImpuestosPorcentaje').value) || 0;
    let deduccionImpuestos = 0;
    if (impuestoPorcentaje > 0 && baseParaImpuestosYReserva > 0) {
        deduccionImpuestos = baseParaImpuestosYReserva * (impuestoPorcentaje / 100);
    }

    let deduccionReserva = 0;
    if (document.getElementById('chkReserva').checked && baseParaImpuestosYReserva > 0) {
        deduccionReserva = baseParaImpuestosYReserva * 0.10;
    }

    let subtotalPostImpuestos = baseParaImpuestosYReserva - deduccionImpuestos - deduccionReserva;

    let gastosDespuesImpuestos = 0; 
    if (document.getElementById('chkMeseros').checked) gastosDespuesImpuestos += 20;
    if (document.getElementById('chkAntilavado').checked) gastosDespuesImpuestos += 10;
    if (document.getElementById('chkExploreForm').checked) gastosDespuesImpuestos += 10;
    if (document.getElementById('chkRCI') && document.getElementById('chkRCI').checked) gastosDespuesImpuestos += 10;

    let miParteGastosDespues = gastosDespuesImpuestos / numVendedores;
    
    // CIRUGÍA: Chargeback manual restado al total
    let chargebackManual = parseFloat(document.getElementById('txtChargeback') ? document.getElementById('txtChargeback').value : 0) || 0;
    let pagoNetoFinal = subtotalPostImpuestos - miParteGastosDespues - chargebackManual;

    const status = document.getElementById('cmbStatus').value;
    const cmbLiq = document.getElementById('cmbLiquidacionCaida');

    // Mantenemos el cálculo como negativo visualmente solo para indicar que es un valor en contra
    if (status === 'Caída' && cmbLiq && cmbLiq.value === 'liquidada') {
        pagoNetoFinal = -Math.abs(pagoNetoFinal); 
    } else if (status === 'Caída' || status === 'Cancelada') {
        pagoNetoFinal = 0; 
    }

    const txtPagoTotal = document.getElementById('txtPagoTotal');
    const dollarSign = txtPagoTotal.previousElementSibling;

    if (pagoNetoFinal < 0) {
        txtPagoTotal.classList.replace('text-success', 'text-danger');
        if (dollarSign) dollarSign.classList.replace('text-success', 'text-danger');
    } else {
        txtPagoTotal.classList.replace('text-danger', 'text-success');
        if (dollarSign) dollarSign.classList.replace('text-danger', 'text-success');
    }
    
    txtPagoTotal.value = pagoNetoFinal.toFixed(2);
}

function calcularMaquila() {
    const isPack = document.getElementById('maqTipoPack').checked;
    let importeBase = 0;

    if (isPack) {
        const pack = document.getElementById('maqPack').value;
        if (pack === 'Full') importeBase = 150.88;
        else if (pack === '1/2') importeBase = 150.88 / 2; 
    } else {
        const vol = parseFloat(document.getElementById('maqVolumen').value) || 0;
        const pct = parseFloat(document.getElementById('maqPorcentaje').value) || 0;
        importeBase = vol * (pct / 100);
    }

    let deduccionReserva = 0;
    if (document.getElementById('maqReserva').checked) deduccionReserva = importeBase * 0.10;

    const impPct = parseFloat(document.getElementById('maqImpuestos').value) || 0;
    let deduccionImpuestos = importeBase * (impPct / 100);

    let pagoNeto = importeBase - deduccionReserva - deduccionImpuestos;
    document.getElementById('maqPago').value = pagoNeto.toFixed(2);
}

function actualizarTotalesMesActual() {
    const hoy = new Date();
    const mesActual = hoy.getMonth(); 
    const anioActual = hoy.getFullYear();
    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    let volMes = 0, comisionMes = 0, exploreMes = 0, malibuMes = 0;
    let volYTD = 0, comisionYTD = 0, exploreYTD = 0, malibuYTD = 0;

    allDataGlobal.forEach(item => {
        let esCerrada = item.status === 'Cerrada';
        let pagoBD = parseFloat(item.pago_total) || 0;
        let esDeuda = item.status === 'Caída' && pagoBD < 0;

        if ((esCerrada || esDeuda) && item.fecha) {
            let [yyyy, mm, dd] = item.fecha.split('-');
            let añoVenta = parseInt(yyyy);
            let mesVenta = parseInt(mm) - 1;

            if (añoVenta === anioActual) {
                comisionYTD += pagoBD;
                
                if (esCerrada && item.type === 'venta') {
                    volYTD += calcularMiVolumen(item);
                    let esExplore = parseInt(item.es_explore_package) === 1;
                    let esExploreHoy = parseInt(item.explore_es_hoy) === 1;
                    let numVend = parseInt(item.num_vendedores) || 1;
                    
                    if (esExplore && esExploreHoy) exploreYTD += ( (225 * 0.77) / numVend );
                    if (parseInt(item.es_malibu) === 1 && parseFloat(item.monto_malibu) > 0) malibuYTD += parseFloat(item.monto_malibu);
                }
            }

            if (añoVenta === anioActual && mesVenta === mesActual) {
                comisionMes += pagoBD;

                if (esCerrada && item.type === 'venta') {
                    volMes += calcularMiVolumen(item);
                    let esExplore = parseInt(item.es_explore_package) === 1;
                    let esExploreHoy = parseInt(item.explore_es_hoy) === 1;
                    let numVend = parseInt(item.num_vendedores) || 1;

                    if (esExplore && esExploreHoy) exploreMes += ( (225 * 0.77) / numVend );
                    if (parseInt(item.es_malibu) === 1 && parseFloat(item.monto_malibu) > 0) malibuMes += parseFloat(item.monto_malibu);
                }
            }
        }
    });

    const formatCurr = (v) => {
        let isNeg = v < 0;
        return (isNeg ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    };
    
    const lblYTD = document.getElementById('lblYTDVolumen');
    if(lblYTD) lblYTD.innerText = formatCurr(volYTD);
    
    const lblYTDCom = document.getElementById('lblYTDComision');
    if(lblYTDCom) {
        lblYTDCom.innerText = formatCurr(comisionYTD);
        comisionYTD < 0 ? lblYTDCom.classList.replace('text-success', 'text-danger') : lblYTDCom.classList.replace('text-danger', 'text-success');
    }
    
    const blockExpYTD = document.getElementById('ytdBlockExplore');
    if (blockExpYTD) {
        if (exploreYTD > 0) { blockExpYTD.classList.replace('d-none', 'd-flex'); document.getElementById('ytdExplore').innerText = formatCurr(exploreYTD); } 
        else { blockExpYTD.classList.replace('d-flex', 'd-none'); }
    }

    const blockMalYTD = document.getElementById('ytdBlockMalibu');
    if (blockMalYTD) {
        if (malibuYTD > 0) { blockMalYTD.classList.replace('d-none', 'd-flex'); document.getElementById('ytdMalibu').innerText = formatCurr(malibuYTD); } 
        else { blockMalYTD.classList.replace('d-flex', 'd-none'); }
    }

    const lblMesNombre = document.getElementById('lblMesActualNombre');
    if(lblMesNombre) lblMesNombre.innerText = nombresMeses[mesActual];

    const lblVol = document.getElementById('mesVolumen');
    if(lblVol) lblVol.innerText = formatCurr(volMes);
    
    const lblCom = document.getElementById('mesComision');
    if(lblCom) {
        lblCom.innerText = formatCurr(comisionMes);
        comisionMes < 0 ? lblCom.classList.replace('text-success', 'text-danger') : lblCom.classList.replace('text-danger', 'text-success');
    }
    
    const blockExp = document.getElementById('mesBlockExplore');
    if (blockExp) {
        if (exploreMes > 0) { blockExp.classList.replace('d-none', 'd-flex'); document.getElementById('mesExplore').innerText = formatCurr(exploreMes); } 
        else { blockExp.classList.replace('d-flex', 'd-none'); }
    }

    const blockMal = document.getElementById('mesBlockMalibu');
    if (blockMal) {
        if (malibuMes > 0) { blockMal.classList.replace('d-none', 'd-flex'); document.getElementById('mesMalibu').innerText = formatCurr(malibuMes); } 
        else { blockMal.classList.replace('d-flex', 'd-none'); }
    }
}

function actualizarTableroFinanciero(inicio = null, fin = null) {
    const lblTotalCobrar = document.getElementById('lblTotalCobrar');
    const lblVolumen = document.getElementById('lblTotalVolumen');
    const lblExplore = document.getElementById('lblTotalExplore');
    const lblRango = document.getElementById('lblRangoFechas');

    const blockDeducciones = document.getElementById('blockDeduccionesCalculadora');
    const lineaBonusWks = document.getElementById('lineaBonusWeeks');
    const lineaMeseros = document.getElementById('lineaMeseros');

    if (!inicio || !fin) {
        if (lblTotalCobrar) lblTotalCobrar.innerText = '$0.00';
        if (lblVolumen) lblVolumen.innerText = '$0.00';
        if (lblExplore) lblExplore.innerText = '$0.00';
        if (lblRango) lblRango.innerText = 'Selecciona un rango de fechas';
        if (blockDeducciones) blockDeducciones.classList.add('d-none');
        return; 
    }

    let granTotalComision = 0, granTotalVolumen = 0, granTotalExplore = 0, granTotalMalibu = 0;
    let totalBonusWks = 0, totalMeserosFijos = 0;

    filteredData.forEach(item => {
        let esCerrada = item.status === 'Cerrada';
        let pagoBD = parseFloat(item.pago_total) || 0;
        let esDeuda = item.status === 'Caída' && pagoBD < 0; 

        if (esCerrada || esDeuda) {
            
            if (esDeuda) {
                granTotalComision += Math.abs(pagoBD);
            } else {
                granTotalComision += pagoBD;
            }

            if (esCerrada && item.type === 'venta') {
                granTotalVolumen += calcularMiVolumen(item);
                let numVend = parseInt(item.num_vendedores) || 1;

                let esExplore = parseInt(item.es_explore_package) === 1;
                let esExploreHoy = parseInt(item.explore_es_hoy) === 1;

                if (esExplore && esExploreHoy) {
                    let bonoNeto = 225 * 0.77; 
                    granTotalExplore += (bonoNeto / numVend);
                }

                if (parseInt(item.es_malibu) === 1 && parseFloat(item.monto_malibu) > 0) {
                    granTotalMalibu += parseFloat(item.monto_malibu);
                }

                let bwks = parseInt(item.bonus_weeks) || 0;
                totalBonusWks += (bwks * 20) / numVend;

                let fijosItem = 0;
                if(parseInt(item.deduccion_meseros) === 1) fijosItem += 20;
                if(parseInt(item.deduccion_antilavado) === 1) fijosItem += 10;
                if(parseInt(item.deduccion_explore) === 1) fijosItem += 10;
                if(parseInt(item.deduccion_rci) === 1) fijosItem += 10;
                totalMeserosFijos += (fijosItem / numVend);
            }
        }
    });

    const fm = (v) => `$${Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    if (lblTotalCobrar) {
        lblTotalCobrar.innerText = (granTotalComision < 0 ? '-' : '') + fm(granTotalComision);
        granTotalComision < 0 ? lblTotalCobrar.classList.replace('text-success', 'text-danger') : lblTotalCobrar.classList.replace('text-danger', 'text-success');
    }
    
    if (lblVolumen) lblVolumen.innerText = fm(granTotalVolumen);
    if (lblExplore) lblExplore.innerText = fm(granTotalExplore);
    
    const blockMalibu = document.getElementById('blockTotalMalibu');
    const lblMalibu = document.getElementById('lblTotalMalibu');
    if (granTotalMalibu > 0) {
        if(blockMalibu) blockMalibu.classList.replace('d-none', 'd-flex');
        if(lblMalibu) lblMalibu.innerText = fm(granTotalMalibu);
    } else {
        if(blockMalibu) blockMalibu.classList.replace('d-flex', 'd-none');
    }

    if (totalBonusWks > 0 || totalMeserosFijos > 0) {
        blockDeducciones.classList.remove('d-none');
        
        if (totalBonusWks > 0) {
            lineaBonusWks.classList.remove('d-none');
            document.getElementById('calcBonusWeeks').innerText = fm(totalBonusWks);
        } else {
            lineaBonusWks.classList.add('d-none');
        }

        if (totalMeserosFijos > 0) {
            lineaMeseros.classList.remove('d-none');
            document.getElementById('calcMeseros').innerText = fm(totalMeserosFijos);
        } else {
            lineaMeseros.classList.add('d-none');
        }
    } else {
        blockDeducciones.classList.add('d-none');
    }

    if (lblRango) lblRango.innerText = `Del ${inicio} al ${fin}`;
}