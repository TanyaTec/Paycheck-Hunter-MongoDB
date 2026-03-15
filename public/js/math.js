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
    
    let chargebackManual = parseFloat(document.getElementById('txtChargeback') ? document.getElementById('txtChargeback').value : 0) || 0;
    let pagoNetoFinal = subtotalPostImpuestos - miParteGastosDespues - chargebackManual;

    const status = document.getElementById('cmbStatus').value;
    const cmbLiq = document.getElementById('cmbLiquidacionCaida');

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
    
    let volMes = 0, comisionMes = 0, exploreMes = 0, malibuMes = 0, cashMes = 0;
    let volYTD = 0, comisionYTD = 0, exploreYTD = 0, malibuYTD = 0, cashYTD = 0;

    // CIRUGÍA: Blindaje universal para valores que vienen de la Base de Datos
    const isTrue = (val) => val == 1 || val === true || val === 'true' || val === '1';

    allDataGlobal.forEach(item => {
        if (item.type === 'bono_cash' && item.fecha) {
            let [yyyy, mm, dd] = item.fecha.split('-');
            let añoBono = parseInt(yyyy);
            let mesBono = parseInt(mm) - 1;
            let montoCash = parseFloat(item.monto_mxn) || 0;

            if (añoBono === anioActual) {
                cashYTD += montoCash;
                if (mesBono === mesActual) {
                    cashMes += montoCash;
                }
            }
            return; 
        }

        let esCerrada = item.status === 'Cerrada';
        let pagoBD = parseFloat(item.pago_total) || 0;
        let esDeuda = item.status === 'Caída' && pagoBD < 0;

        if ((esCerrada || esDeuda) && item.fecha) {
            let [yyyy, mm, dd] = item.fecha.split('-');
            let añoVenta = parseInt(yyyy);
            let mesVenta = parseInt(mm) - 1;

            if (añoVenta === anioActual) {
                comisionYTD += esDeuda ? Math.abs(pagoBD) : pagoBD;
                
                if (esCerrada && item.type === 'venta') {
                    volYTD += calcularMiVolumen(item);
                    let numVend = parseInt(item.num_vendedores) || 1;
                    
                    // Blindaje aplicado a Explore y Malibu
                    if (isTrue(item.es_explore_package) && isTrue(item.explore_es_hoy)) {
                        exploreYTD += ( (225 * 0.77) / numVend );
                    }
                    if (isTrue(item.es_malibu) && parseFloat(item.monto_malibu) > 0) {
                        malibuYTD += parseFloat(item.monto_malibu);
                    }
                }
            }

            if (añoVenta === anioActual && mesVenta === mesActual) {
                comisionMes += esDeuda ? Math.abs(pagoBD) : pagoBD;

                if (esCerrada && item.type === 'venta') {
                    volMes += calcularMiVolumen(item);
                    let numVend = parseInt(item.num_vendedores) || 1;

                    // Blindaje aplicado a Explore y Malibu
                    if (isTrue(item.es_explore_package) && isTrue(item.explore_es_hoy)) {
                        exploreMes += ( (225 * 0.77) / numVend );
                    }
                    if (isTrue(item.es_malibu) && parseFloat(item.monto_malibu) > 0) {
                        malibuMes += parseFloat(item.monto_malibu);
                    }
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
    
    // CIRUGÍA UI: Usar remove/add en lugar de replace para evitar bloqueos visuales
    const blockExpYTD = document.getElementById('ytdBlockExplore');
    if (blockExpYTD) {
        if (exploreYTD > 0) { 
            blockExpYTD.classList.remove('d-none'); blockExpYTD.classList.add('d-flex'); 
            document.getElementById('ytdExplore').innerText = formatCurr(exploreYTD); 
        } else { 
            blockExpYTD.classList.remove('d-flex'); blockExpYTD.classList.add('d-none'); 
        }
    }

    const blockMalYTD = document.getElementById('ytdBlockMalibu');
    if (blockMalYTD) {
        if (malibuYTD > 0) { 
            blockMalYTD.classList.remove('d-none'); blockMalYTD.classList.add('d-flex'); 
            document.getElementById('ytdMalibu').innerText = formatCurr(malibuYTD); 
        } else { 
            blockMalYTD.classList.remove('d-flex'); blockMalYTD.classList.add('d-none'); 
        }
    }

    const blockCashYTD = document.getElementById('ytdBlockCash');
    if (blockCashYTD) {
        if (cashYTD > 0) { 
            blockCashYTD.classList.remove('d-none'); blockCashYTD.classList.add('d-flex'); 
            document.getElementById('ytdCash').innerText = formatCurr(cashYTD); 
        } else { 
            blockCashYTD.classList.remove('d-flex'); blockCashYTD.classList.add('d-none'); 
        }
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
        if (exploreMes > 0) { 
            blockExp.classList.remove('d-none'); blockExp.classList.add('d-flex'); 
            document.getElementById('mesExplore').innerText = formatCurr(exploreMes); 
        } else { 
            blockExp.classList.remove('d-flex'); blockExp.classList.add('d-none'); 
        }
    }

    const blockMal = document.getElementById('mesBlockMalibu');
    if (blockMal) {
        if (malibuMes > 0) { 
            blockMal.classList.remove('d-none'); blockMal.classList.add('d-flex'); 
            document.getElementById('mesMalibu').innerText = formatCurr(malibuMes); 
        } else { 
            blockMal.classList.remove('d-flex'); blockMal.classList.add('d-none'); 
        }
    }

    const blockCashMes = document.getElementById('mesBlockCash');
    if (blockCashMes) {
        if (cashMes > 0) { 
            blockCashMes.classList.remove('d-none'); blockCashMes.classList.add('d-flex'); 
            document.getElementById('mesCash').innerText = formatCurr(cashMes); 
        } else { 
            blockCashMes.classList.remove('d-flex'); blockCashMes.classList.add('d-none'); 
        }
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
    
    const blockTotalCash = document.getElementById('blockTotalCash');
    const lblTotalCash = document.getElementById('lblTotalCash');

    // CONSTANTES NUEVAS PARA LA MAGIA UI
    const placeholder = document.getElementById('placeholderCalculadora');
    const resultados = document.getElementById('resultadosCalculadora');

    // ESCENARIO 1: NO HAY FECHAS (Estado Limpio / Inicial)
    if (!inicio || !fin) {
        if (lblTotalCobrar) lblTotalCobrar.innerText = '$0.00';
        if (lblVolumen) lblVolumen.innerText = '$0.00';
        if (lblExplore) lblExplore.innerText = '$0.00';
        if (lblRango) {
            lblRango.innerText = 'Esperando fechas...';
            lblRango.classList.replace('text-dark', 'text-muted');
        }
        if (blockDeducciones) blockDeducciones.classList.add('d-none');
        
        if (blockTotalCash) { blockTotalCash.classList.remove('d-flex'); blockTotalCash.classList.add('d-none'); }
        if (lblTotalCash) lblTotalCash.innerText = '$0.00';

        // MAGIA UI: Mostrar Placeholder, Ocultar Resultados
        if (placeholder) { placeholder.classList.remove('d-none'); placeholder.classList.add('d-flex'); }
        if (resultados) { resultados.classList.remove('d-flex'); resultados.classList.add('d-none'); }

        return; 
    }

    // ESCENARIO 2: SÍ HAY FECHAS (Empieza el cálculo)
    let granTotalComision = 0, granTotalVolumen = 0, granTotalExplore = 0, granTotalMalibu = 0, granTotalCash = 0;
    let totalBonusWks = 0, totalMeserosFijos = 0;

    // Blindaje universal
    const isTrue = (val) => val == 1 || val === true || val === 'true' || val === '1';

    filteredData.forEach(item => {
        if (item.type === 'bono_cash') {
            granTotalCash += parseFloat(item.monto_mxn) || 0;
            return; 
        }

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

                if (isTrue(item.es_explore_package) && isTrue(item.explore_es_hoy)) {
                    let bonoNeto = 225 * 0.77; 
                    granTotalExplore += (bonoNeto / numVend);
                }

                if (isTrue(item.es_malibu) && parseFloat(item.monto_malibu) > 0) {
                    granTotalMalibu += parseFloat(item.monto_malibu);
                }

                let bwks = parseInt(item.bonus_weeks) || 0;
                totalBonusWks += (bwks * 20) / numVend;

                let fijosItem = 0;
                if(isTrue(item.deduccion_meseros)) fijosItem += 20;
                if(isTrue(item.deduccion_antilavado)) fijosItem += 10;
                if(isTrue(item.deduccion_explore)) fijosItem += 10;
                if(isTrue(item.deduccion_rci)) fijosItem += 10;
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
        if(blockMalibu) { blockMalibu.classList.remove('d-none'); blockMalibu.classList.add('d-flex'); }
        if(lblMalibu) lblMalibu.innerText = fm(granTotalMalibu);
    } else {
        if(blockMalibu) { blockMalibu.classList.remove('d-flex'); blockMalibu.classList.add('d-none'); }
    }

    if (granTotalCash > 0) {
        if(blockTotalCash) { blockTotalCash.classList.remove('d-none'); blockTotalCash.classList.add('d-flex'); }
        if(lblTotalCash) lblTotalCash.innerText = fm(granTotalCash);
    } else {
        if(blockTotalCash) { blockTotalCash.classList.remove('d-flex'); blockTotalCash.classList.add('d-none'); }
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

    if (lblRango) {
        lblRango.innerText = `Del ${inicio} al ${fin}`;
        lblRango.classList.replace('text-muted', 'text-dark');
    }

    // MAGIA UI FINAL: Ocultar Placeholder, Mostrar Resultados Calculados
    if (placeholder) { placeholder.classList.remove('d-flex'); placeholder.classList.add('d-none'); }
    if (resultados) { resultados.classList.remove('d-none'); resultados.classList.add('d-flex'); }
}