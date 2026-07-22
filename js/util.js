const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Necessário sempre que texto vindo do usuário (categoria, descrição) for
// interpolado em innerHTML — sem isso um nome de categoria tipo
// "<img src=x onerror=...>" executaria (XSS armazenado via Realtime DB).
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}
