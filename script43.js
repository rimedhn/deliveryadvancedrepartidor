// CONFIGURACIÓN
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxzJIehAXgQyZkSwhaZYzZLO3zxkXaZZxLViLLRIuJFITvEAQ4lSpiZXYwdl74DzZls3Q/exec'; // <- Reemplaza por tu Web App URL

const STATUS_LIST = [
  "Creado", "En proceso", "En camino", "En el destino", "Entregado", "Finalizado", "Cancelado", "Cliente no encontrado"
];

let usuarioActual = null;
let orders = [];
let selectedOrder = null;

// =========== UI Y NAVEGACIÓN ===========
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
  document.querySelectorAll('.main-menu button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.main-menu button[data-section="'+sectionId+'"]').forEach(b=>b.classList.add('active'));
  if(sectionId === 'orders') loadOrders();
  if(sectionId === 'profile') showProfileForm();
  if(sectionId === 'login') showLoginForm();
  if(sectionId === 'register') showRegisterForm();
}

// Menú superior
document.querySelectorAll('.main-menu button[data-section]').forEach(btn => {
  btn.onclick = () => goSection(btn.getAttribute('data-section'));
});
document.getElementById('back-orders').onclick = function() {
  goSection('orders');
  selectedOrder = null;
  loadOrders();
};

// =========== LOGIN Y REGISTRO DE USUARIOS ===========
function showLoginForm() {
  const section = document.getElementById('login');
  if (!section) return;
  section.innerHTML = `
    <h2>Iniciar sesión</h2>
    <form id="login-form" autocomplete="off">
      <label for="usuarioLogin">Usuario:
        <input type="text" id="usuarioLogin" required>
      </label>
      <label for="claveLogin">Clave:
        <input type="password" id="claveLogin" required>
      </label>
      <div class="profile-buttons">
        <button type="submit" class="btn-action">Entrar</button>
        <button type="button" class="btn-logout" onclick="goSection('register')">Registrarse</button>
      </div>
    </form>
    <div id="loginMsg"></div>
  `;
  document.getElementById('login-form').onsubmit = loginUsuario;
}

function showRegisterForm() {
  const section = document.getElementById('register');
  if (!section) return;
  section.innerHTML = `
    <h2>Registro Repartidor</h2>
    <form id="register-form" autocomplete="off">
      <label for="nombreRegister">Nombre:
        <input type="text" id="nombreRegister" required>
      </label>
      <label for="usuarioRegister">Usuario:
        <input type="text" id="usuarioRegister" required>
      </label>
      <label for="claveRegister">Clave:
        <input type="password" id="claveRegister" required>
      </label>
      <div class="profile-buttons">
        <button type="submit" class="btn-action">Registrar</button>
        <button type="button" class="btn-logout" onclick="goSection('login')">Ya tengo cuenta</button>
      </div>
    </form>
    <div id="registerMsg"></div>
  `;
  document.getElementById('register-form').onsubmit = registrarUsuario;
}

function registrarUsuario(e) {
  e.preventDefault();
  const nombre = document.getElementById('nombreRegister').value.trim();
  const usuario = document.getElementById('usuarioRegister').value.trim();
  const clave = document.getElementById('claveRegister').value.trim();
  if (!nombre || !usuario || !clave) {
    showAlert("Completa todos los datos", "error");
    return;
  }
  // USAMOS GET para evitar problemas de CORS
  const url = `${WEB_APP_URL}?accion=registro_usuario&nombre=${encodeURIComponent(nombre)}&usuario=${encodeURIComponent(usuario)}&clave=${encodeURIComponent(clave)}`;
  fetch(url)
    .then(r => r.json())
    .then(res => {
      if (res.ok) {
        showAlert(res.msg, "success");
        goSection('login');
      } else {
        document.getElementById('registerMsg').textContent = res.msg;
        showAlert(res.msg, "error");
      }
    })
    .catch(() => showAlert("Error de conexión", "error"));
}

function loginUsuario(e) {
  e.preventDefault();
  const usuario = document.getElementById('usuarioLogin').value.trim();
  const clave = document.getElementById('claveLogin').value.trim();
  if (!usuario || !clave) {
    showAlert("Completa usuario y clave", "error");
    return;
  }
  // USAMOS GET para evitar problemas de CORS
  const url = `${WEB_APP_URL}?accion=login_usuario&usuario=${encodeURIComponent(usuario)}&clave=${encodeURIComponent(clave)}`;
  fetch(url)
    .then(r => r.json())
    .then(res => {
      if (res.ok) {
        usuarioActual = {
          nombre: res.nombre,
          usuario: res.usuario,
          tipo: res.tipo
        };
        localStorage.setItem('fastgo_usuario', JSON.stringify(usuarioActual));
        showAlert("Bienvenido " + res.nombre, "success");
        goSection('orders');
        loadOrders();
      } else {
        document.getElementById('loginMsg').textContent = res.msg;
        showAlert(res.msg, "error");
      }
    })
    .catch(() => showAlert("Error de conexión", "error"));
}

function checkLogin() {
  let u = localStorage.getItem('fastgo_usuario');
  if (u) {
    usuarioActual = JSON.parse(u);
    return true;
  }
  return false;
}

window.logoutDriver = function() {
  localStorage.removeItem('fastgo_usuario');
  usuarioActual = null;
  showAlert("Sesión cerrada", "success");
  goSection('login');
  document.getElementById('orders-list').innerHTML = '';
};
if (document.getElementById('logoutBtn')) document.getElementById('logoutBtn').onclick = logoutDriver;

// =========== PEDIDOS (LECTURA Y RENDERIZADO) ===========
function loadOrders() {
  const list = document.getElementById('orders-list');
  if (!checkLogin()) {
    list.innerHTML = `<div class="loading" style="color:#b00;font-weight:bold;font-size:1.1em;">
      Debes iniciar sesión para ver los pedidos.<br>
      <button class="btn-action" onclick="goSection('login')">Ir a login</button>
    </div>`;
    return;
  }
  list.innerHTML = `<div class="loading">Cargando pedidos...</div>`;
  fetch(WEB_APP_URL + "?accion=listar_pedidos")
    .then(r=>r.json())
    .then(data=>{
      if (!data.ok || !data.pedidos) {
        list.innerHTML = `<div class="loading" style="color:#b00;">Error al cargar pedidos.</div>`;
        return;
      }
      orders = data.pedidos;
      renderOrders();
    });
}

function renderOrders() {
  const list = document.getElementById('orders-list');
  list.innerHTML = '';
  let showCount = 0;
  orders.forEach(order => {
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

// =========== DETALLES Y MAPA DE PEDIDO ===========
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
  let details = `
    <div class="order-stepper">${stepsHtml}</div>
    <ul class="order-data-list">
      <li><strong>Servicio:</strong> ${d.servicio}</li>
      <li><strong>Cliente:</strong> ${d.nombre_cliente}</li>
      <li><strong>Teléfono:</strong> ${d.telefono_cliente} 
        <a href="tel:${d.telefono_cliente}" class="btn-action secondary" title="Llamar al cliente" style="padding:4px 10px;margin-left:8px;"><i class="fas fa-phone"></i></a>
        <a href="https://wa.me/${d.telefono_cliente.replace(/\D/g,'')}" class="btn-action secondary" title="WhatsApp al cliente" target="_blank" style="padding:4px 10px;margin-left:4px;"><i class="fab fa-whatsapp"></i></a>
      </li>
      <li><strong>Origen:</strong> ${d.origen}</li>
      <li><strong>Destino:</strong> ${d.destino}</li>
      <li><strong>Notas:</strong> ${d.notas || 'Sin notas'}</li>
      <li><strong>Fecha:</strong> ${d.fecha || ''}</li>
      <li><strong>ID Pedido:</strong> ${d.id_pedido}</li>
      <li><strong>Estado actual:</strong> <span style="color:#4caf50">${d.estado}</span></li>
      <li><strong>Repartidor:</strong> ${d.driver_name ? d.driver_name : '<span style="color:#888">Sin asignar</span>'}</li>
    </ul>
    <div class="map-container"><div id="orderRouteMap"></div></div>
    <div class="btn-group" style="margin-top:10px;">
      ${canTakeOrder(d) ? `<button class="btn-action" onclick="takeOrder('${d.id_pedido}')"><i class="fas fa-motorcycle"></i> Tomar pedido</button>` : ""}
      ${canUpdateStatus(d) ? renderStatusSelect(d) : ""}
    </div>
  `;
  document.getElementById('order-details-content').innerHTML = details;
  setTimeout(()=>renderMapRoute(d),200);
}

function renderStatusSelect(d) {
  let idx = statusIndex(d.estado);
  let options = STATUS_LIST.map((st,i)=>{
    if(i<idx) return ""; // solo estados siguientes
    return `<option value="${st}"${st===d.estado?' selected':''}>${st}</option>`;
  }).join('');
  return `
    <select class="order-status-select" id="statusSelect_${d.id_pedido}">
      ${options}
    </select>
    <button class="btn-action" onclick="updateOrderStatus('${d.id_pedido}')"><i class="fas fa-sync"></i> Cambiar estado</button>
  `;
}

function renderMapRoute(order) {
  let mapDiv = document.getElementById('orderRouteMap');
  mapDiv.innerHTML = "";
  let coordsOrigin = order.cords_origen ? order.cords_origen.split(',').map(Number) : null;
  let coordsDest = order.cords_destino ? order.cords_destino.split(',').map(Number) : null;
  if(!coordsOrigin || !coordsDest) {
    mapDiv.innerHTML = `<div style="padding:20px;color:#888;">No hay datos de ubicación para este pedido.</div>`;
    return;
  }
  let map = L.map('orderRouteMap').setView(coordsOrigin, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
  L.marker(coordsOrigin).addTo(map).bindPopup("Origen").openPopup();
  L.marker(coordsDest).addTo(map).bindPopup("Destino");
  L.polyline([coordsOrigin, coordsDest], {color:'#4caf50',weight:4}).addTo(map);
  setTimeout(()=>map.invalidateSize(),150);
}

// =========== ACCIONES DE PEDIDO ===========
function canTakeOrder(order) {
  return !order.driver_name && checkLogin();
}
function takeOrder(id_pedido) {
  if (!checkLogin()) return showAlert("Debes iniciar sesión", "error");
  const url = `${WEB_APP_URL}?accion=actualizar_pedido&id_pedido=${encodeURIComponent(id_pedido)}&driver_name=${encodeURIComponent(usuarioActual.nombre)}&driver_contact=${encodeURIComponent(usuarioActual.usuario)}`;
  fetch(url)
    .then(r=>r.json())
    .then(res=>{
      if(res.ok) {
        showAlert("¡Pedido asignado!", "success");
        goSection('orders');
        loadOrders();
      } else {
        showAlert(res.msg||"No se pudo tomar el pedido", "error");
      }
    });
}
function canUpdateStatus(order) {
  return order.driver_name === usuarioActual?.nombre;
}
function updateOrderStatus(id_pedido) {
  const sel = document.getElementById("statusSelect_"+id_pedido);
  if(!sel) return;
  const estado = sel.value;
  const url = `${WEB_APP_URL}?accion=actualizar_pedido&id_pedido=${encodeURIComponent(id_pedido)}&estado=${encodeURIComponent(estado)}`;
  fetch(url)
    .then(r=>r.json())
    .then(res=>{
      if(res.ok) {
        showAlert("Estado actualizado", "success");
        goSection('orders');
        loadOrders();
      } else {
        showAlert(res.msg||"No se pudo cambiar el estado", "error");
      }
    });
}

// =========== PERFIL DE USUARIO ===========
function showProfileForm() {
  const section = document.getElementById('profile');
  if (!section) return;
  if (!checkLogin()) {
    section.innerHTML = `<div class="loading">Debes iniciar sesión para editar tu perfil.<br><button class="btn-action" onclick="goSection('login')">Iniciar sesión</button></div>`;
    return;
  }
  section.innerHTML = `
    <h2>Perfil Repartidor</h2>
    <div>
      <b>Nombre:</b> ${usuarioActual.nombre}<br>
      <b>Usuario:</b> ${usuarioActual.usuario}<br>
      <b>Tipo:</b> ${usuarioActual.tipo}
    </div>
    <div style="margin-top:30px;"><button class="btn-logout" onclick="logoutDriver()"><i class="fas fa-sign-out-alt"></i> Cerrar sesión</button></div>
  `;
}

// =========== INICIALIZACIÓN ===========
window.onload = function() {
  if (checkLogin()) {
    goSection('orders');
    loadOrders();
  } else {
    goSection('login');
    showLoginForm();
  }
};
