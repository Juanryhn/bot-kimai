import http from "http";
import { PORT } from "./config";

export function startHealthServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot Kimai Active!");
  });

  server.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
  });

  return server;
}

export function stopServer(server: http.Server) {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
