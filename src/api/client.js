// src/api/client.js
// Centralized API client — Supabase ki jagah ye use hoga

// Relative URL — Vite proxy /api/* → localhost:5000 (works on mobile too)
const API_BASE = import.meta.env.VITE_API_URL || '';

// ── Core request function ──
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('oasi_token');

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  });

  // Token expire ho gaya — logout
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('oasi_token');
    localStorage.removeItem('oasi_user');
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(errData.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ── API methods ──
export const api = {

  // AUTH
  auth: {
    login:  (beltNumber, password) =>
      apiCall('/api/auth/login', { method: 'POST', body: JSON.stringify({ beltNumber, password }) }),
    logout: () =>
      apiCall('/api/auth/logout', { method: 'POST' }),
    me: () =>
      apiCall('/api/auth/me'),
  },

  // PERSONNEL
  personnel: {
    list:   (params = {}) =>
      apiCall(`/api/personnel?${new URLSearchParams(params)}`),
    get:    (id) =>
      apiCall(`/api/personnel/${id}`),
    create: (data) => {
      if (data instanceof FormData) {
        const token = localStorage.getItem('oasi_token');
        return fetch(`${API_BASE}/api/personnel`, {
          method: 'POST',
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
          body: data,
        }).then(async r => {
          if (r.status === 401 || r.status === 403) { window.location.href = '/login'; return; }
          if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
          return r.json();
        });
      }
      return apiCall('/api/personnel', { method: 'POST', body: JSON.stringify(data) });
    },
    upsert: (data) =>
      apiCall('/api/personnel/upsert', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => {
      if (data instanceof FormData) {
        const token = localStorage.getItem('oasi_token');
        return fetch(`${API_BASE}/api/personnel/${id}`, {
          method: 'PUT',
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
          body: data,
        }).then(async r => {
          if (r.status === 401 || r.status === 403) { window.location.href = '/login'; return; }
          if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
          return r.json();
        });
      }
      return apiCall(`/api/personnel/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    remove: (id) =>
      apiCall(`/api/personnel/${id}`, { method: 'DELETE' }),
    postings: (id) =>
      apiCall(`/api/personnel/${id}/postings`),
    addPosting: (id, data) =>
      apiCall(`/api/personnel/${id}/postings`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // ATTENDANCE
  attendance: {
    get:   (params = {}) =>
      apiCall(`/api/attendance?${new URLSearchParams(params)}`),
    mark:  (data) =>
      apiCall('/api/attendance', { method: 'POST', body: JSON.stringify(data) }),
    bulk:  (records) =>
      apiCall('/api/attendance/bulk', { method: 'POST', body: JSON.stringify(records) }),
    stats: (params = {}) =>
      apiCall(`/api/attendance/stats?${new URLSearchParams(params)}`),
  },

  // HIERARCHY
  hierarchy: {
    stats:      () => apiCall('/api/hierarchy/stats'),
    nodes:      (parentId) =>
      apiCall(`/api/hierarchy/nodes${parentId ? `?parentId=${parentId}` : ''}`),
    createNode: (data) =>
      apiCall('/api/hierarchy/nodes', { method: 'POST', body: JSON.stringify(data) }),
    updateNode: (id, data) =>
      apiCall(`/api/hierarchy/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteNode: (id) =>
      apiCall(`/api/hierarchy/nodes/${id}`, { method: 'DELETE' }),
    clearNodes: () =>
      apiCall('/api/hierarchy/nodes', { method: 'DELETE' }),
    importCSV:  (rows, state_name) =>
      apiCall('/api/hierarchy/import-csv', { method: 'POST', body: JSON.stringify({ rows, state_name }) }),

    states:        () => apiCall('/api/hierarchy/states'),
    ranges:        (stateId)    => apiCall(`/api/hierarchy/ranges${stateId ? `?stateId=${stateId}` : ''}`),
    districts:     (params={})  => apiCall(`/api/hierarchy/districts?${new URLSearchParams(params)}`),
    units:         (params={})  => apiCall(`/api/hierarchy/units?${new URLSearchParams(params)}`),
    subUnits:      (params={})  => apiCall(`/api/hierarchy/sub-units?${new URLSearchParams(params)}`),
    unitCategories:()           => apiCall('/api/hierarchy/unit-categories'),
  },

  // ADMIN
  admin: {
    fieldTypes:   (stateId)    => apiCall(`/api/admin/field-types?stateId=${stateId}`),
    createField:  (data)       => apiCall('/api/admin/field-types', { method: 'POST', body: JSON.stringify(data) }),
    updateField:  (id, data)   => apiCall(`/api/admin/field-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteField:  (id)         => apiCall(`/api/admin/field-types/${id}`, { method: 'DELETE' }),

    dropdownValues: (params={}) => apiCall(`/api/admin/dropdown-values?${new URLSearchParams(params)}`),
    createValue:    (data)      => apiCall('/api/admin/dropdown-values', { method: 'POST', body: JSON.stringify(data) }),
    updateValue:    (id, data)  => apiCall(`/api/admin/dropdown-values/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteValue:    (id)        => apiCall(`/api/admin/dropdown-values/${id}`, { method: 'DELETE' }),

    users:          ()          => apiCall('/api/admin/users'),
    createUser:     (data)      => apiCall('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    toggleUser:     (id)        => apiCall(`/api/admin/users/${id}/toggle`, { method: 'PUT' }),
    resetPassword:  (id, pass)  => apiCall(`/api/admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ newPassword: pass }) }),

    dashboardStats: ()          => apiCall('/api/admin/dashboard-stats'),
  },

  // CHITTHAS
  chitthas: {
    list:   ()         => apiCall('/api/chitthas'),
    get:    (id)       => apiCall(`/api/chitthas/${id}`),
    create: (data)     => apiCall('/api/chitthas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiCall(`/api/chitthas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id)       => apiCall(`/api/chitthas/${id}`, { method: 'DELETE' }),
  },

  // LEAVES
  leaves: {
    list:    (params={})  => apiCall(`/api/leaves?${new URLSearchParams(params)}`),
    apply:   (data)       => apiCall('/api/leaves', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id, remarks)=> apiCall(`/api/leaves/${id}/approve`, { method: 'PUT', body: JSON.stringify({ remarks }) }),
    reject:  (id, remarks)=> apiCall(`/api/leaves/${id}/reject`, { method: 'PUT', body: JSON.stringify({ remarks }) }),
  },

  // TRANSFERS
  transfers: {
    list:   (params={}) => apiCall(`/api/leaves/transfers?${new URLSearchParams(params)}`),
    create: (data)      => apiCall('/api/leaves/transfers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data)  => apiCall(`/api/leaves/transfers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // GRIEVANCES
  grievances: {
    list:   (params={}) => apiCall(`/api/leaves/grievances?${new URLSearchParams(params)}`),

    // FormData use karo — files attach karne ke liye
    create: (data, files=[]) => {
      const token = localStorage.getItem('oasi_token');
      const form  = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v != null) form.append(k, v); });
      files.forEach(f => form.append('attachments', f));
      return fetch(`${API_BASE}/api/leaves/grievances`, {
        method: 'POST',
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        // Content-Type mat set karo — browser automatically multipart boundary set karega
        body: form,
      }).then(async r => {
        if (r.status === 401 || r.status === 403) { window.location.href = '/login'; return; }
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
        return r.json();
      });
    },

    update:  (id, data)  => apiCall(`/api/leaves/grievances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    forward: (id, notes) => apiCall(`/api/leaves/grievances/${id}/forward`, { method: 'PUT', body: JSON.stringify({ notes }) }),

    // Attachment URL banao (backend se serve hoga)
    attachmentUrl: (url) => `${API_BASE}${url}`,
  },

  // REPORTS
  reports: {
    firList: (params={}) => apiCall(`/api/reports/fir?${new URLSearchParams(params)}`),
    firCreate: (data)    => apiCall('/api/reports/fir', { method: 'POST', body: JSON.stringify(data) }),
  }
};
