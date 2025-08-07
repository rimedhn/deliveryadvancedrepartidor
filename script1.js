// Configuración
const ORDER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQThJvhjQjr3Gjjh7iUX_jN_Kq5-v0EhiDOjjwucInYO0iR7V2MI0dI9728YOt653JFSQYgFYtzSAQg/pub?gid=740601453&single=true&output=csv';
const SHEETDB_URL = "https://sheetdb.io/api/v1/62aiawhmn45df"; // <-- cambia por tu endpoint SheetDB
const STATUS_LIST = [
  "Creado", "En proceso", "En camino", "En el destino", "Entregado", "Finalizado", "Cancelado", "Cliente no encontrado"
];
let driverProfile = null;
let orders = [];
let selectedOrder = null;
let myLocation = null;

// ------ UI y navegación --------
function showAlert(msg, type="error") {
  const alertBox = document.getElementById("customAlert");
  alertBox.textContent = msg;
  alertBox.className = "custom-alert " + type;
  alertBox.style.display = "block";
  setTimeout(()=>{ alertBox.style.display = "none"; }, 2500);
}
function goSection(sectionId) {
  document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
  document.getElementById(sectionId).style.display = 'block';
  document.querySelectorAll('.app-menu button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.app-menu button[data-section="'+sectionId+'"]').forEach(b=>b.classList.add('active'));
}
document.querySelectorAll('.app-menu button').forEach(btn => {
  btn.onclick = () => {
    goSection(btn.getAttribute('data-section'));
    if(btn.getAttribute('data-section') === 'orders') loadOrders();
  };
});
document.getElementById('back-orders').onclick = function() {
  goSection('orders');
  selectedOrder = null;
  loadOrders();
};
document.getElementById('driver-profile-form').onsubmit = function(e){
  e.preventDefault();
  const name = document.getElementById('driverName').value.trim();
  const contact = document.getElementById('driverContact').value.trim();
  if(!name || !contact) {
    showAlert("Completa todos los datos","error");
    return;
  }
  driverProfile = {name, contact};
  localStorage.setItem('fastgo_driver_profile', JSON.stringify(driverProfile));
  document.getElementById('profileSavedMsg').textContent = "Perfil guardado correctamente.";
  showAlert("Perfil guardado", "success");
  goSection('orders');
  loadOrders();
};
function loadProfile() {
  let p = localStorage.getItem('fastgo_driver_profile');
  if(p) {
    driverProfile = JSON.parse(p);
    document.getElementById('driverName').value = driverProfile.name;
    document.getElementById('driverContact').value = driverProfile.contact;
  }
}

// ---------- Pedidos (lectura y renderizado) ----------
function parseCSV(csv) {
  const rows = csv.trim().split('\n');
  const parseRow = row => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' && (i === 0 || row[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.replace(/^"|"$/g, ''));
    return result;
  };
  const header = parseRow(rows[0]);
  return rows.slice(1).map(row => {
    const values = parseRow(row);
    let obj = {};
    header.forEach((k, i) => obj[k.trim()] = values[i] ? values[i].trim() : '');
    return obj;
  });
}
function loadOrders() {
  const list = document.getElementById('orders-list');
  list.innerHTML = `<div class="loading">Cargando pedidos...</div>`;
  fetch(ORDER_SHEET_URL)
    .then(r=>r.text())
    .then(csv=>{
      orders = parseCSV(csv);
      renderOrders();
    });
}
function renderOrders() {
  const list = document.getElementById('orders-list');
  list.innerHTML = '';
  let showCount = 0;
  orders.forEach(order => {
    // Solo pedidos activos
    if(order.estado === "Finalizado" || order.estado === "Cancelado") return;
    showCount++;
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `
      <div><b>${order.servicio || "Servicio"}</b> <span style="color:#888;">(${order.id_pedido || ''})</span></div>
      <div><i class="fas fa-user"></i> ${order.nombre_cliente || ''}</div>
      <div><i class="fas fa-map-marker-alt"></i> ${order.origen || ''}</div>
      <div><i class="fas fa-location-arrow"></i> ${order.destino || ''}</div>
      <div class="order-status">${order.estado}</div>
      <div class="order-taken-by">${order.driver_name ? `<i class="fas fa-motorcycle"></i> ${order.driver_name}` : `<i class="fas fa-clock"></i> Sin asignar`}</div>
    `;
    card.onclick = () => showOrderDetails(order.id_pedido);
    list.appendChild(card);
  });
  if (showCount === 0) {
    list.innerHTML = `<div class="loading">No hay pedidos activos en este momento.</div>`;
  }
}

// ------ Detalles y pasos del pedido -----
function statusIndex(status) {
  return STATUS_LIST.indexOf(status);
}
function showOrderDetails(orderId) {
  selectedOrder = orders.find(o=>o.id_pedido === orderId);
  if(!selectedOrder) return;
  goSection('order-details');
  renderOrderDetails();
}
function renderOrderDetails() {
  const d = selectedOrder;
  let stepsHtml = STATUS_LIST.map((st,i)=>{
    let cls = '';
    if (statusIndex(d.estado) > i) cls = 'done';
    if (statusIndex(d.estado) === i) cls = 'active';
    return `<div class="order-step ${cls}">${st}</div>`;
  }).join('');
  let isMine = d.driver_contact === (driverProfile?.contact || "");
  let canTake = !d.driver_contact || d.driver_contact === "";
  let canRelease = isMine && (d.estado === "En proceso");
  let canUpdate = isMine && (["En proceso","En camino","En el destino","Entregado"].includes(d.estado));
  let isBusy = d.driver_contact && d.driver_contact !== driverProfile?.contact && d.estado === "En proceso";
  let details = `
    <div class="order-stepper">${stepsHtml}</div>
    <ul class="order-data-list">
      <li><strong>Servicio:</strong> ${d.servicio}</li>
      <li><strong>Cliente:</strong> ${d.nombre_cliente}</li>
      <li><strong>Teléfono:</strong> ${d.telefono_cliente}</li>
      <li><strong>Origen:</strong> ${d.origen}</li>
      <li><strong>Destino:</strong> ${d.destino}</li>
      <li><strong>Notas:</strong> ${d.notas || 'Sin notas'}</li>
      <li><strong>Fecha:</strong> ${d.fecha || ''}</li>
      <li><strong>ID Pedido:</strong> ${d.id_pedido}</li>
      <li><strong>Estado actual:</strong> <span style="color:#4caf50">${d.estado}</span></li>
      <li><strong>Repartidor:</strong> ${d.driver_name ? d.driver_name : '<span style="color:#888">Sin asignar</span>'}</li>
    </ul>
    <div class="map-container"><div id="orderRouteMap"></div></div>
    <div class="btn-group">
  `;

  // Botones principales
  if (canTake && !isBusy) {
    details += `<button class="btn-action" onclick="takeOrder('${d.id_pedido}')"><i class="fas fa-check"></i> Tomar pedido</button>
    <button class="btn-action occupied" onclick="markOccupied('${d.id_pedido}')"><i class="fas fa-times-circle"></i> Estoy ocupado</button>`;
  } else if (canRelease) {
    details += `<button class="btn-action cancel" onclick="releaseOrder('${d.id_pedido}')"><i class="fas fa-sign-out-alt"></i> Liberar pedido</button>`;
  }
  if (canUpdate) {
    // Siguiente estatus
    let nextIdx = statusIndex(d.estado)+1;
    if (nextIdx < STATUS_LIST.length) {
      details += `<button class="btn-action" onclick="nextStatus('${d.id_pedido}')"><i class="fas fa-arrow-right"></i> Siguiente paso</button>`;
    }
    details += `
      <select class="order-status-select" id="manualStatus">
        ${STATUS_LIST.map(s=>`<option value="${s}" ${s===d.estado?'selected':''}>${s}</option>`).join('')}
      </select>
      <button class="btn-action secondary" onclick="changeStatusManual('${d.id_pedido}')"><i class="fas fa-edit"></i> Cambiar estatus</button>
    `;
  }
  // Ruta directa
  details += `<button class="btn-action secondary" onclick="traceRoute('origin')"><i class="fas fa-map"></i> Ruta a origen</button>
              <button class="btn-action secondary" onclick="traceRoute('destination')"><i class="fas fa-location-arrow"></i> Ruta a destino</button>
              </div>
  `;
  document.getElementById('order-details-content').innerHTML = details;

  // Renderiza el mapa y traza
  setTimeout(()=>renderMapRoute(d),200);
}

// ---- Toma, libera, cambia estatus ----
window.takeOrder = function(orderId) {
  if (!driverProfile) { showAlert("Completa tu perfil primero"); goSection('profile'); return; }
  updateOrder(orderId, {
    estado: "En proceso",
    driver_name: driverProfile.name,
    driver_contact: driverProfile.contact
  }, "Pedido asignado, ¡empieza tu servicio!");
};
window.releaseOrder = function(orderId) {
  updateOrder(orderId, {
    estado: "Creado",
    driver_name: "",
    driver_contact: ""
  }, "Pedido liberado, ahora está disponible para otro repartidor.");
};
window.markOccupied = function(orderId) {
  showAlert("¡Entendido! Puedes tomar otro pedido cuando estés disponible.", "success");
};
window.nextStatus = function(orderId) {
  const d = orders.find(o=>o.id_pedido === orderId);
  let idx = statusIndex(d.estado);
  if (idx < STATUS_LIST.length-1) {
    let next = STATUS_LIST[idx+1];
    updateOrder(orderId, {estado: next});
  }
};
window.changeStatusManual = function(orderId) {
  let st = document.getElementById('manualStatus').value;
  updateOrder(orderId, {estado: st});
};
function updateOrder(orderId, changes, msg="Estatus actualizado") {
  let data = {
    id_pedido: orderId,
    ...changes
  };
  fetch(SHEETDB_URL + "/id_pedido/" + orderId, {
    method: "PATCH",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({data})
  }).then(r=>r.json())
   .then(()=>{
     showAlert(msg, "success");
     setTimeout(()=>{
       loadOrders();
       goSection('orders');
     }, 700);
   }).catch(()=>showAlert("Error actualizando pedido","error"));
}

// ----------- MAPA y traza de rutas ------------
function renderMapRoute(order) {
  let mapDiv = document.getElementById('orderRouteMap');
  mapDiv.innerHTML = "";
  let coordsOrigin = order.cords_origen ? order.cords_origen.split(',').map(Number) : null;
  let coordsDest = order.cords_destino ? order.cords_destino.split(',').map(Number) : null;
  if(!coordsOrigin || !coordsDest) {
    mapDiv.innerHTML = `<div style="padding:20px;color:#888;">No hay datos de ubicación para este pedido.</div>`;
    return;
  }
  // Inicializa el mapa
  let map = L.map('orderRouteMap').setView(coordsOrigin, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
  const markerOrigin = L.marker(coordsOrigin).addTo(map).bindPopup("Origen").openPopup();
  const markerDest = L.marker(coordsDest).addTo(map).bindPopup("Destino");
  // Dibuja línea entre origen y destino
  L.polyline([coordsOrigin, coordsDest], {color:'#4caf50',weight:4}).addTo(map);
  setTimeout(()=>map.invalidateSize(),150);
}

// --------- Trazar ruta con Google Maps (desde ubicación actual) ---------
window.traceRoute = function(type) {
  const d = selectedOrder;
  if(!navigator.geolocation) return showAlert("No se puede obtener tu ubicación. Activa el GPS.");
  navigator.geolocation.getCurrentPosition(pos => {
    let from = pos.coords.latitude + "," + pos.coords.longitude;
    let to = "";
    if(type==="origin") {
      to = d.cords_origen;
    } else {
      to = d.cords_destino;
    }
    if(!to) return showAlert("No hay coordenadas de destino.");
    let url = `https://www.google.com/maps/dir/?api=1&origin=${from}&destination=${to}&travelmode=driving`;
    window.open(url,"_blank");
  }, () => showAlert("No se pudo obtener tu ubicación. Inténtalo de nuevo."));
}

// --------- Inicialización ---------
window.onload = function() {
  loadProfile();
  if(!driverProfile) goSection('profile');
  else { goSection('orders'); loadOrders(); }
};
