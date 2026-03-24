import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { initializeSocket } from "./sockets";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initializeSocket(server);

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} (listening on all interfaces)`);
  console.log("Health check endpoint: /health");
});
