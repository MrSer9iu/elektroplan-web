(() => {
  const canvas = document.getElementById('cv');
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('cw');
  const menu = document.getElementById('cm');
  const dd = document.getElementById('dd');

  const GRID = 0.25;
  const WALL_SNAP_PX = 20;
  const HANDLE_RADIUS_PX = 8;
  const ELEMENT_OFFSET = 0.14;
  const OPENING_DEFAULT = { door: 0.9, window: 1.2 };

  const SYMBOL_META = {
    steckdose: { label: 'Steckdose', color: '#22C55E', cat: 'power' },
    schalter: { label: 'Ausschalter', color: '#22C55E', cat: 'power' },
    wechsel: { label: 'Wechselschalter', color: '#22C55E', cat: 'power' },
    kreuz: { label: 'Kreuzschalter', color: '#22C55E', cat: 'power' },
    taster: { label: 'Taster', color: '#22C55E', cat: 'power' },
    verteiler: { label: 'Verteilerdose', color: '#22C55E', cat: 'power' },
    sicherung: { label: 'Sicherungskasten', color: '#22C55E', cat: 'power' },
    data: { label: 'Datensteckdose', color: '#22C55E', cat: 'power' },
    licht: { label: 'Lichtpunkt', color: '#EF5350', cat: 'light' },
    leuchte: { label: 'Leuchte', color: '#EF5350', cat: 'light' },
    spot: { label: 'Taster m. Leuchte', color: '#EF5350', cat: 'light' },
  };

  const EXTRA_TOOLS = [
    { id: 'to-door', label: 'Tür', tool: 'door', color: '#4FC3F7' },
    { id: 'to-window', label: 'Fenster', tool: 'window', color: '#4FC3F7' },
  ];

  let project = createProject();
  let projectName = 'Neues Projekt';
  let currentTool = 'pan';
  let wallStyle = { thick: 0.12, color: '#2D3748' };
  let view = { x: 0, y: 0, zoom: 1 };
  let selected = null;
  let draftWall = null;
  let history = [];
  let redoStack = [];
  let drag = null;
  let activeDialog = null;
  let dialogAction = null;

  function createProject() {
    return { scale: 80, grid: GRID, walls: [], elements: [], openings: [] };
  }

  function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 9);
  }

  function cloneProject(data = project) {
    return JSON.parse(JSON.stringify(data));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeProject(raw) {
    if (!raw) return createProject();
    if (raw.project) raw = raw.project;
    const next = createProject();
    next.scale = raw.scale || next.scale;
    next.grid = raw.grid || next.grid;
    next.walls = (raw.walls || []).map((wall) => ({
      id: wall.id || uid('wall'),
      ax: wall.ax ?? wall.x1 ?? 0,
      ay: wall.ay ?? wall.y1 ?? 0,
      bx: wall.bx ?? wall.x2 ?? ((wall.x1 || 0) + (wall.len || 1)),
      by: wall.by ?? wall.y2 ?? (wall.y1 || 0),
      thick: wall.thick ?? wall.t ?? wall.thickness ?? wallStyle.thick,
      color: wall.color || '#2D3748',
    }));
    next.elements = (raw.elements || raw.symbols || []).map((item) => {
      const type = item.type || item.kind || 'steckdose';
      return {
        id: item.id || uid('el'),
        type,
        x: item.x ?? 0,
        y: item.y ?? 0,
        rot: item.rot || 0,
        label: item.label || (SYMBOL_META[type]?.label || type),
        attachedWallId: item.attachedWallId || null,
        wallOffset: item.wallOffset ?? 0.5,
        wallSide: item.wallSide ?? 1,
        wallDistance: item.wallDistance ?? ELEMENT_OFFSET,
      };
    });
    next.openings = (raw.openings || []).map((item) => ({
      id: item.id || uid('op'),
      type: item.type === 'window' ? 'window' : 'door',
      wallId: item.wallId || null,
      offset: clamp(item.offset ?? 0.5, 0, 1),
      width: item.width || OPENING_DEFAULT[item.type === 'window' ? 'window' : 'door'],
    }));
    next.elements.forEach(syncElementAttachment);
    next.openings.forEach(syncOpening);
    return next;
  }

  function worldToScreen(x, y) {
    return { x: x * project.scale * view.zoom + view.x, y: y * project.scale * view.zoom + view.y };
  }

  function screenToWorld(x, y) {
    return { x: (x - view.x) / (project.scale * view.zoom), y: (y - view.y) / (project.scale * view.zoom) };
  }

  function snapValue(value) {
    return Math.round(value / project.grid) * project.grid;
  }

  function snapPoint(point, enabled = true) {
    return enabled ? { x: snapValue(point.x), y: snapValue(point.y) } : point;
  }

  function wallGeom(wall) {
    const dx = wall.bx - wall.ax;
    const dy = wall.by - wall.ay;
    const len = Math.hypot(dx, dy) || 0.0001;
    return { dx, dy, len, ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len };
  }

  function projectPointToWall(wall, point) {
    const g = wallGeom(wall);
    const vx = point.x - wall.ax;
    const vy = point.y - wall.ay;
    const along = vx * g.ux + vy * g.uy;
    const t = clamp(along / g.len, 0, 1);
    const px = wall.ax + g.dx * t;
    const py = wall.ay + g.dy * t;
    const offX = point.x - px;
    const offY = point.y - py;
    const dist = Math.hypot(offX, offY);
    const signed = offX * g.nx + offY * g.ny;
    return { t, px, py, dist, signed, len: g.len, ux: g.ux, uy: g.uy, nx: g.nx, ny: g.ny };
  }

  function nearestWall(point) {
    let best = null;
    let bestPx = Infinity;
    for (const wall of project.walls) {
      const hit = projectPointToWall(wall, point);
      const distPx = hit.dist * project.scale * view.zoom;
      if (distPx < bestPx) {
        bestPx = distPx;
        best = { wall, hit, distPx };
      }
    }
    return best;
  }

  function positionOnWall(wall, offset, side = 1, distance = 0) {
    const g = wallGeom(wall);
    const x = wall.ax + g.dx * offset + g.nx * distance * side;
    const y = wall.ay + g.dy * offset + g.ny * distance * side;
    return { x, y, rot: Math.atan2(g.dy, g.dx) };
  }

  function syncElementAttachment(element) {
    if (!element.attachedWallId) return;
    const wall = project.walls.find((item) => item.id === element.attachedWallId);
    if (!wall) {
      element.attachedWallId = null;
      return;
    }
    const pos = positionOnWall(wall, element.wallOffset, element.wallSide, element.wallDistance);
    element.x = pos.x;
    element.y = pos.y;
    element.rot = pos.rot;
  }

  function syncOpening(opening) {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    if (!wall) return;
    const g = wallGeom(wall);
    const maxWidth = Math.max(0.4, g.len - 0.2);
    opening.width = clamp(opening.width, 0.4, maxWidth);
    const half = (opening.width / g.len) / 2;
    opening.offset = clamp(opening.offset, half, 1 - half);
  }

  function syncAllAttachments() {
    project.elements.forEach(syncElementAttachment);
    project.openings.forEach(syncOpening);
  }

  function resizeCanvas() {
    const rect = wrap.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }

  function renderAll() {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawWalls();
    drawOpenings();
    drawDraftWall();
    drawElements();
    drawSelection();
    updateStats();
  }

  function drawGrid() {
    const step = project.grid * project.scale * view.zoom;
    if (step < 8) return;
    ctx.save();
    ctx.strokeStyle = '#D9E2EC';
    ctx.lineWidth = 1;
    const startX = ((-view.x % step) + step) % step;
    const startY = ((-view.y % step) + step) % step;
    for (let x = startX; x <= canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y <= canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWalls() {
    for (const wall of project.walls) {
      const a = worldToScreen(wall.ax, wall.ay);
      const b = worldToScreen(wall.bx, wall.by);
      ctx.save();
      ctx.strokeStyle = wall.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(4, wall.thick * project.scale * view.zoom);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  function openingScreenPoints(opening) {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    if (!wall) return null;
    const g = wallGeom(wall);
    const center = positionOnWall(wall, opening.offset, 1, 0);
    const half = opening.width / 2;
    return {
      g,
      center: worldToScreen(center.x, center.y),
      start: worldToScreen(center.x - g.ux * half, center.y - g.uy * half),
      end: worldToScreen(center.x + g.ux * half, center.y + g.uy * half),
    };
  }

  function drawOpenings() {
    for (const opening of project.openings) {
      const pts = openingScreenPoints(opening);
      if (!pts) continue;
      ctx.save();
      ctx.lineCap = 'round';
      if (opening.type === 'door') {
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pts.start.x, pts.start.y);
        ctx.lineTo(pts.end.x, pts.end.y);
        ctx.stroke();
        const r = Math.hypot(pts.center.x - pts.start.x, pts.center.y - pts.start.y);
        const startAng = Math.atan2(pts.start.y - pts.center.y, pts.start.x - pts.center.x);
        ctx.strokeStyle = 'rgba(37,99,235,.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pts.center.x, pts.center.y, r, startAng, startAng + Math.PI / 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#0EA5E9';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pts.start.x, pts.start.y);
        ctx.lineTo(pts.end.x, pts.end.y);
        ctx.stroke();
      }
      if (selected?.type === 'opening' && selected.id === opening.id) {
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#4FC3F7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pts.center.x, pts.center.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawDraftWall() {
    if (!draftWall) return;
    const a = worldToScreen(draftWall.ax, draftWall.ay);
    const b = worldToScreen(draftWall.bx, draftWall.by);
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = '#4FC3F7';
    ctx.lineWidth = Math.max(2, wallStyle.thick * project.scale * view.zoom);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawElements() {
    for (const element of project.elements) {
      const p = worldToScreen(element.x, element.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(element.rot || 0);
      drawElementIcon(ctx, element.type, SYMBOL_META[element.type]?.color || '#22C55E');
      if (selected?.type === 'element' && selected.id === element.id) {
        ctx.strokeStyle = '#4FC3F7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawSelection() {
    if (selected?.type !== 'wall') return;
    const wall = project.walls.find((item) => item.id === selected.id);
    if (!wall) return;
    for (const point of [{ x: wall.ax, y: wall.ay }, { x: wall.bx, y: wall.by }]) {
      const p = worldToScreen(point.x, point.y);
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#4FC3F7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawElementIcon(target, type, color) {
    target.save();
    target.strokeStyle = color;
    target.fillStyle = color;
    target.lineWidth = 2;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    switch (type) {
      case 'steckdose':
        target.beginPath();
        target.arc(0, 0, 11, 0, Math.PI * 2);
        target.stroke();
        target.beginPath();
        target.moveTo(-4, -3);
        target.lineTo(-4, 3);
        target.moveTo(4, -3);
        target.lineTo(4, 3);
        target.stroke();
        break;
      case 'schalter':
        target.beginPath();
        target.arc(0, 0, 11, 0, Math.PI * 2);
        target.stroke();
        target.beginPath();
        target.moveTo(0, 0);
        target.lineTo(8, -8);
        target.stroke();
        target.beginPath();
        target.arc(8, -8, 2, 0, Math.PI * 2);
        target.fill();
        break;
      case 'wechsel':
        target.beginPath();
        target.arc(0, 0, 11, 0, Math.PI * 2);
        target.stroke();
        target.beginPath();
        target.moveTo(-3, 3);
        target.lineTo(8, -8);
        target.moveTo(3, 3);
        target.lineTo(8, -2);
        target.stroke();
        break;
      case 'kreuz':
        target.beginPath();
        target.rect(-11, -11, 22, 22);
        target.stroke();
        target.beginPath();
        target.moveTo(-7, -7);
        target.lineTo(7, 7);
        target.moveTo(7, -7);
        target.lineTo(-7, 7);
        target.stroke();
        break;
      case 'taster':
        target.beginPath();
        target.arc(0, 0, 11, 0, Math.PI * 2);
        target.stroke();
        target.beginPath();
        target.moveTo(-5, 0);
        target.lineTo(5, 0);
        target.stroke();
        break;
      case 'verteiler':
        target.beginPath();
        target.rect(-11, -11, 22, 22);
        target.stroke();
        target.beginPath();
        target.moveTo(-6, -6);
        target.lineTo(6, 6);
        target.moveTo(6, -6);
        target.lineTo(-6, 6);
        target.stroke();
        break;
      case 'sicherung':
        target.beginPath();
        target.rect(-11, -8, 22, 16);
        target.stroke();
        target.beginPath();
        target.moveTo(-7, -3);
        target.lineTo(7, -3);
        target.moveTo(-7, 0);
        target.lineTo(7, 0);
        target.moveTo(-7, 3);
        target.lineTo(7, 3);
        target.stroke();
        break;
      case 'data':
        target.beginPath();
        target.moveTo(0, -10);
        target.lineTo(0, 4);
        target.moveTo(-8, 4);
        target.lineTo(8, 4);
        target.moveTo(-8, 8);
        target.lineTo(8, 8);
        target.stroke();
        break;
      case 'licht':
        target.beginPath();
        target.arc(0, 0, 7, 0, Math.PI * 2);
        target.stroke();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          target.beginPath();
          target.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
          target.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
          target.stroke();
        }
        break;
      case 'leuchte':
        target.beginPath();
        target.arc(0, 0, 11, 0, Math.PI * 2);
        target.stroke();
        target.beginPath();
        target.moveTo(-7, -7);
        target.lineTo(7, 7);
        target.moveTo(7, -7);
        target.lineTo(-7, 7);
        target.stroke();
        break;
      case 'spot':
        target.beginPath();
        target.arc(0, 0, 11, 0, Math.PI * 2);
        target.stroke();
        target.beginPath();
        target.arc(0, 0, 4, 0, Math.PI * 2);
        target.fill();
        break;
    }
    target.restore();
  }

  function svgMarkup(type, color = '#22C55E') {
    const common = `fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
    switch (type) {
      case 'door':
        return `<svg viewBox="0 0 28 28"><path ${common} d="M7 22V6h9v16"/><path ${common} d="M16 6a10 10 0 0 1 5 8.5"/></svg>`;
      case 'window':
        return `<svg viewBox="0 0 28 28"><path ${common} d="M5 13h18"/><path ${common} d="M5 17h18"/><path ${common} d="M9 10v10M19 10v10"/></svg>`;
      case 'steckdose':
        return `<svg viewBox="0 0 28 28"><circle ${common} cx="14" cy="14" r="9"/><path ${common} d="M11 11v6M17 11v6"/></svg>`;
      case 'schalter':
        return `<svg viewBox="0 0 28 28"><circle ${common} cx="14" cy="14" r="9"/><path ${common} d="M14 14l6-6"/><circle cx="20" cy="8" r="1.5" fill="${color}"/></svg>`;
      case 'wechsel':
        return `<svg viewBox="0 0 28 28"><circle ${common} cx="14" cy="14" r="9"/><path ${common} d="M11 16l8-8M17 16l4-4"/></svg>`;
      case 'kreuz':
        return `<svg viewBox="0 0 28 28"><rect ${common} x="5" y="5" width="18" height="18" rx="1"/><path ${common} d="M9 9l10 10M19 9L9 19"/></svg>`;
      case 'taster':
        return `<svg viewBox="0 0 28 28"><circle ${common} cx="14" cy="14" r="9"/><path ${common} d="M10 14h8"/></svg>`;
      case 'verteiler':
        return `<svg viewBox="0 0 28 28"><rect ${common} x="5" y="5" width="18" height="18" rx="1"/><path ${common} d="M9 9l10 10M19 9L9 19"/></svg>`;
      case 'sicherung':
        return `<svg viewBox="0 0 28 28"><rect ${common} x="4" y="7" width="20" height="14" rx="1"/><path ${common} d="M8 11h12M8 14h12M8 17h12"/></svg>`;
      case 'data':
        return `<svg viewBox="0 0 28 28"><path ${common} d="M14 6v12M7 18h14M7 22h14"/></svg>`;
      case 'licht':
        return `<svg viewBox="0 0 28 28"><circle ${common} cx="14" cy="14" r="5"/><path ${common} d="M14 4v4M14 20v4M4 14h4M20 14h4M7 7l3 3M18 18l3 3M21 7l-3 3M7 21l3-3"/></svg>`;
      case 'leuchte':
        return `<svg viewBox="0 0 28 28"><circle ${common} cx="14" cy="14" r="9"/><path ${common} d="M10 10l8 8M18 10l-8 8"/></svg>`;
      case 'spot':
        return `<svg viewBox="0 0 28 28"><circle ${common} cx="14" cy="14" r="9"/><circle cx="14" cy="14" r="3.5" fill="${color}"/></svg>`;
      default:
        return `<svg viewBox="0 0 28 28"><rect ${common} x="5" y="5" width="18" height="18" rx="2"/></svg>`;
    }
  }

  function hitWall(point) {
    let best = null;
    for (const wall of project.walls) {
      const hit = projectPointToWall(wall, point);
      const pxDist = hit.dist * project.scale * view.zoom;
      const pad = Math.max(10, wall.thick * project.scale * view.zoom / 2 + 8);
      if (pxDist <= pad && (!best || pxDist < best.dist)) best = { wall, dist: pxDist };
    }
    return best?.wall || null;
  }

  function hitWallHandle(point) {
    if (selected?.type !== 'wall') return null;
    const wall = project.walls.find((item) => item.id === selected.id);
    if (!wall) return null;
    const q = worldToScreen(point.x, point.y);
    const handles = [{ key: 'a', x: wall.ax, y: wall.ay }, { key: 'b', x: wall.bx, y: wall.by }];
    for (const handle of handles) {
      const p = worldToScreen(handle.x, handle.y);
      if (Math.hypot(p.x - q.x, p.y - q.y) <= HANDLE_RADIUS_PX + 4) return handle.key;
    }
    return null;
  }

  function hitElement(point) {
    for (let i = project.elements.length - 1; i >= 0; i--) {
      const el = project.elements[i];
      const p = worldToScreen(el.x, el.y);
      const q = worldToScreen(point.x, point.y);
      if (Math.hypot(p.x - q.x, p.y - q.y) <= 18) return el;
    }
    return null;
  }

  function hitOpening(point) {
    for (let i = project.openings.length - 1; i >= 0; i--) {
      const opening = project.openings[i];
      const pts = openingScreenPoints(opening);
      if (!pts) continue;
      const q = worldToScreen(point.x, point.y);
      if (Math.hypot(pts.center.x - q.x, pts.center.y - q.y) <= 14) return opening;
    }
    return null;
  }

  function snapshot() {
    history.push(cloneProject());
    if (history.length > 80) history.shift();
    redoStack = [];
    updateUndoRedo();
  }

  function applyProject(next) {
    project = normalizeProject(next);
    syncAllAttachments();
    renderAll();
  }

  function updateUndoRedo() {
    document.getElementById('bundo').disabled = history.length === 0;
    document.getElementById('bredo').disabled = redoStack.length === 0;
  }

  function updateStats() {
    document.getElementById('cwalls').textContent = project.walls.length + ' Wände';
    document.getElementById('celems').textContent = (project.elements.length + project.openings.length) + ' Elemente';
    const counts = {};
    for (const el of project.elements) counts[el.type] = (counts[el.type] || 0) + 1;
    for (const op of project.openings) counts[op.type] = (counts[op.type] || 0) + 1;
    const chips = document.getElementById('schips');
    chips.innerHTML = '';
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    document.getElementById('stotal').style.display = total ? 'flex' : 'none';
    document.getElementById('stotalT').textContent = total + ' Gesamt';
    Object.entries(counts).forEach(([key, value]) => {
      const chip = document.createElement('div');
      chip.className = 'sc';
      const meta = SYMBOL_META[key] || { label: key, color: '#4FC3F7' };
      chip.style.background = meta.color === '#EF5350' ? 'rgba(239,83,80,.12)' : 'rgba(34,197,94,.12)';
      chip.style.border = `1px solid ${meta.color}55`;
      chip.style.color = meta.color;
      chip.textContent = `${meta.label || (key === 'door' ? 'Tür' : 'Fenster')}: ${value}`;
      chips.appendChild(chip);
    });
  }

  function setStatus(text, color = '#6B7280') {
    document.getElementById('st').textContent = text;
    document.getElementById('sd').style.background = color;
  }

  function setActiveButton(tool) {
    document.querySelectorAll('#sb .tb').forEach((btn) => btn.classList.remove('abl', 'agr', 'ard', 'atn'));
    const target = tool === 'wall' ? document.getElementById('tw')
      : tool === 'pan' ? document.getElementById('tp')
      : document.getElementById(tool === 'door' ? 'to-door' : tool === 'window' ? 'to-window' : `sy-${tool}`);
    if (!target) return;
    const cls = tool === 'door' || tool === 'window' ? 'atn'
      : tool === 'wall' || tool === 'pan' ? 'abl'
      : SYMBOL_META[tool]?.cat === 'light' ? 'ard'
      : 'agr';
    target.classList.add(cls);
  }

  function deleteSelected() {
    if (!selected) return;
    snapshot();
    if (selected.type === 'wall') {
      project.walls = project.walls.filter((item) => item.id !== selected.id);
      project.elements.forEach((el) => { if (el.attachedWallId === selected.id) el.attachedWallId = null; });
      project.openings = project.openings.filter((item) => item.wallId !== selected.id);
    } else if (selected.type === 'element') {
      project.elements = project.elements.filter((item) => item.id !== selected.id);
    } else if (selected.type === 'opening') {
      project.openings = project.openings.filter((item) => item.id !== selected.id);
    }
    selected = null;
    syncAllAttachments();
    renderAll();
  }

  function attachElementToNearestWall(element, point) {
    const nearest = nearestWall(point);
    if (!nearest || nearest.distPx >= WALL_SNAP_PX) {
      element.attachedWallId = null;
      element.x = point.x;
      element.y = point.y;
      return;
    }
    element.attachedWallId = nearest.wall.id;
    element.wallOffset = nearest.hit.t;
    element.wallSide = nearest.hit.signed >= 0 ? 1 : -1;
    element.wallDistance = ELEMENT_OFFSET;
    syncElementAttachment(element);
  }

  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
  }

  function selectHit(point) {
    const element = hitElement(point);
    if (element) return { type: 'element', id: element.id };
    const opening = hitOpening(point);
    if (opening) return { type: 'opening', id: opening.id };
    const wall = hitWall(point);
    if (wall) return { type: 'wall', id: wall.id };
    return null;
  }

  function startDrag(kind, data) {
    snapshot();
    drag = { kind, ...data };
  }

  function onPointerDown(event) {
    if (event.button === 2) return;
    canvas.setPointerCapture(event.pointerId);
    const point = snapPoint(pointerPos(event), currentTool !== 'pan');
    closeContext();
    const handle = hitWallHandle(point);
    if (handle) {
      startDrag('wall-handle', { wallId: selected.id, handle });
      return;
    }
    if (currentTool === 'wall') {
      if (!draftWall) {
        draftWall = { ax: point.x, ay: point.y, bx: point.x, by: point.y };
        setStatus('Wandpunkt setzen', '#4FC3F7');
      } else {
        const next = snapPoint(pointerPos(event), true);
        if (Math.hypot(next.x - draftWall.ax, next.y - draftWall.ay) >= 0.1) {
          snapshot();
          project.walls.push({
            id: uid('wall'),
            ax: draftWall.ax,
            ay: draftWall.ay,
            bx: next.x,
            by: next.y,
            thick: wallStyle.thick,
            color: wallStyle.color,
          });
          draftWall = null;
          syncAllAttachments();
          renderAll();
          setStatus('Wand erstellt', '#22C55E');
        }
      }
      return;
    }
    if (currentTool === 'door' || currentTool === 'window') {
      const nearest = nearestWall(point);
      if (nearest && nearest.distPx < WALL_SNAP_PX) {
        snapshot();
        const opening = {
          id: uid('op'),
          type: currentTool,
          wallId: nearest.wall.id,
          offset: nearest.hit.t,
          width: OPENING_DEFAULT[currentTool],
        };
        syncOpening(opening);
        project.openings.push(opening);
        selected = { type: 'opening', id: opening.id };
        renderAll();
      }
      return;
    }
    if (SYMBOL_META[currentTool]) {
      snapshot();
      const element = {
        id: uid('el'),
        type: currentTool,
        x: point.x,
        y: point.y,
        rot: 0,
        label: SYMBOL_META[currentTool].label,
        attachedWallId: null,
        wallOffset: 0.5,
        wallSide: 1,
        wallDistance: ELEMENT_OFFSET,
      };
      attachElementToNearestWall(element, point);
      project.elements.push(element);
      selected = { type: 'element', id: element.id };
      renderAll();
      return;
    }

    const hit = selectHit(point);
    selected = hit;
    renderAll();
    if (currentTool === 'pan' && !hit) {
      drag = { kind: 'pan', startX: event.clientX, startY: event.clientY, viewX: view.x, viewY: view.y };
      return;
    }
    if (!hit) return;
    if (hit.type === 'wall') {
      startDrag('wall-move', { wallId: hit.id, anchor: point });
    } else if (hit.type === 'element') {
      startDrag('element', { elementId: hit.id });
    } else if (hit.type === 'opening') {
      startDrag('opening', { openingId: hit.id });
    }
  }

  function onPointerMove(event) {
    const rawPoint = pointerPos(event);
    const point = snapPoint(rawPoint, currentTool !== 'pan');
    if (draftWall) {
      draftWall.bx = point.x;
      draftWall.by = point.y;
      renderAll();
    }
    if (!drag) return;
    if (drag.kind === 'pan') {
      view.x = drag.viewX + (event.clientX - drag.startX);
      view.y = drag.viewY + (event.clientY - drag.startY);
      renderAll();
      return;
    }
    if (drag.kind === 'wall-handle') {
      const wall = project.walls.find((item) => item.id === drag.wallId);
      if (!wall) return;
      if (drag.handle === 'a') {
        wall.ax = point.x;
        wall.ay = point.y;
      } else {
        wall.bx = point.x;
        wall.by = point.y;
      }
      syncAllAttachments();
      renderAll();
      return;
    }
    if (drag.kind === 'wall-move') {
      const wall = project.walls.find((item) => item.id === drag.wallId);
      if (!wall) return;
      const dx = point.x - drag.anchor.x;
      const dy = point.y - drag.anchor.y;
      wall.ax += dx;
      wall.ay += dy;
      wall.bx += dx;
      wall.by += dy;
      drag.anchor = point;
      syncAllAttachments();
      renderAll();
      return;
    }
    if (drag.kind === 'element') {
      const element = project.elements.find((item) => item.id === drag.elementId);
      if (!element) return;
      attachElementToNearestWall(element, point);
      if (!element.attachedWallId) {
        element.x = point.x;
        element.y = point.y;
      }
      renderAll();
      return;
    }
    if (drag.kind === 'opening') {
      const opening = project.openings.find((item) => item.id === drag.openingId);
      if (!opening) return;
      const nearest = nearestWall(point);
      if (nearest) {
        opening.wallId = nearest.wall.id;
        opening.offset = nearest.hit.t;
        syncOpening(opening);
        renderAll();
      }
    }
  }

  function onPointerUp() {
    drag = null;
  }

  function showContext(event) {
    event.preventDefault();
    const point = pointerPos(event);
    selected = selectHit(point);
    renderAll();
    if (!selected) {
      closeContext();
      return;
    }
    menu.innerHTML = '';
    const del = document.createElement('button');
    del.className = 'ci d';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>Löschen';
    del.onclick = () => { closeContext(); deleteSelected(); };
    menu.appendChild(del);
    if (selected.type === 'element') {
      const rot = document.createElement('button');
      rot.className = 'ci';
      rot.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/></svg>Drehen';
      rot.onclick = () => {
        const el = project.elements.find((item) => item.id === selected.id);
        if (!el) return;
        snapshot();
        el.rot += Math.PI / 2;
        renderAll();
        closeContext();
      };
      menu.appendChild(rot);
    }
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.classList.add('s');
  }

  function closeContext() {
    menu.classList.remove('s');
  }

  function showDialog(id) {
    document.getElementById(id).classList.add('s');
    activeDialog = id;
  }

  function hideDialog(id) {
    document.getElementById(id).classList.remove('s');
    if (activeDialog === id) activeDialog = null;
  }

  function toast(text) {
    let node = document.getElementById('toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'toast';
      node.style = 'position:fixed;bottom:56px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;z-index:1100;opacity:0;transition:opacity .2s';
      document.body.appendChild(node);
    }
    node.textContent = text;
    node.style.opacity = '1';
    clearTimeout(node._t);
    node._t = setTimeout(() => { node.style.opacity = '0'; }, 2200);
  }

  function updateProjectLabel() {
    document.getElementById('plbl').textContent = projectName;
  }

  function allProjects() {
    try { return JSON.parse(localStorage.getItem('ep') || '[]'); } catch { return []; }
  }

  function writeProjects(items) {
    localStorage.setItem('ep', JSON.stringify(items));
  }

  function saveCurrentProject() {
    const items = allProjects().filter((item) => item.name !== projectName);
    items.push({ name: projectName, project: cloneProject() });
    writeProjects(items);
    toast('Projekt gespeichert');
  }

  function refreshOpenDialog() {
    const list = document.getElementById('dopenL');
    list.innerHTML = '';
    const items = allProjects();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.style.color = '#9CA3AF';
      empty.style.fontSize = '13px';
      empty.textContent = 'Keine Projekte gespeichert';
      list.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'di';
      btn.style.borderRadius = '10px';
      btn.style.marginBottom = '6px';
      btn.textContent = item.name;
      btn.onclick = () => {
        projectName = item.name;
        updateProjectLabel();
        history = [];
        redoStack = [];
        updateUndoRedo();
        applyProject(normalizeProject(item.project || item));
        hideDialog('dopen');
      };
      list.appendChild(btn);
    });
  }

  function exportPdf() {
    const api = window.jspdf?.jsPDF;
    if (!api) {
      toast('jsPDF nicht geladen');
      return;
    }
    renderAll();
    const pdf = new api({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;
    const margin = 10;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height / canvas.width) * imgW;
    const drawH = Math.min(imgH, pageH - margin * 2);
    const drawW = drawH * (canvas.width / canvas.height);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH, undefined, 'FAST');
    pdf.save((projectName || 'elektroplan') + '.pdf');
  }

  function injectButtons() {
    const clearBtn = Array.from(document.querySelectorAll('#sb .tb')).at(-1);
    EXTRA_TOOLS.forEach((item) => {
      if (document.getElementById(item.id)) return;
      const btn = document.createElement('button');
      btn.className = 'tb';
      btn.id = item.id;
      btn.innerHTML = `${svgMarkup(item.tool, item.color)}${item.label}`;
      btn.onclick = () => window.setTool(item.tool);
      clearBtn.parentNode.insertBefore(btn, clearBtn);
    });
    if (!document.getElementById('export-pdf')) {
      const exportBtn = document.createElement('button');
      exportBtn.id = 'export-pdf';
      exportBtn.className = 'di';
      exportBtn.onclick = exportPdf;
      exportBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 21h14"/></svg>PDF exportieren';
      dd.insertBefore(exportBtn, dd.querySelector('.dsep'));
    }
  }

  function replacePngIcons() {
    Object.entries(SYMBOL_META).forEach(([type, meta]) => {
      const button = document.getElementById(`sy-${type}`);
      if (!button) return;
      button.innerHTML = `${svgMarkup(type, meta.color)}${meta.label}`;
    });
  }

  window.setTool = function setTool(tool) {
    currentTool = tool;
    draftWall = null;
    setActiveButton(tool);
    const labels = {
      wall: ['Wand zeichnen', '#4FC3F7'],
      pan: ['Objekte bewegen', '#6B7280'],
      door: ['Tür auf Wand platzieren', '#34D399'],
      window: ['Fenster auf Wand platzieren', '#34D399'],
    };
    const info = labels[tool] || [((SYMBOL_META[tool]?.label || tool) + ' platzieren'), SYMBOL_META[tool]?.color || '#22C55E'];
    setStatus(info[0], info[1]);
  };

  window.setSym = function setSym(type) { window.setTool(type); };
  window.setThk = function setThk(cm) {
    wallStyle.thick = cm / 100;
    document.querySelectorAll('.tkb').forEach((btn) => btn.classList.remove('a'));
    document.getElementById(cm === 3 ? 'tkt' : cm === 6 ? 'tkn' : 'tkb').classList.add('a');
  };
  window.setWC = function setWC(color, node) {
    wallStyle.color = color;
    document.querySelectorAll('.cd').forEach((item) => item.classList.remove('a'));
    node.classList.add('a');
  };
  window.zIn = function zIn() { view.zoom = clamp(view.zoom * 1.15, 0.35, 4); renderAll(); };
  window.zOut = function zOut() { view.zoom = clamp(view.zoom / 1.15, 0.35, 4); renderAll(); };
  window.zReset = function zReset() {
    resizeCanvas();
    view.zoom = 1;
    view.x = canvas.width / 2;
    view.y = canvas.height / 2;
    renderAll();
  };
  window.undo = function undo() {
    if (!history.length) return;
    redoStack.push(cloneProject());
    applyProject(history.pop());
    updateUndoRedo();
  };
  window.redo = function redo() {
    if (!redoStack.length) return;
    history.push(cloneProject());
    applyProject(redoStack.pop());
    updateUndoRedo();
  };
  window.toggleDD = function toggleDD() { dd.classList.toggle('s'); };
  window.cDlg = function cDlg(id) { hideDialog(id); };
  window.newProj = function newProj() {
    dd.classList.remove('s');
    dialogAction = () => {
      history = [];
      redoStack = [];
      project = createProject();
      selected = null;
      projectName = 'Neues Projekt';
      updateProjectLabel();
      updateUndoRedo();
      renderAll();
    };
    document.getElementById('dconft').textContent = 'Neues Projekt';
    document.getElementById('dconfp').textContent = 'Aktuelles Projekt wirklich leeren?';
    showDialog('dconf');
  };
  window.saveProj = function saveProj() { dd.classList.remove('s'); saveCurrentProject(); };
  window.openProj = function openProj() { dd.classList.remove('s'); refreshOpenDialog(); showDialog('dopen'); };
  window.renameProj = function renameProj() {
    dd.classList.remove('s');
    document.getElementById('dnamet').textContent = 'Umbenennen';
    document.getElementById('dnamei').value = projectName;
    dialogAction = (name) => { if (name) { projectName = name; updateProjectLabel(); } };
    showDialog('dname');
  };
  window.dupProj = function dupProj() {
    dd.classList.remove('s');
    const name = projectName + ' (Kopie)';
    const items = allProjects();
    items.push({ name, project: cloneProject() });
    writeProjects(items);
    toast('Projekt dupliziert');
  };
  window.confirmClear = function confirmClear() {
    dd.classList.remove('s');
    dialogAction = () => {
      snapshot();
      project.walls = [];
      project.elements = [];
      project.openings = [];
      selected = null;
      renderAll();
    };
    document.getElementById('dconft').textContent = 'Alles löschen';
    document.getElementById('dconfp').textContent = 'Alle Wände, Elemente, Türen und Fenster löschen?';
    showDialog('dconf');
  };
  window.okName = function okName() {
    const value = document.getElementById('dnamei').value.trim();
    hideDialog('dname');
    if (typeof dialogAction === 'function') dialogAction(value);
  };
  window.okLen = function okLen() { hideDialog('dlen'); };

  document.getElementById('dconfok').onclick = () => {
    hideDialog('dconf');
    if (typeof dialogAction === 'function') dialogAction();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', showContext);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const before = screenToWorld(event.offsetX, event.offsetY);
    view.zoom = clamp(view.zoom * (event.deltaY < 0 ? 1.1 : 0.9), 0.35, 4);
    const after = worldToScreen(before.x, before.y);
    view.x += event.offsetX - after.x;
    view.y += event.offsetY - after.y;
    renderAll();
  }, { passive: false });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) window.redo(); else window.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      window.redo();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (activeDialog) return;
      event.preventDefault();
      deleteSelected();
      return;
    }
    if (event.key === 'Escape') {
      draftWall = null;
      closeContext();
      dd.classList.remove('s');
      renderAll();
    }
  });

  document.addEventListener('click', (event) => {
    const menuBtn = document.getElementById('menu-btn');
    if (!dd.contains(event.target) && !menuBtn.contains(event.target)) dd.classList.remove('s');
    if (!menu.contains(event.target)) closeContext();
  });

  window.addEventListener('resize', renderAll);

  replacePngIcons();
  injectButtons();
  updateProjectLabel();
  window.setThk(6);
  window.setTool('pan');
  updateUndoRedo();
  window.zReset();
  renderAll();
})();
