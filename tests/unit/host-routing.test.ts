import { describe, expect, it } from "vitest";
import { crossHostRedirect, isStudioPath, STUDIO_HOME } from "@/lib/host-routing";

const SITE = "https://bosesngbayan.com";
const ADMIN = "https://admin.bosesngbayan.com";
const route = (host: string, path: string, search = "") => crossHostRedirect(host, path, search, SITE, ADMIN);

describe("isStudioPath", () => {
  it("covers the Overview at /dashboard and everything under /admin", () => {
    expect(STUDIO_HOME).toBe("/dashboard");
    for (const path of ["/dashboard", "/dashboard/anything", "/admin", "/admin/articles", "/admin/login", "/admin/auth/callback"]) expect(isStudioPath(path)).toBe(true);
  });

  it("leaves public paths alone, including slugs that only start the same way", () => {
    for (const path of ["/", "/balita", "/administrasyon", "/dashboards", "/api/public/v1/articles"]) expect(isStudioPath(path)).toBe(false);
  });

  it("sees through percent-encoding, as the router does, and treats a malformed escape as Studio", () => {
    expect(isStudioPath("/%64ashboard")).toBe(true);
    expect(isStudioPath("/%61dmin/articles")).toBe(true);
    expect(isStudioPath("/balita/%C3%B1")).toBe(false);
    expect(isStudioPath("/%E0%A4%A")).toBe(true);
  });
});

describe("crossHostRedirect (public site and Studio on separate origins)", () => {
  it("keeps public pages on the public host", () => {
    expect(route("bosesngbayan.com", "/")).toBeNull();
    expect(route("bosesngbayan.com", "/balita/isang-kwento")).toBeNull();
  });

  it("keeps Studio pages on the admin host", () => {
    expect(route("admin.bosesngbayan.com", "/dashboard")).toBeNull();
    expect(route("admin.bosesngbayan.com", "/admin")).toBeNull(); // the proxy then sends /admin to /dashboard
    expect(route("admin.bosesngbayan.com", "/admin/articles")).toBeNull();
  });

  it("sends Studio paths on any other host to the admin origin, keeping path and query", () => {
    expect(route("bosesngbayan.com", "/dashboard", "?range=30d")).toBe("https://admin.bosesngbayan.com/dashboard?range=30d");
    expect(route("bosesngbayan.com", "/admin")).toBe("https://admin.bosesngbayan.com/admin");
    expect(route("bosesngbayan.com", "/admin/auth/callback", "?token_hash=abc&type=invite")).toBe(
      "https://admin.bosesngbayan.com/admin/auth/callback?token_hash=abc&type=invite",
    );
    expect(route("bosesngbayan.vercel.app", "/admin/login")).toBe("https://admin.bosesngbayan.com/admin/login");
  });

  it("opens Studio at the admin host root and sends other public paths back to the public origin", () => {
    expect(route("admin.bosesngbayan.com", "/")).toBe("https://admin.bosesngbayan.com/dashboard");
    expect(route("ADMIN.bosesngbayan.com", "/hanap", "?q=dyip")).toBe("https://bosesngbayan.com/hanap?q=dyip");
  });

  it("does not treat a public slug that starts with 'admin' as Studio", () => {
    expect(route("bosesngbayan.com", "/administrasyon")).toBeNull();
    expect(route("admin.bosesngbayan.com", "/administrasyon")).toBe("https://bosesngbayan.com/administrasyon");
  });

  it("does nothing on a single host: admin origin unset, equal to the site origin, or invalid", () => {
    expect(crossHostRedirect("localhost:3000", "/admin", "", "http://localhost:3000", undefined)).toBeNull();
    expect(crossHostRedirect("localhost:3000", "/dashboard", "", "http://localhost:3000", "http://localhost:3000")).toBeNull();
    expect(crossHostRedirect("bosesngbayan.com", "/admin", "", SITE, "not a url")).toBeNull();
  });
});
