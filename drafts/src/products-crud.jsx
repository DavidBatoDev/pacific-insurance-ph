// Pacific Insurance PH — Products Management (CRUD)
const { useState: useStatePM, useMemo: useMemoPM } = React;

const PM_TODAY = "Jul 6, 2026";

// Seed data
const SEED_CATEGORIES = [
  { id: "c1", name: "Health Insurance", desc: "Individual and family health coverage plans", status: "Active", created: "Jan 12, 2024", updated: "May 2, 2026", icon: "shield", color: "#059669" },
  { id: "c2", name: "Group HMO", desc: "Employer-sponsored group health maintenance plans", status: "Active", created: "Jan 12, 2024", updated: "Mar 18, 2026", icon: "building", color: "#2563eb" },
  { id: "c3", name: "Travel Insurance", desc: "Short-term coverage for domestic and international travel", status: "Active", created: "Feb 4, 2024", updated: "Jun 1, 2026", icon: "plane", color: "#d97706" },
];

const SEED_PRODUCTS = [
  { id: "p1", name: "Select Plan", cat: "c1", desc: "Entry-tier individual health plan with essential inpatient coverage", type: "Individual Health", status: "Active", renewal: true, claims: true, commission: true, notes: "Most popular entry product for new clients.", linked: 412, created: "Jan 12, 2024", updated: "May 2, 2026" },
  { id: "p2", name: "Blue Royale", cat: "c1", desc: "Premium comprehensive health plan with full hospitalization and dental", type: "Individual Health", status: "Active", renewal: true, claims: true, commission: true, notes: "Highest commission tier. Requires medical questionnaire.", linked: 386, created: "Jan 12, 2024", updated: "Jun 3, 2026" },
  { id: "p3", name: "BC Flexi HMO", cat: "c2", desc: "Flexible group HMO for SMEs with modular add-on benefits", type: "Group Health", status: "Active", renewal: true, claims: true, commission: true, notes: "Minimum 10 members. Corporate billing.", linked: 148, created: "Jan 12, 2024", updated: "Mar 18, 2026" },
  { id: "p4", name: "Travel Insurance", cat: "c3", desc: "Per-trip coverage including medical, baggage, and flight delay", type: "Travel", status: "Active", renewal: false, claims: true, commission: true, notes: "Issued per trip. No auto-renewal.", linked: 231, created: "Feb 4, 2024", updated: "Jun 1, 2026" },
  { id: "p5", name: "FlexiShield Legacy", cat: "c1", desc: "Discontinued legacy individual plan — retained for existing policyholders", type: "Individual Health", status: "Inactive", renewal: true, claims: true, commission: false, notes: "Closed to new business Jan 2026. 34 active legacy policies remain.", linked: 34, created: "Jun 8, 2023", updated: "Jan 5, 2026" },
];

const PRODUCT_TYPES = ["Individual Health", "Group Health", "Family Health", "Travel", "Life", "Accident", "Other"];
const CAT_ICONS = ["shield", "building", "plane", "heart", "users", "wallet", "star", "award"];
const CAT_COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#0d9488", "#dc2626"];

// Portal so overlays escape the scrolled main region and cover the whole viewport
function Portal({ children }) {
  return ReactDOM.createPortal(children, document.body);
}

function StatusChip({ status }) {
  return status === "Active"
    ? <span className="badge green"><span className="b-dot"></span>Active</span>
    : <span className="badge slate"><span className="b-dot"></span>Inactive</span>;
}

function YesNo({ v }) {
  return v
    ? <span className="yn yes"><I.check size={13} /> Yes</span>
    : <span className="yn no">— No</span>;
}

/* ============ Confirm modal ============ */
function ConfirmModal({ kind, title, message, confirmLabel, onConfirm, onClose }) {
  return (
    <Portal>
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-body">
          <div className={"modal-ico " + (kind === "danger" ? "danger" : "warn")}>
            {kind === "danger" ? <I.alertTri size={24} /> : <I.alertTri size={24} />}
          </div>
          <h3>{title}</h3>
          <p dangerouslySetInnerHTML={{ __html: message }} />
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className={"btn " + (kind === "danger" ? "danger" : "primary")} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

/* ============ Category drawer ============ */
function CategoryDrawer({ initial, onSave, onClose }) {
  const editing = !!initial;
  const [f, setF] = useStatePM(initial || { name: "", desc: "", status: "Active", icon: "shield", color: "#059669" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const IcoPreview = I[f.icon];
  return (
    <Portal>
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico" style={{ background: f.color + "22", color: f.color }}><IcoPreview size={20} /></div>
          <div>
            <h2>{editing ? "Edit category" : "New product category"}</h2>
            <div className="dh-sub">{editing ? "Update this product category" : "Group related insurance products"}</div>
          </div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <div className="drawer-body">
          <div className="field">
            <label>Category name <span className="req">*</span></label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Health Insurance" autoFocus />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="textarea" value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Short description of what this category covers" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Icon</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CAT_ICONS.map((ic) => { const Ic = I[ic]; return (
                  <button key={ic} onClick={() => set("icon", ic)} style={{ width: 34, height: 34, borderRadius: 8, display: "grid", placeItems: "center", border: "1px solid " + (f.icon === ic ? f.color : "var(--border-strong)"), background: f.icon === ic ? f.color + "18" : "var(--surface)", color: f.icon === ic ? f.color : "var(--text-subtle)" }}><Ic size={17} /></button>
                ); })}
              </div>
            </div>
            <div className="field">
              <label>Color</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CAT_COLORS.map((c) => (
                  <button key={c} onClick={() => set("color", c)} style={{ width: 30, height: 30, borderRadius: 8, background: c, border: "2px solid " + (f.color === c ? "var(--text)" : "transparent"), boxShadow: "var(--shadow-xs)" }}></button>
                ))}
              </div>
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <div className="seg-status">
              <button className={f.status === "Active" ? "on-active" : ""} onClick={() => set("status", "Active")}><span className="b-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }}></span>Active</button>
              <button className={f.status === "Inactive" ? "on-inactive" : ""} onClick={() => set("status", "Inactive")}>Inactive</button>
            </div>
            <div className="hint">Inactive categories and their products are hidden from new records but stay visible in historical data.</div>
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!f.name.trim()} style={!f.name.trim() ? { opacity: 0.5, cursor: "not-allowed" } : null} onClick={() => onSave(f)}>{editing ? "Save changes" : "Create category"}</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

/* ============ Product drawer ============ */
function ProductDrawer({ initial, categories, defaultCat, onSave, onClose }) {
  const editing = !!initial;
  const [f, setF] = useStatePM(initial || { name: "", cat: defaultCat || categories[0]?.id, desc: "", type: "Individual Health", status: "Active", renewal: true, claims: true, commission: true, notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Portal>
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.fileText size={20} /></div>
          <div>
            <h2>{editing ? "Edit product" : "New product"}</h2>
            <div className="dh-sub">{editing ? "Update product configuration" : "Add a product to the master catalog"}</div>
          </div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <div className="drawer-body">
          <div className="field">
            <label>Product name <span className="req">*</span></label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Blue Royale" autoFocus />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Category <span className="req">*</span></label>
              <select className="select" value={f.cat} onChange={(e) => set("cat", e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Product type</label>
              <select className="select" value={f.type} onChange={(e) => set("type", e.target.value)}>
                {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Short description</label>
            <textarea className="textarea" value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="One-line summary shown across the platform" />
          </div>
          <div className="field">
            <label>Status</label>
            <div className="seg-status">
              <button className={f.status === "Active" ? "on-active" : ""} onClick={() => set("status", "Active")}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }}></span>Active</button>
              <button className={f.status === "Inactive" ? "on-inactive" : ""} onClick={() => set("status", "Inactive")}>Inactive</button>
            </div>
          </div>
          <div className="field" style={{ marginTop: 20 }}>
            <label style={{ marginBottom: 2 }}>Configuration rules</label>
            <div className="switch-row">
              <div><div className="sr-label">Default renewal required</div><div className="sr-sub">Auto-creates renewal records before expiry</div></div>
              <button className={"switch" + (f.renewal ? " on" : "")} onClick={() => set("renewal", !f.renewal)}></button>
            </div>
            <div className="switch-row">
              <div><div className="sr-label">Claims applicable</div><div className="sr-sub">Enables claims filing for this product</div></div>
              <button className={"switch" + (f.claims ? " on" : "")} onClick={() => set("claims", !f.claims)}></button>
            </div>
            <div className="switch-row">
              <div><div className="sr-label">Commission applicable</div><div className="sr-sub">Included in agent commission calculations</div></div>
              <button className={"switch" + (f.commission ? " on" : "")} onClick={() => set("commission", !f.commission)}></button>
            </div>
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label>Notes</label>
            <textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes for staff (underwriting rules, eligibility, etc.)" />
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!f.name.trim()} style={!f.name.trim() ? { opacity: 0.5, cursor: "not-allowed" } : null} onClick={() => onSave(f)}>{editing ? "Save changes" : "Create product"}</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

window.ProductsCRUD = { SEED_CATEGORIES, SEED_PRODUCTS, StatusChip, YesNo, ConfirmModal, CategoryDrawer, ProductDrawer, PM_TODAY };
