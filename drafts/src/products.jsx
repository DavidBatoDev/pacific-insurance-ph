// Pacific Insurance PH — Products Management screen
const { useState: useStateProd, useMemo: useMemoProd } = React;

function ProductsScreen() {
  const C = window.ProductsCRUD;
  const [categories, setCategories] = useStateProd(C.SEED_CATEGORIES);
  const [products, setProducts] = useStateProd(C.SEED_PRODUCTS);
  const [collapsed, setCollapsed] = useStateProd({});

  const [q, setQ] = useStateProd("");
  const [filterCat, setFilterCat] = useStateProd("all");
  const [filterStatus, setFilterStatus] = useStateProd("all");
  const [sortBy, setSortBy] = useStateProd("name");
  const [view, setView] = useStateProd("table");

  // Drawers + modals
  const [catDrawer, setCatDrawer] = useStateProd(null);   // {} new | {..} edit
  const [prodDrawer, setProdDrawer] = useStateProd(null);
  const [confirm, setConfirm] = useStateProd(null);

  const catById = useMemoProd(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  // Filtering
  const filtered = useMemoProd(() => {
    let list = products;
    if (filterCat !== "all") list = list.filter((p) => p.cat === filterCat);
    if (filterStatus !== "all") list = list.filter((p) => p.status === filterStatus);
    if (q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(ql) || p.desc.toLowerCase().includes(ql) || p.type.toLowerCase().includes(ql));
    }
    const sorted = [...list].sort((a, b) => {
      if (sortBy === "status") return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
      if (sortBy === "category") return (catById[a.cat]?.name || "").localeCompare(catById[b.cat]?.name || "") || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [products, filterCat, filterStatus, q, sortBy, catById]);

  const activeCount = products.filter((p) => p.status === "Active").length;
  const inactiveCount = products.length - activeCount;

  // CRUD handlers
  const saveCat = (data) => {
    if (data.id) setCategories((cs) => cs.map((c) => c.id === data.id ? { ...c, ...data, updated: C.PM_TODAY } : c));
    else setCategories((cs) => [...cs, { ...data, id: "c" + Date.now(), created: C.PM_TODAY, updated: C.PM_TODAY }]);
    setCatDrawer(null);
  };
  const saveProd = (data) => {
    if (data.id) setProducts((ps) => ps.map((p) => p.id === data.id ? { ...p, ...data, updated: C.PM_TODAY } : p));
    else setProducts((ps) => [...ps, { ...data, id: "p" + Date.now(), linked: 0, created: C.PM_TODAY, updated: C.PM_TODAY }]);
    setProdDrawer(null);
  };
  const toggleProdStatus = (p) => setProducts((ps) => ps.map((x) => x.id === p.id ? { ...x, status: x.status === "Active" ? "Inactive" : "Active", updated: C.PM_TODAY } : x));
  const toggleCatStatus = (c) => setCategories((cs) => cs.map((x) => x.id === c.id ? { ...x, status: x.status === "Active" ? "Inactive" : "Active", updated: C.PM_TODAY } : x));
  const deleteProd = (p) => setProducts((ps) => ps.filter((x) => x.id !== p.id));

  // Confirm flows
  const askDeactivateProd = (p) => setConfirm({
    kind: p.linked > 0 ? "warn" : "danger",
    title: p.status === "Active" ? `Deactivate "${p.name}"?` : `Reactivate "${p.name}"?`,
    message: p.status === "Active"
      ? (p.linked > 0
        ? `This product is linked to <b>${p.linked} active records</b> (policies, claims, payments). It will be hidden from new records but stay visible in historical data.`
        : "This product will no longer appear as a selectable option in new records.")
      : "This product will become selectable again across all modules.",
    confirmLabel: p.status === "Active" ? "Deactivate" : "Reactivate",
    onConfirm: () => { toggleProdStatus(p); setConfirm(null); },
  });
  const askDeleteProd = (p) => {
    if (p.linked > 0) {
      setConfirm({
        kind: "warn",
        title: "Cannot delete — product in use",
        message: `<b>${p.name}</b> is linked to <b>${p.linked} records</b>. To preserve historical data, deactivate it instead of deleting.`,
        confirmLabel: "Deactivate instead",
        onConfirm: () => { setProducts((ps) => ps.map((x) => x.id === p.id ? { ...x, status: "Inactive", updated: C.PM_TODAY } : x)); setConfirm(null); },
      });
    } else {
      setConfirm({
        kind: "danger",
        title: `Delete "${p.name}"?`,
        message: "This product has no linked records and will be permanently removed. This cannot be undone.",
        confirmLabel: "Delete permanently",
        onConfirm: () => { deleteProd(p); setConfirm(null); },
      });
    }
  };
  const askDeactivateCat = (c) => {
    const linkedProds = products.filter((p) => p.cat === c.id).length;
    setConfirm({
      kind: "warn",
      title: c.status === "Active" ? `Deactivate "${c.name}"?` : `Reactivate "${c.name}"?`,
      message: c.status === "Active"
        ? `This category contains <b>${linkedProds} product${linkedProds !== 1 ? "s" : ""}</b>. Deactivating hides the category and its products from new records. Historical records are preserved.`
        : "This category and its products will become available again.",
      confirmLabel: c.status === "Active" ? "Deactivate" : "Reactivate",
      onConfirm: () => { toggleCatStatus(c); setConfirm(null); },
    });
  };

  const groupedView = filterCat === "all" && filterStatus === "all" && !q.trim();
  const canEdit = window.Perms.can("products", "edit");
  const canDelete = window.Perms.can("products", "delete");
  const P = window.Perms.person();

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><I.folder size={19} /></span>
            Products
            <span className="module-tag"><I.settings size={12} /> System configuration</span>
          </h1>
          <p className="sub">Master catalog of insurance products used across leads, policies, claims, payments &amp; reports.</p>
        </div>
        <div className="page-head-actions">
          {canEdit && <button className="btn" onClick={() => setCatDrawer({})}><I.plus size={15} /> New category</button>}
          {canEdit && <button className="btn primary" onClick={() => setProdDrawer({})}><I.plus size={15} /> New product</button>}
        </div>
      </div>

      <div className="perm-note">
        <I.shield size={16} style={{ color: canEdit ? "var(--blue)" : "var(--amber)", flex: "0 0 auto" }} />
        {canEdit
          ? <span>You're signed in as <b>{P.name} · Admin</b> with full edit access. Staff and agents can view products but cannot edit them.</span>
          : <span>You're viewing as <b>{P.name} · {P.roleLabel}</b> — <b>view-only</b> access. Product create, edit and delete are reserved for Admins.</span>}
      </div>

      {/* Stat strip */}
      <div className="stat-strip">
        <div className="stat-mini"><div className="sm-val tnum">{categories.length}</div><div className="sm-label">Categories</div></div>
        <div className="stat-mini"><div className="sm-val tnum">{products.length}</div><div className="sm-label">Total products</div></div>
        <div className="stat-mini"><div className="sm-val tnum" style={{ color: "var(--accent)" }}>{activeCount}</div><div className="sm-label">Active</div></div>
        <div className="stat-mini"><div className="sm-val tnum" style={{ color: "var(--text-subtle)" }}>{inactiveCount}</div><div className="sm-label">Inactive</div></div>
      </div>

      {/* Toolbar */}
      <div className="prod-toolbar">
        <div className="filter-search">
          <I.search size={16} />
          <input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto", minWidth: 160 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" style={{ width: "auto", minWidth: 130 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="Active">Active only</option>
          <option value="Inactive">Inactive only</option>
        </select>
        <select className="select" style={{ width: "auto", minWidth: 150 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="category">Sort: Category</option>
          <option value="status">Sort: Status</option>
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-subtle)", fontWeight: 600 }}>{filtered.length} product{filtered.length !== 1 ? "s" : ""}</span>
          <div className="view-toggle">
            <button className={view === "table" ? "on" : ""} onClick={() => setView("table")} title="Table view"><I.grid size={15} /></button>
            <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")} title="Card view"><I.folder size={15} /></button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-screen">
            <div className="es-ico"><I.folder size={26} /></div>
            <h2>No products found</h2>
            <p>{q || filterCat !== "all" || filterStatus !== "all" ? "Try adjusting your search or filters." : "Get started by adding your first product to the catalog."}</p>
            <div style={{ marginTop: 16 }}>{canEdit && <button className="btn primary" onClick={() => setProdDrawer({})}><I.plus size={15} /> New product</button>}</div>
          </div>
        </div>
      ) : groupedView ? (
        // Grouped by category
        categories.map((cat) => {
          const prods = filtered.filter((p) => p.cat === cat.id);
          const isCollapsed = collapsed[cat.id];
          const activeP = prods.filter((p) => p.status === "Active").length;
          const CatIco = I[cat.icon];
          return (
            <div className={"cat-group" + (isCollapsed ? " collapsed" : "") + (cat.status === "Inactive" ? " inactive" : "")} key={cat.id}>
              <div className="cat-group-head">
                <div className="cat-ico" style={{ background: cat.color + "1e", color: cat.color }}><CatIco size={20} /></div>
                <div className="cat-title-wrap">
                  <div className="cat-title">{cat.name} <C.StatusChip status={cat.status} /></div>
                  <div className="cat-desc">{cat.desc}</div>
                </div>
                <div className="cat-meta">
                  <span><b>{prods.length}</b> product{prods.length !== 1 ? "s" : ""}</span>
                  <span><b>{activeP}</b> active</span>
                  <span className="cell-muted" style={{ fontSize: 11 }}>Updated {cat.updated}</span>
                </div>
                <div className="cat-actions">
                  {canEdit && <button className="row-btn" title="Add product to category" onClick={() => setProdDrawer({ __cat: cat.id })}><I.plus size={16} /></button>}
                  {canEdit && <button className="row-btn" title="Edit category" onClick={() => setCatDrawer(cat)}><I.doc2 size={16} /></button>}
                  {canEdit && <button className="row-btn" title={cat.status === "Active" ? "Deactivate" : "Reactivate"} onClick={() => askDeactivateCat(cat)}><I.refresh size={16} /></button>}
                  <button className="cat-collapse" onClick={() => setCollapsed((s) => ({ ...s, [cat.id]: !s[cat.id] }))}><I.chevDown size={17} /></button>
                </div>
              </div>
              {!isCollapsed && (
                prods.length === 0 ? (
                  <div className="cat-products"><div style={{ padding: "22px", textAlign: "center", color: "var(--text-subtle)", fontSize: 13 }}>No products in this category yet. <button className="card-link" style={{ display: "inline" }} onClick={() => setProdDrawer({ __cat: cat.id })}>Add one</button></div></div>
                ) : (
                  <div className="cat-products">
                    <ProductTable prods={prods} catById={catById} showCat={false} canEdit={canEdit} canDelete={canDelete} onEdit={setProdDrawer} onDeactivate={askDeactivateProd} onDelete={askDeleteProd} />
                  </div>
                )
              )}
            </div>
          );
        })
      ) : view === "table" ? (
        <div className="card">
          <ProductTable prods={filtered} catById={catById} showCat canEdit={canEdit} canDelete={canDelete} onEdit={setProdDrawer} onDeactivate={askDeactivateProd} onDelete={askDeleteProd} />
        </div>
      ) : (
        <div className="card">
          <div className="prod-cards">
            {filtered.map((p) => {
              const cat = catById[p.cat];
              return (
                <div key={p.id} className={"prod-cardv" + (p.status === "Inactive" ? " inactive" : "")} onClick={() => canEdit && setProdDrawer(p)} style={canEdit ? null : { cursor: "default" }}>
                  <div className="prod-cardv-top">
                    <div>
                      <div className="prod-cardv-name">{p.name}</div>
                      <div style={{ fontSize: 11.5, color: cat?.color, fontWeight: 600, marginTop: 2 }}>{cat?.name}</div>
                    </div>
                    <C.StatusChip status={p.status} />
                  </div>
                  <div className="prod-cardv-desc">{p.desc}</div>
                  <div className="prod-cardv-tags">
                    <span className="type-tag">{p.type}</span>
                    {p.renewal && <span className="type-tag">Renewable</span>}
                    {p.commission && <span className="type-tag">Commission</span>}
                  </div>
                  <div className="prod-cardv-foot">
                    <span style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>{p.linked} linked record{p.linked !== 1 ? "s" : ""}</span>
                    {canEdit && <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="row-btn" title="Edit" onClick={() => setProdDrawer(p)}><I.doc2 size={15} /></button>
                      <button className="row-btn" title={p.status === "Active" ? "Deactivate" : "Reactivate"} onClick={() => askDeactivateProd(p)}><I.refresh size={15} /></button>
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawers + modals */}
      {catDrawer && <C.CategoryDrawer initial={catDrawer.id ? catDrawer : null} onSave={saveCat} onClose={() => setCatDrawer(null)} />}
      {prodDrawer && <C.ProductDrawer initial={prodDrawer.id ? prodDrawer : null} defaultCat={prodDrawer.__cat} categories={categories} onSave={saveProd} onClose={() => setProdDrawer(null)} />}
      {confirm && <C.ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/* Reusable product table */
function ProductTable({ prods, catById, showCat, canEdit, canDelete, onEdit, onDeactivate, onDelete }) {
  const C = window.ProductsCRUD;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>
          <th>Product</th>
          {showCat && <th>Category</th>}
          <th>Type</th>
          <th>Renewal</th>
          <th>Claims</th>
          <th>Commission</th>
          <th>Status</th>
          <th className="num">Linked</th>
          {canEdit && <th style={{ textAlign: "right" }}>Actions</th>}
        </tr></thead>
        <tbody>
          {prods.map((p) => {
            const cat = catById[p.cat];
            return (
              <tr key={p.id} onClick={() => canEdit && onEdit(p)} style={{ ...(p.status === "Inactive" ? { opacity: 0.62 } : null), ...(canEdit ? null : { cursor: "default" }) }}>
                <td>
                  <div className="cell-strong">{p.name}</div>
                  <div className="cc-sub" style={{ fontSize: 11.5, color: "var(--text-subtle)", maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>
                </td>
                {showCat && <td><span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 550 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: cat?.color }}></span>{cat?.name}</span></td>}
                <td><span className="type-tag">{p.type}</span></td>
                <td><C.YesNo v={p.renewal} /></td>
                <td><C.YesNo v={p.claims} /></td>
                <td><C.YesNo v={p.commission} /></td>
                <td><C.StatusChip status={p.status} /></td>
                <td className="num mono" style={{ fontWeight: 600 }}>{p.linked}</td>
                {canEdit && <td onClick={(e) => e.stopPropagation()}>
                  <div className="row-actions">
                    <button className="row-btn" title="Edit" onClick={() => onEdit(p)}><I.doc2 size={16} /></button>
                    <button className="row-btn" title={p.status === "Active" ? "Deactivate" : "Reactivate"} onClick={() => onDeactivate(p)}><I.refresh size={16} /></button>
                    {canDelete && <button className="row-btn danger" title="Delete" onClick={() => onDelete(p)}><I.fileMissing size={16} /></button>}
                  </div>
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

window.ProductsScreen = ProductsScreen;
