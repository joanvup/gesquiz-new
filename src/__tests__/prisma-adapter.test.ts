import { describe, expect, it } from "vitest";
import { parseDatabaseUrl } from "../lib/prisma-adapter";

describe("parseDatabaseUrl", () => {
  it("decodea la contraseña y separa los datos de conexión", () => {
    const parts = parseDatabaseUrl(
      "mysql://gesquiz:Gesquiz2026%21Dev@localhost:3306/gesquiz"
    );

    expect(parts).toEqual({
      host: "localhost",
      port: 3306,
      user: "gesquiz",
      password: "Gesquiz2026!Dev",
      database: "gesquiz",
    });
  });

  it("usa 3306 cuando no se indica puerto y admite parámetros de consulta", () => {
    const parts = parseDatabaseUrl(
      "mysql://user:secret@127.0.0.1/quizcolegio_prod?ssl=true"
    );

    expect(parts.port).toBe(3306);
    expect(parts.host).toBe("127.0.0.1");
    expect(parts.database).toBe("quizcolegio_prod");
  });

  it("rechaza contraseñas con '#' sin codificar", () => {
    expect(() =>
      parseDatabaseUrl("mysql://user:pa#ss@localhost:3306/gesquiz")
    ).toThrow(/%23/);
  });

  it("rechaza contraseñas con '?' sin codificar", () => {
    expect(() =>
      parseDatabaseUrl("mysql://user:pa?ss@localhost:3306/gesquiz")
    ).toThrow(/%3F/);
  });

  it("rechaza secuencias de escape inválidas", () => {
    expect(() =>
      parseDatabaseUrl("mysql://user:pa%zzss@localhost:3306/gesquiz")
    ).toThrow(/%25/);
  });

  it("exige el nombre de la base de datos", () => {
    expect(() =>
      parseDatabaseUrl("mysql://user:secret@localhost:3306")
    ).toThrow(/base de datos/i);
  });

  it("exige el esquema mysql:// o mariadb://", () => {
    expect(() =>
      parseDatabaseUrl("postgres://user:secret@localhost:5432/gesquiz")
    ).toThrow(/mysql:\/\//);
  });
});
