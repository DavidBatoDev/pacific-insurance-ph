// Pacific Insurance PH — App root
const { useState: useStateApp, useEffect: useEffectApp } = React;

const SCREEN_TITLES = {
  dashboard: "Dashboard", prospects: "Lead Lifecycle", clients: "Clients", applications: "Applications", policies: "Policies",
  renewals: "Renewals", claims: "Claims", travel: "Travel Insurance", documents: "Documents",
  tasks: "Tasks", relationship: "Relationship Management", reports: "Reports", products: "Products", templates: "Email Templates", settings: "Settings",
  contact: "Contact Profile", group: "Group Account",
};

function App() {
  const [screen, setScreen] = useStateApp(() => localStorage.getItem("pi_screen") || "dashboard");
  const [dark, setDark] = useStateApp(() => localStorage.getItem("pi_dark") === "1");
  const [persona, setPersona] = useStateApp(() => localStorage.getItem("pi_persona") || "eman");
  const [search, setSearch] = useStateApp("");
  const [wizOpen, setWizOpen] = useStateApp(false);
  const [wizPrefill, setWizPrefill] = useStateApp(null);
  const [contactSeed, setContactSeed] = useStateApp(null);
  const [groupSeed, setGroupSeed] = useStateApp(null);
  const [engage, setEngage] = useStateApp(null);
  const [pageModal, setPageModal] = useStateApp(null);
  const [toast, setToast] = useStateApp(null);

  useEffectApp(() => {
    const open = (e) => { setWizPrefill(e.detail && e.detail.prefill ? e.detail.prefill : null); setWizOpen(true); };
    window.addEventListener("open-new-application", open);
    const openPage = (e) => setPageModal(e.detail.modal);
    window.addEventListener("open-page-modal", openPage);
    const openContact = (e) => { setContactSeed(e.detail && e.detail.contact ? e.detail.contact : null); setScreen("contact"); };
    window.addEventListener("open-contact", openContact);
    const openGroup = (e) => { setGroupSeed(e.detail && e.detail.group ? e.detail.group : null); setScreen("group"); };
    window.addEventListener("open-group", openGroup);
    const openEngage = (e) => setEngage(e.detail || null);
    window.addEventListener("open-engage", openEngage);
    const onToast = (e) => setToast(e.detail);
    window.addEventListener("app-toast", onToast);
    const onGo = (e) => { if (e.detail && e.detail.screen) setScreen(e.detail.screen); };
    window.addEventListener("go-screen", onGo);
    return () => { window.removeEventListener("open-new-application", open); window.removeEventListener("open-page-modal", openPage); window.removeEventListener("open-contact", openContact); window.removeEventListener("open-group", openGroup); window.removeEventListener("open-engage", openEngage); window.removeEventListener("app-toast", onToast); window.removeEventListener("go-screen", onGo); };
  }, []);

  const handleCreated = ({ form, mode }) => {
    setWizOpen(false);
    setWizPrefill(null);
    // Phase 2: a convert-from-lead wizard was actually saved — commit the lead → Applicant (remove board card,
    // flip the profile, count the conversion). Fires for every save mode (draft or create).
    const convertRid = form._convert && form._convert.record_id;
    if (convertRid) { window.PPData.leadConvertCommit(convertRid); window.dispatchEvent(new CustomEvent("lead-convert-commit", { detail: { rid: convertRid } })); }
    const name = form.displayName || form.companyName || "New lead";
    // Group HMO application → materialize a Group Account and open its detail page (unless it's just a draft).
    if (form.category === "hmo" && mode !== "draft" && window.GroupsData) {
      const g = window.GroupsData.addGroup(form);
      setToast({ title: "Group account created", sub: `${g.name} — ${g.plan} · ${window.GroupsData.membersOf(g.id).length} members · status ${g.status}.` });
      setGroupSeed(g);
      setScreen("group");
      return;
    }
    const modeMap = {
      draft: { title: "Draft saved", sub: `${name} saved as a ${form.initialStatus} — no messages sent.` },
      create: { title: "Application created", sub: `${name} — ${form.product || "application"} · status ${form.status}.` },
      email: { title: "Application created & email sent", sub: `${name} — "${form.emailTemplate || "initial email"}" sent.` },
      docs: { title: "Application created & documents requested", sub: `${name} — checklist of ${form.checklist.length} items requested.` },
    };
    setToast(modeMap[mode] || modeMap.create);
  };

  useEffectApp(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("pi_dark", dark ? "1" : "0");
  }, [dark]);

  useEffectApp(() => { localStorage.setItem("pi_persona", persona); }, [persona]);

  useEffectApp(() => {
    localStorage.setItem("pi_screen", screen);
    document.querySelector(".main")?.scrollTo(0, 0);
  }, [screen]);

  // Keep the permissions singleton in sync BEFORE children render this pass.
  window.Perms.current = persona;

  const { Screens, ExtraScreens } = window;
  const render = () => {
    switch (screen) {
      case "dashboard": return <Dashboard setScreen={setScreen} persona={persona} />;
      case "prospects": return <window.ProspectPipeline />;
      case "clients": return <Screens.ClientsScreen />;
      case "contact": return <window.ContactProfile key={(contactSeed && (contactSeed.email || contactSeed.name)) || "default"} seed={contactSeed} onBack={() => setScreen("clients")} />;
      case "group": return <window.GroupAccount key={(groupSeed && groupSeed.id) || "default"} seed={groupSeed} onBack={() => setScreen("clients")} />;
      case "applications": return <Screens.ApplicationsScreen />;
      case "policies": return <ExtraScreens.PoliciesScreen />;
      case "renewals": return <Screens.RenewalsScreen />;
      case "claims": return <Screens.ClaimsScreen />;
      case "travel": return <Screens.TravelScreen />;
      case "payments": return <window.PaymentsScreen />;
      case "documents": return <ExtraScreens.DocumentsScreen />;
      case "tasks": return <ExtraScreens.TasksScreen />;
      case "relationship": return <ExtraScreens.RelationshipScreen />;
      case "reports": return <window.ReportsScreen />;
      case "products": return <window.ProductsScreen />;
      case "templates": return <window.TemplatesScreen />;
      case "settings": return <window.SettingsScreen />;
      default: return <Dashboard setScreen={setScreen} persona={persona} />;
    }
  };

  return (
    <div className="app" data-screen-label={SCREEN_TITLES[screen]}>
      <div className="brand-corner">
        <div className="brand-glyph"><BrandGlyph size={19} /></div>
        <div className="brand-name">
          <b>Pacific</b>
          <span>Insurance PH</span>
        </div>
      </div>
      <Topbar dark={dark} setDark={setDark} screen={screen} setScreen={setScreen} search={search} setSearch={setSearch} persona={persona} setPersona={setPersona} />
      <Sidebar screen={screen} setScreen={setScreen} />
      <main className="main">
        <div className="main-inner" key={screen}>
          {render()}
        </div>
      </main>
      {wizOpen && <window.NewApplicationWizard initialForm={wizPrefill} onClose={() => { const rid = wizPrefill && wizPrefill._convert && wizPrefill._convert.record_id; if (rid) { window.PPData.leadConvertAbandon(rid); window.dispatchEvent(new CustomEvent("lead-convert-abandon", { detail: { rid } })); } setWizOpen(false); setWizPrefill(null); }} onCreated={handleCreated} />}
      <window.PageModals modal={pageModal} onClose={() => setPageModal(null)} />
      {engage && <window.EngageModal action={engage.action} contact={engage.contact} logTo={engage.logTo} onSent={engage.onSent} onClose={() => setEngage(null)} />}
      <window.NAToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
