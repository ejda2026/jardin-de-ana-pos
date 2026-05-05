window.setSyncStatus = function(status) {
  var dot = document.getElementById('sync-dot'), lbl = document.getElementById('sync-label');
  if(!dot||!lbl) return;
  dot.className = 'sync-dot ' + status;
  lbl.textContent = status === 'on' ? 'En línea' : status === 'syncing' ? 'Sincronizando...' : 'Sin conexión';
};
window.V = function(v) {
  if(window._V) window._V(v);
};
