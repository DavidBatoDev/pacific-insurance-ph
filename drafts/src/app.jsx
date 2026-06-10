// Pacific Insurance PH — App root
const { useState: useStateApp, useEffect: useEffectApp } = React;

const SCREEN_TITLES = {
  dashboard: "Dashboard", prospects: "Prospect Pipeline", clients: "Clients", applications: "Applications", policies: "Policies",
  renewals: "Renewals", claims: "Claims", travel: "Travel Insurance", documents: "Documents",
  tasks: "Tasks", relationship: "Relationship Management", reports: "Reports", settings: "Settings",
};

function App() {
  const [screen, setScreen] = useStateApp(() => localStorage.getItem("pi_screen") || "dashboard");
  const [dark, setDark] = useStateApp(() => localStorage.getItem("pi_dark") === "1");
  const [search, setSearch] = useStateApp("");

  useEffectApp(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("pi_dark", dark ? "1" : "0");
  }, [dark]);

  useEffectApp(() => {
    localStorage.setItem("pi_screen", screen);
    document.querySelector(".main")?.scrollTo(0, 0);
  }, [screen]);

  const { Screens, ExtraScreens } = window;
  const render = () => {
    switch (screen) {
      case "dashboard": return <Dashboard setScreen={setScreen} />;
      case "prospects": return <window.ProspectPipeline />;
      case "clients": return <Screens.ClientsScreen />;
      case "applications": return <Screens.ApplicationsScreen />;
      case "policies": return <ExtraScreens.PoliciesScreen />;
      case "renewals": return <Screens.RenewalsScreen />;
      case "claims": return <Screens.ClaimsScreen />;
      case "travel": return <Screens.TravelScreen />;
      case "documents": return <ExtraScreens.DocumentsScreen />;
      case "tasks": return <ExtraScreens.TasksScreen />;
      case "relationship": return <ExtraScreens.RelationshipScreen />;
      case "reports": return <ExtraScreens.ReportsScreen />;
      case "settings": return <ExtraScreens.SettingsScreen />;
      default: return <Dashboard setScreen={setScreen} />;
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
      <Topbar dark={dark} setDark={setDark} screen={screen} setScreen={setScreen} search={search} setSearch={setSearch} />
      <Sidebar screen={screen} setScreen={setScreen} />
      <main className="main">
        <div className="main-inner" key={screen}>
          {render()}
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
