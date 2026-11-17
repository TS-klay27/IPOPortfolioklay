const fs = require('fs');
const L = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const re = /\b(nivel|niveles|NIVEL|pulsa|PULSA|bloque|zona|ZONA|puente|cambia|vuelve|completa|Completa|reinicia|muestra|pista|jugar|JUGAR|campaña|CAMPAÑA|baldosa|BALDOSA|movimientos|MOVIMIENTOS|tiempo|mejor|MEJOR|siguiente|sonido|pausa|nombre|guardar|cerrar|CERRAR|volver|del|las|los|una|para|con|por|que|tus|sin|cuando|desde|este|esta|solo|JUGADOR|NÚCLEO|EN JUEGO|DE PIE)\b|[ÁÉÍÓÚÑáéíóúñ¿¡]/g;
let n = 0;
L.forEach((line, i) => { let m; re.lastIndex = 0; while ((m = re.exec(line)) && n < 40) { n++; console.log(i + 1 + ': …' + line.slice(Math.max(0, m.index - 50), m.index + 60)); } });
console.log('hits:', n);
