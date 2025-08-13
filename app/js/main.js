const API = '';

async function fetchCustomers() {
  const res = await fetch('/api/customers');
  const data = await res.json();
  return data.data || data;
}

function showAlert(msg, type='info') {
  const a = document.getElementById('alert');
  a.style.display = 'block';
  a.className = 'alert alert-' + type;
  a.innerText = msg;
  setTimeout(()=> a.style.display='none', 3000);
}

async function loadTable() {
  const table = document.querySelector('#customersTable tbody');
  table.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
  try {
    const { data } = await fetch('/api/customers').then(r => r.json());
    table.innerHTML = '';
    data.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.customer_id}</td>
        <td>${c.name}</td>
        <td>${c.identification_number}</td>
        <td>${c.email || ''}</td>
        <td>${c.phone || ''}</td>
        <td>
          <button class="btn btn-sm btn-primary btn-edit" data-id="${c.customer_id}">Edit</button>
          <button class="btn btn-sm btn-danger btn-del" data-id="${c.customer_id}">Delete</button>
        </td>
      `;
      table.appendChild(tr);
    });
  } catch (err) {
    table.innerHTML = '<tr><td colspan="6">Error loading</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTable();

  document.getElementById('btnReload').addEventListener('click', loadTable);
  document.getElementById('btnOpenNew').addEventListener('click', () => {
    document.getElementById('customerForm').reset();
    document.getElementById('customer_id').value = '';
    new bootstrap.Modal(document.getElementById('customerModal')).show();
  });

  document.getElementById('customersTable').addEventListener('click', async (e) => {
    if (e.target.matches('.btn-edit')) {
      const id = e.target.dataset.id;
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) return showAlert('Error fetching customer', 'danger');
      const data = await res.json();
      document.getElementById('customer_id').value = data.customer_id;
      document.getElementById('name').value = data.name;
      document.getElementById('identification_number').value = data.identification_number;
      document.getElementById('email').value = data.email || '';
      document.getElementById('phone').value = data.phone || '';
      document.getElementById('address').value = data.address || '';
      new bootstrap.Modal(document.getElementById('customerModal')).show();
    } else if (e.target.matches('.btn-del')) {
      if (!confirm('Delete customer?')) return;
      const id = e.target.dataset.id;
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Deleted', 'success');
        loadTable();
      } else {
        showAlert('Delete failed', 'danger');
      }
    }
  });

  document.getElementById('customerForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = document.getElementById('customer_id').value;
    const payload = {
      name: document.getElementById('name').value,
      identification_number: document.getElementById('identification_number').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value
    };
    let res;
    if (id) {
      res = await fetch(`/api/customers/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
      res = await fetch(`/api/customers`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    if (res.ok) {
      showAlert('Saved', 'success');
      loadTable();
      bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
    } else {
      const err = await res.json();
      showAlert('Error saving: ' + (err.error || JSON.stringify(err)), 'danger');
    }
  });
});