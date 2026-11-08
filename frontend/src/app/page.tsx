"use client";

import { useEffect, useState } from "react";

type EstadoBackend = "consultando" | "conectado" | "sin conexión";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {
  const [estado, setEstado] = useState<EstadoBackend>("consultando");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((respuesta) => setEstado(respuesta.ok ? "conectado" : "sin conexión"))
      .catch(() => setEstado("sin conexión"));
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-bold">CUCEI Found &amp; Lost</h1>
      <p>Objetos perdidos y encontrados en CUCEI.</p>
      <p className="text-sm opacity-70">Backend: {estado}</p>
    </main>
  );
}
