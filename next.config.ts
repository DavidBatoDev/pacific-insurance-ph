import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SheetJS is CJS and guards optional `require("fs"/"stream")` calls that the
  // bundler can't statically resolve. Loading it externally on the server keeps
  // those from surfacing as critical-dependency warnings; it is only ever
  // imported from the dashboard export route, never from client code.
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
