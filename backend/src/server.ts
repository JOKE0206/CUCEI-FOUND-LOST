import { app } from "./app";
import { env } from "./config/env";

// Express 5 entrega al callback los errores de arranque (por ejemplo, puerto ocupado).
app.listen(env.port, (error) => {
  if (error) {
    console.error("No se pudo iniciar el backend:", error.message);
    process.exit(1);
  }

  console.log(`Backend escuchando en http://localhost:${env.port}`);
});
