import { describe, expect, it } from "vitest";
import { isAllowedInstitutionalEmail } from "../src/modules/autenticacion/autenticacion.service";
import { createTestContext } from "./helpers/context";

const allowed = ["udg.mx", "alumnos.udg.mx"];

describe("validación de dominios institucionales", () => {
  it.each(["ana@udg.mx", "ana.perez@alumnos.udg.mx", "ANA@ALUMNOS.UDG.MX", "  ana@udg.mx  "])(
    "acepta %s",
    (email) => {
      expect(isAllowedInstitutionalEmail(email, allowed)).toBe(true);
    },
  );

  it.each([
    "ana@gmail.com",
    "ana@academicos.udg.mx",
    "ana@evil.udg.mx",
    "ana@alumnos.udg.mx.evil.com",
    "ana@notudg.mx",
    "ana@udg.mx@gmail.com",
    "gmail.com@udg.mx.com",
    "@udg.mx",
    "ana@",
    "ana udg.mx",
    "ana @udg.mx",
    "",
  ])("rechaza %j", (email) => {
    expect(isAllowedInstitutionalEmail(email, allowed)).toBe(false);
  });

  it.each([null, undefined])("rechaza %s", (email) => {
    expect(isAllowedInstitutionalEmail(email, allowed)).toBe(false);
  });

  it("respeta la lista configurada", () => {
    expect(isAllowedInstitutionalEmail("ana@cucei.mx", ["cucei.mx"])).toBe(true);
    expect(isAllowedInstitutionalEmail("ana@udg.mx", ["cucei.mx"])).toBe(false);
  });
});

describe("creación de perfiles", () => {
  const session = (email: string, emailConfirmed = true) => ({
    id: "c3a1f0a4-5b1e-4f3a-9a44-3d1f8f1f7a10",
    email,
    emailConfirmed,
  });
  const input = { displayName: "Ana", campusId: null };

  it("crea el perfil con correo institucional", async () => {
    const { services, db } = createTestContext();
    const profile = await services.autenticacion.createProfile(session("ana@udg.mx"), input);

    expect(profile).toMatchObject({ displayName: "Ana", role: "user", status: "active" });
    expect(db.profiles.has(profile.id)).toBe(true);
  });

  it("rechaza dominios externos sin crear nada", async () => {
    const { services, db } = createTestContext();

    await expect(
      services.autenticacion.createProfile(session("ana@gmail.com"), input),
    ).rejects.toMatchObject({ status: 403, code: "DOMINIO_NO_PERMITIDO" });
    expect(db.profiles.size).toBe(0);
  });

  it("exige correo confirmado", async () => {
    const { services } = createTestContext();

    await expect(
      services.autenticacion.createProfile(session("ana@udg.mx", false), input),
    ).rejects.toMatchObject({ status: 403, code: "CORREO_NO_CONFIRMADO" });
  });

  it("no permite un segundo perfil", async () => {
    const { services } = createTestContext();
    await services.autenticacion.createProfile(session("ana@udg.mx"), input);

    await expect(
      services.autenticacion.createProfile(session("ana@udg.mx"), input),
    ).rejects.toMatchObject({ status: 409, code: "PERFIL_EXISTENTE" });
  });
});

describe("resolución de la identidad", () => {
  it("rechaza un token inválido", async () => {
    const { services } = createTestContext();
    await expect(services.autenticacion.authenticate("falso")).rejects.toMatchObject({ status: 401 });
  });

  it("devuelve el actor de un perfil activo", async () => {
    const { services, addUser, db } = createTestContext();
    const ana = addUser("ana");

    await expect(
      services.autenticacion.resolveActor(db.sessions.get(ana.token)!),
    ).resolves.toEqual({ id: ana.id, role: "user" });
  });

  it.each([
    ["sin perfil", { profile: false }, "PERFIL_REQUERIDO"],
    ["suspendido", { status: "suspended" as const }, "CUENTA_SUSPENDIDA"],
    ["correo sin confirmar", { confirmed: false }, "CORREO_NO_CONFIRMADO"],
    ["dominio externo con perfil", { email: "ana@gmail.com" }, "DOMINIO_NO_PERMITIDO"],
  ])("bloquea: %s", async (_name, options, code) => {
    const { services, addUser, db } = createTestContext();
    const ana = addUser("ana", options);

    await expect(
      services.autenticacion.resolveActor(db.sessions.get(ana.token)!),
    ).rejects.toMatchObject({ status: 403, code });
  });
});
