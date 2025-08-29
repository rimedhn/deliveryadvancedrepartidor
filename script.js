// CONFIGURA AQUÍ TU SHEET_ID Y NOMBRE DE HOJAS
const SHEET_ID = "TU_ID_DE_GOOGLE_SHEET";
const ORDERS_SHEET = "Pedidos";
const PROFILE_SHEET = "Repartidores";

// URLs para OpenSheet JSON
const ORDERS_URL = `https://opensheet.vercel.app/${SHEET_ID}/${ORDERS_SHEET}`;
const PROFILE_URL = `https://opensheet.vercel.app/${SHEET_ID}/${PROFILE_SHEET}`;

let orders = [];
let driverProfile = null;

// --- Sección de Pedidos ---

function loadOrders() {
  const list = document.getElementById('orders');
  if (!driverProfile) {
    list.innerHTML = `<div class="loading" style="color:#b00;font-weight:bold;">
      Debes registrar tu perfil para ver los pedidos.<br>
      <button class="btn-action" onclick="goSection('profile')">Ir a registro</button>
    </div>`;
    return;
  }
  list.innerHTML = `<div class="loading">Cargando pedidos...</div>`;
  fetch(ORDERS_URL)
    .then(r => r.json())
    .then(data => {
      orders = data;
      renderOrders();
    });
}

function renderOrders() {
  const list = document.getElementById('orders');
  if (!orders || !orders.length) {
    list.innerHTML = `<div class="loading">No hay pedidos disponibles.</div>`;
    return;
  }
  let html = `<h2>Pedidos disponibles</h2>
    <div class="orders-list">`;
  orders.forEach(order => {
    html += `
      <div class="order-card">
        <div><strong>Negocio:</strong> ${order.negocio || 'N/A'}</div>
        <div><strong>Cliente:</strong> ${order.cliente || 'N/A'}</div>
        <div><strong>Destino:</strong> ${order.destino || 'N/A'}</div>
        <div><strong>Costo estimado:</strong> L. ${order.costo_estimado || 'N/A'}</div>
        <div class="order-status">${order.estado || 'Pendiente'}</div>
      </div>`;
  });
  html += `</div>`;
  list.innerHTML = html;
}

// --- Sección de Perfil ---

function loadProfileSection() {
  const section = document.getElementById('profile');
  section.innerHTML = `
    <h2>Tu perfil</h2>
    <form id="driver-profile-form" autocomplete="off">
      <label for="driverName">Nombre:
        <input type="text" id="driverName" required>
      </label>
      <label for="driverContact">Contacto (teléfono o email):
        <input type="text" id="driverContact" required>
      </label>
      <div class="profile-buttons">
        <button type="submit" class="btn-action">Guardar registro</button>
        <button type="button" id="logoutBtn" class="btn-logout">
          <i class="fas fa-sign-out-alt"></i> Cerrar sesión
        </button>
      </div>
    </form>
    <div id="profileSavedMsg"></div>
  `;
  document.getElementById('driver-profile-form').onsubmit = saveProfile;
  document.getElementById('logoutBtn').onclick = logoutDriver;
  // Si existe perfil, precargar datos
  if (driverProfile) {
    document.getElementById('driverName').value = driverProfile.name || '';
    document.getElementById('driverContact').value = driverProfile.contact || '';
  }
}

function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('driverName').value.trim();
  const contact = document.getElementById('driverContact').value.trim();
  if (!name || !contact) {
    showAlert("Completa todos los campos.", "error");
    return;
  }
  driverProfile = { name, contact };
  localStorage.setItem('fastgo_driver_profile', JSON.stringify(driverProfile));
  document.getElementById('profileSavedMsg').textContent = "¡Perfil guardado correctamente!";
  setTimeout(() => { document.getElementById('profileSavedMsg').textContent = ""; }, 2400);
  goSection('orders');
  loadOrders();
}

function logoutDriver() {
  localStorage.removeItem('fastgo_driver_profile');
  driverProfile = null;
  showAlert("Sesión cerrada", "success");
  goSection('profile');
  loadProfileSection();
  document.getElementById('orders').innerHTML = '';
}

// --- Utilidades ---

function goSection(sectionId) {
  document.querySelectorAll('main > .section').forEach(sec => sec.style.display = 'none');
  document.getElementById(sectionId).style.display = 'block';
  if (sectionId === 'orders') loadOrders();
  if (sectionId === 'profile') loadProfileSection();
}

function showAlert(msg, type="success") {
  let alertDiv = document.createElement('div');
  alertDiv.className = `custom-alert ${type}`;
  alertDiv.textContent = msg;
  document.body.appendChild(alertDiv);
  alertDiv.style.display = "block";
  setTimeout(() => {
    alertDiv.style.display = "none";
    document.body.removeChild(alertDiv);
  }, 1900);
}

// --- Inicialización ---

window.addEventListener('DOMContentLoaded', () => {
  // Cargar perfil del localStorage si existe
  try {
    let profileData = localStorage.getItem('fastgo_driver_profile');
    if (profileData) driverProfile = JSON.parse(profileData);
  } catch {}
  goSection('orders'); // Muestra pedidos al inicio
});
