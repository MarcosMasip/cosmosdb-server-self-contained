(function(){
  const apiBase = window.location.origin; // same-origin, /dbs etc.

  const el = id => document.getElementById(id);
  const json = r => r.json();

  function setResult(target, data) {
    target.textContent = JSON.stringify(data, null, 2);
  }

  function headers(base = {}) {
    return {
      ...base,
      "content-type": "application/json",
      // Some handlers expect these headers. Keep minimal for this UI.
      "x-ms-version": "2018-12-31"
    };
  }

  async function createDatabase() {
    const id = el('db-id').value.trim();
    if (!id) return;
    const res = await fetch(`${apiBase}/dbs`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ id })
    });
    if (!res.ok) {
      const body = await json(res).catch(()=>({}));
      alert(`Create DB failed: ${res.status} ${body.message||''}`);
      return;
    }
    await refreshDatabases();
  }

  async function createContainer() {
    const db = el('container-db-id').value.trim();
    const id = el('container-id').value.trim();
    const pk = el('partition-key').value.trim();
    if (!db || !id) return;
    const body = { id };
    if (pk) body.partitionKey = { paths: [pk] };
    const res = await fetch(`${apiBase}/dbs/${encodeURIComponent(db)}/colls`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const b = await json(res).catch(()=>({}));
      alert(`Create Container failed: ${res.status} ${b.message||''}`);
      return;
    }
    await refreshContainers();
  }

  async function createDocument() {
    const db = el('doc-db-id').value.trim();
    const coll = el('doc-container-id').value.trim();
    if (!db || !coll) return;
    let bodyText = el('doc-json').value.trim();
    let data;
    try { data = JSON.parse(bodyText); } catch(e) { alert('Invalid JSON'); return; }
    const res = await fetch(`${apiBase}/dbs/${encodeURIComponent(db)}/colls/${encodeURIComponent(coll)}/docs`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const b = await json(res).catch(()=>({}));
      alert(`Create Document failed: ${res.status} ${b.message||''}`);
      return;
    }
    await refreshDocuments();
  }

  async function refreshDatabases() {
    const res = await fetch(`${apiBase}/dbs`, { headers: headers() });
    const data = await json(res);
    const list = el('db-list');
    list.innerHTML = '';
    (data.Databases || []).forEach(db => {
      const li = document.createElement('li');
      li.textContent = db.id;
      const actions = document.createElement('span');
      actions.className = 'actions';
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.onclick = () => deleteDatabase(db.id);
      actions.appendChild(del);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  async function deleteDatabase(id) {
    if (!confirm(`Delete database ${id}?`)) return;
    const res = await fetch(`${apiBase}/dbs/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });
    if (!res.ok && res.status !== 404) {
      const b = await json(res).catch(()=>({}));
      alert(`Delete DB failed: ${res.status} ${b.message||''}`);
    }
    await refreshDatabases();
  }

  async function refreshContainers() {
    const db = el('list-containers-db').value.trim();
    if (!db) { el('container-list').innerHTML = ''; return; }
    const res = await fetch(`${apiBase}/dbs/${encodeURIComponent(db)}/colls`, { headers: headers() });
    const data = await json(res);
    const list = el('container-list');
    list.innerHTML = '';
    (data.DocumentCollections || []).forEach(c => {
      const li = document.createElement('li');
      li.textContent = c.id;
      list.appendChild(li);
    });
  }

  async function refreshDocuments() {
    const db = el('list-docs-db').value.trim();
    const coll = el('list-docs-container').value.trim();
    const list = el('doc-list');
    list.innerHTML = '';
    if (!db || !coll) return;
    const res = await fetch(`${apiBase}/dbs/${encodeURIComponent(db)}/colls/${encodeURIComponent(coll)}/docs`, { headers: headers() });
    const data = await json(res);
    (data.Documents || []).forEach(d => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.textContent = d.id;
      const right = document.createElement('span');
      right.className = 'actions';
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.onclick = () => deleteDocument(db, coll, d.id);
      right.appendChild(del);
      li.appendChild(left);
      li.appendChild(right);
      list.appendChild(li);
    });
  }

  async function deleteDocument(db, coll, id) {
    if (!confirm(`Delete document ${id}?`)) return;
    const res = await fetch(`${apiBase}/dbs/${encodeURIComponent(db)}/colls/${encodeURIComponent(coll)}/docs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers()
    });
    if (!res.ok && res.status !== 404) {
      const b = await json(res).catch(()=>({}));
      alert(`Delete document failed: ${res.status} ${b.message||''}`);
    }
    await refreshDocuments();
  }

  async function runQuery() {
    const db = el('q-db').value.trim();
    const coll = el('q-container').value.trim();
    const q = el('q-text').value.trim() || 'SELECT * FROM c';
    const cross = el('q-cross').checked;
    const res = await fetch(`${apiBase}/dbs/${encodeURIComponent(db)}/colls/${encodeURIComponent(coll)}/docs`, {
      method: 'POST',
      headers: headers({
        'x-ms-documentdb-isquery': 'True',
        'x-ms-documentdb-query-enablecrosspartition': cross ? 'True' : 'False'
      }),
      body: JSON.stringify({ query: q })
    });
    const data = await json(res).catch(()=>({}));
    setResult(el('q-result'), data);
  }

  // Wire up
  el('create-db').onclick = createDatabase;
  el('refresh-dbs').onclick = refreshDatabases;
  el('create-container').onclick = createContainer;
  el('refresh-containers').onclick = refreshContainers;
  el('create-doc').onclick = createDocument;
  el('refresh-docs').onclick = refreshDocuments;
  el('run-query').onclick = runQuery;

  // Initial
  refreshDatabases();
})();
