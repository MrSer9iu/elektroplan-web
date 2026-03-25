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
    steckdose_double: { label: 'Doppelsteckdose', color: '#22C55E', cat: 'power' },
    schalter: { label: 'Schalter', color: '#22C55E', cat: 'power' },
    wechsel: { label: 'Wechselschalter', color: '#22C55E', cat: 'power' },
    kreuz: { label: 'Kreuzschalter', color: '#22C55E', cat: 'power' },
    taster: { label: 'Taster', color: '#22C55E', cat: 'power' },
    verteiler: { label: 'Verteilerdose', color: '#22C55E', cat: 'power' },
    sicherung: { label: 'Sicherungskasten', color: '#22C55E', cat: 'power' },
    data: { label: 'Datendose', color: '#22C55E', cat: 'power' },
    datendose: { label: 'Datendose', color: '#22C55E', cat: 'power' },
    rauchmelder: { label: 'Rauchmelder', color: '#EF5350', cat: 'light' },
    bewegungsmelder: { label: 'Bewegungsmelder', color: '#EF5350', cat: 'light' },
    decke: { label: 'Lampe', color: '#EF5350', cat: 'light' },
    licht: { label: 'Lampe', color: '#EF5350', cat: 'light' },
    leuchte: { label: 'Lampe', color: '#EF5350', cat: 'light' },
    spot: { label: 'Taster m. Leuchte', color: '#EF5350', cat: 'light' },
    motor_jalousie: { label: 'Motor Jalousie', color: '#22C55E', cat: 'power' },
  };

  const icons = {
    steckdose: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="none"/><line x1="40" y1="35" x2="40" y2="65" stroke="black" stroke-width="2"/><line x1="60" y1="35" x2="60" y2="65" stroke="black" stroke-width="2"/></svg>',
    schalter: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="none"/><line x1="50" y1="50" x2="70" y2="30" stroke="black" stroke-width="2"/></svg>',
    wechsel: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="none"/><line x1="45" y1="45" x2="70" y2="30" stroke="black" stroke-width="2"/><line x1="55" y1="55" x2="30" y2="70" stroke="black" stroke-width="2"/></svg>',
    kreuz: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="none"/><line x1="30" y1="30" x2="70" y2="70" stroke="black" stroke-width="2"/><line x1="70" y1="30" x2="30" y2="70" stroke="black" stroke-width="2"/></svg>',
    datendose: '<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" stroke="black" stroke-width="2" fill="none"/><line x1="30" y1="70" x2="70" y2="30" stroke="black" stroke-width="2"/></svg>',
    rauchmelder: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" stroke="black" stroke-width="2" fill="none"/><circle cx="50" cy="50" r="6" fill="black"/></svg>',
    bewegungsmelder: '<svg viewBox="0 0 100 100"><path d="M25 50 A25 25 0 0 1 75 50" stroke="black" stroke-width="2" fill="none"/><line x1="50" y1="50" x2="50" y2="80" stroke="black" stroke-width="2"/></svg>',
    lampe: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="5" fill="black"/><line x1="50" y1="10" x2="50" y2="90" stroke="black" stroke-width="2"/><line x1="10" y1="50" x2="90" y2="50" stroke="black" stroke-width="2"/></svg>',
    motor_jalousie: '<svg viewBox="0 0 100 100"><rect x="20" y="25" width="60" height="50" stroke="black" stroke-width="2" fill="none"/><line x1="30" y1="40" x2="70" y2="40" stroke="black" stroke-width="2"/><line x1="30" y1="50" x2="70" y2="50" stroke="black" stroke-width="2"/><line x1="30" y1="60" x2="70" y2="60" stroke="black" stroke-width="2"/></svg>',
  };

  const iconAliases = {
    data: 'datendose',
    datendose: 'datendose',
    decke: 'lampe',
    licht: 'lampe',
    leuchte: 'lampe',
    spot: 'lampe',
    steckdose_double: 'steckdose',
    'motor jalousie': 'motor_jalousie',
    motor_jalousie: 'motor_jalousie',
  };

  const NON_SNAPPING_TYPES = new Set(['rauchmelder', 'lampe', 'decke', 'licht', 'leuchte', 'spot', 'bewegungsmelder', 'motor jalousie', 'motor_jalousie']);
  const svgImageCache = new Map();

  const EXTRA_SYMBOL_TOOLS = [
    { id: 'sy-rauchmelder', tool: 'rauchmelder' },
    { id: 'sy-bewegungsmelder', tool: 'bewegungsmelder' },
    { id: 'sy-lampe', tool: 'lampe' },
    { id: 'sy-motor_jalousie', tool: 'motor_jalousie' },
  ];

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
  let lengthDialogState = null;
  const activePointers = new Map();
  let pinchState = null;

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
        rotationOffset: item.rotationOffset || 0,
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
      rotation: item.rotation || 0,
      flip: item.flip || 1,
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

  function quantizeQuarterTurn(angle) {
    return Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  }

  function planCentroid() {
    const points = [];
    for (const wall of project.walls) {
      points.push({ x: wall.ax, y: wall.ay }, { x: wall.bx, y: wall.by });
    }
    if (!points.length) return { x: 0, y: 0 };
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }

  function inferInteriorSide(wall) {
    const g = wallGeom(wall);
    const center = { x: (wall.ax + wall.bx) / 2, y: (wall.ay + wall.by) / 2 };
    const centroid = planCentroid();
    const positive = { x: center.x + g.nx * ELEMENT_OFFSET, y: center.y + g.ny * ELEMENT_OFFSET };
    const negative = { x: center.x - g.nx * ELEMENT_OFFSET, y: center.y - g.ny * ELEMENT_OFFSET };
    const positiveDist = Math.hypot(positive.x - centroid.x, positive.y - centroid.y);
    const negativeDist = Math.hypot(negative.x - centroid.x, negative.y - centroid.y);
    return positiveDist <= negativeDist ? 1 : -1;
  }

  function autoRotationForWall(wall, side, rotationOffset = 0) {
    const g = wallGeom(wall);
    const angle = quantizeQuarterTurn(Math.atan2(g.ny * side, g.nx * side));
    return angle + rotationOffset * (Math.PI / 2);
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
    element.rot = autoRotationForWall(wall, element.wallSide, element.rotationOffset || 0);
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

  function wallLength(wall) {
    return Math.hypot(wall.bx - wall.ax, wall.by - wall.ay);
  }

  function setWallLength(wall, lengthMeters) {
    const g = wallGeom(wall);
    wall.bx = wall.ax + g.ux * lengthMeters;
    wall.by = wall.ay + g.uy * lengthMeters;
  }

  function screenThresholdToWorld(px) {
    return px / (project.scale * view.zoom);
  }

  function existingEndpoints(excludeWallId = null, excludeHandle = null) {
    const points = [];
    for (const wall of project.walls) {
      if (!(wall.id === excludeWallId && excludeHandle === 'a')) points.push({ wallId: wall.id, key: 'a', x: wall.ax, y: wall.ay });
      if (!(wall.id === excludeWallId && excludeHandle === 'b')) points.push({ wallId: wall.id, key: 'b', x: wall.bx, y: wall.by });
    }
    return points;
  }

  function snapToExistingNode(point, excludeWallId = null, excludeHandle = null) {
    const threshold = screenThresholdToWorld(10);
    let best = null;
    for (const node of existingEndpoints(excludeWallId, excludeHandle)) {
      const dist = Math.hypot(point.x - node.x, point.y - node.y);
      if (dist <= threshold && (!best || dist < best.dist)) best = { ...node, dist };
    }
    return best ? { x: best.x, y: best.y, node: best } : point;
  }

  function buildTopology() {
    const threshold = screenThresholdToWorld(10);
    const endpoints = [];
    for (const wall of project.walls) {
      endpoints.push({ wallId: wall.id, key: 'a', x: wall.ax, y: wall.ay });
      endpoints.push({ wallId: wall.id, key: 'b', x: wall.bx, y: wall.by });
    }
    const clusters = [];
    for (const point of endpoints) {
      let cluster = clusters.find((item) => Math.hypot(item.x - point.x, item.y - point.y) <= threshold);
      if (!cluster) {
        cluster = { id: 'node-' + clusters.length, x: point.x, y: point.y, points: [] };
        clusters.push(cluster);
      }
      cluster.points.push(point);
      cluster.x = cluster.points.reduce((sum, item) => sum + item.x, 0) / cluster.points.length;
      cluster.y = cluster.points.reduce((sum, item) => sum + item.y, 0) / cluster.points.length;
    }
    const pointMap = new Map();
    clusters.forEach((cluster) => cluster.points.forEach((point) => pointMap.set(point.wallId + ':' + point.key, cluster.id)));
    const adjacency = new Map();
    clusters.forEach((cluster) => adjacency.set(cluster.id, new Set()));
    project.walls.forEach((wall) => {
      const a = pointMap.get(wall.id + ':a');
      const b = pointMap.get(wall.id + ':b');
      if (!a || !b) return;
      adjacency.get(a).add(b);
      adjacency.get(b).add(a);
    });
    const isEdgeInCycle = (start, end) => {
      const queue = [start];
      const seen = new Set([start]);
      while (queue.length) {
        const node = queue.shift();
        for (const next of adjacency.get(node) || []) {
          if ((node === start && next === end) || (node === end && next === start)) continue;
          if (next === end) return true;
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      return false;
    };
    const cycleWalls = new Set();
    project.walls.forEach((wall) => {
      const a = pointMap.get(wall.id + ':a');
      const b = pointMap.get(wall.id + ':b');
      if (a && b && a !== b && isEdgeInCycle(a, b)) cycleWalls.add(wall.id);
    });
    return { clusters, pointMap, cycleWalls };
  }

  function showWallLengthDialog(wallId) {
    const wall = project.walls.find((item) => item.id === wallId);
    if (!wall) return;
    lengthDialogState = { wallId };
    document.getElementById('dlent').textContent = 'Wandlänge';
    document.getElementById('dleni').value = wallLength(wall).toFixed(2);
    showDialog('dlen');
  }

  function pointerCenter(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function screenDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function zoomAt(screenX, screenY, factor) {
    const before = screenToWorld(screenX, screenY);
    view.zoom = clamp(view.zoom * factor, 0.35, 4);
    const after = worldToScreen(before.x, before.y);
    view.x += screenX - after.x;
    view.y += screenY - after.y;
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
    const topology = buildTopology();
    for (const wall of project.walls) {
      const a = worldToScreen(wall.ax, wall.ay);
      const b = worldToScreen(wall.bx, wall.by);
      const lengthMeters = wallLength(wall);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      ctx.save();
      ctx.strokeStyle = wall.color;
      ctx.lineCap = 'round';
      const widthFactor = topology.cycleWalls.has(wall.id) ? 1.75 : 1;
      ctx.lineWidth = Math.max(4, wall.thick * project.scale * view.zoom * widthFactor);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 1.5;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `${lengthMeters.toFixed(2)} m`;
      const metrics = ctx.measureText(label);
      ctx.beginPath();
      ctx.roundRect(midX - metrics.width / 2 - 6, midY - 10, metrics.width + 12, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#E5E7EB';
      ctx.fillText(label, midX, midY + 0.5);
      ctx.restore();
    }
    for (const cluster of topology.clusters) {
      const p = worldToScreen(cluster.x, cluster.y);
      const isClosed = cluster.points.length > 1;
      ctx.save();
      ctx.fillStyle = isClosed ? '#22C55E' : '#EF4444';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
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
    const baseAngle = Math.atan2(g.dy, g.dx);
    return {
      g,
      wall,
      angle: baseAngle + ((opening.rotation || 0) * Math.PI / 2),
      flip: opening.flip || 1,
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
        const startAng = pts.angle + (opening.flip < 0 ? Math.PI : 0);
        ctx.strokeStyle = 'rgba(37,99,235,.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pts.center.x, pts.center.y, r, startAng, startAng + (Math.PI / 2) * opening.flip);
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
    const iconKey = iconAliases[type] || type;
    const svg = icons[iconKey];
    if (!svg) return;
    let cached = svgImageCache.get(iconKey);
    if (!cached) {
      const viewBoxMatch = svg.match(/viewBox="([\d.\s-]+)"/);
      const [, , width = '100', height = '100'] = viewBoxMatch ? viewBoxMatch[1].split(/\s+/) : ['0', '0', '100', '100'];
      const image = new Image();
      image.onload = () => renderAll();
      image.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      cached = { image, width: Number(width), height: Number(height) };
      svgImageCache.set(iconKey, cached);
    }
    if (!cached.image.complete) return;
    const base = 28;
    const aspect = cached.width / cached.height;
    const drawW = aspect >= 1 ? base : base * aspect;
    const drawH = aspect >= 1 ? base / aspect : base;
    target.drawImage(cached.image, -drawW / 2, -drawH / 2, drawW, drawH);
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
    if (NON_SNAPPING_TYPES.has(element.type)) {
      element.attachedWallId = null;
      element.x = point.x;
      element.y = point.y;
      return;
    }
    const nearest = nearestWall(point);
    if (!nearest || nearest.distPx >= WALL_SNAP_PX) {
      element.attachedWallId = null;
      element.x = point.x;
      element.y = point.y;
      return;
    }
    element.attachedWallId = nearest.wall.id;
    element.wallOffset = nearest.hit.t;
    element.wallSide = inferInteriorSide(nearest.wall);
    element.wallDistance = ELEMENT_OFFSET;
    syncElementAttachment(element);
  }

  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
  }

  function cachePointer(event) {
    const rect = canvas.getBoundingClientRect();
    activePointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top, type: event.pointerType });
  }

  function removePointer(event) {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchState = null;
  }

  function maybeStartPinch() {
    if (activePointers.size !== 2) return false;
    const [a, b] = [...activePointers.values()];
    pinchState = {
      distance: screenDistance(a, b),
      center: pointerCenter(a, b),
      viewX: view.x,
      viewY: view.y,
      zoom: view.zoom,
    };
    drag = null;
    return true;
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
    cachePointer(event);
    if (maybeStartPinch()) return;
    if (event.button === 2) return;
    canvas.setPointerCapture(event.pointerId);
    const point = currentTool === 'wall'
      ? snapToExistingNode(snapPoint(pointerPos(event), true))
      : snapPoint(pointerPos(event), currentTool !== 'pan');
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
        const next = snapToExistingNode(snapPoint(pointerPos(event), true));
        if (Math.hypot(next.x - draftWall.ax, next.y - draftWall.ay) >= 0.1) {
          snapshot();
          const wall = {
            id: uid('wall'),
            ax: draftWall.ax,
            ay: draftWall.ay,
            bx: next.x,
            by: next.y,
            thick: wallStyle.thick,
            color: wallStyle.color,
          };
          project.walls.push(wall);
          selected = { type: 'wall', id: wall.id };
          draftWall = null;
          syncAllAttachments();
          renderAll();
          setStatus('Wand erstellt', '#22C55E');
          showWallLengthDialog(wall.id);
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
          rotation: 0,
          flip: 1,
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
        rotationOffset: 0,
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
    cachePointer(event);
    if (activePointers.size === 2 && pinchState) {
      const [a, b] = [...activePointers.values()];
      const center = pointerCenter(a, b);
      const dist = Math.max(1, screenDistance(a, b));
      view.zoom = pinchState.zoom;
      view.x = pinchState.viewX;
      view.y = pinchState.viewY;
      zoomAt(pinchState.center.x, pinchState.center.y, dist / Math.max(1, pinchState.distance));
      view.x += center.x - pinchState.center.x;
      view.y += center.y - pinchState.center.y;
      renderAll();
      return;
    }
    const rawPoint = pointerPos(event);
    const point = snapPoint(rawPoint, currentTool !== 'pan');
    if (draftWall) {
      const snapped = snapToExistingNode(point);
      draftWall.bx = snapped.x;
      draftWall.by = snapped.y;
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
      const snapped = snapToExistingNode(point, drag.wallId, drag.handle);
      if (drag.handle === 'a') {
        wall.ax = snapped.x;
        wall.ay = snapped.y;
      } else {
        wall.bx = snapped.x;
        wall.by = snapped.y;
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

  function onPointerEnd(event) {
    removePointer(event);
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
    if (selected.type === 'wall') {
      const len = document.createElement('button');
      len.className = 'ci';
      len.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/><path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/></svg>Länge bearbeiten';
      len.onclick = () => {
        closeContext();
        showWallLengthDialog(selected.id);
      };
      menu.appendChild(len);
    }
    menu.appendChild(del);
    if (selected.type === 'element') {
      const rot = document.createElement('button');
      rot.className = 'ci';
      rot.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/></svg>Drehen';
      rot.onclick = () => {
        rotateSelection();
        closeContext();
      };
      menu.appendChild(rot);
    }
    if (selected.type === 'opening') {
      const rotOpen = document.createElement('button');
      rotOpen.className = 'ci';
      rotOpen.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/></svg>90° drehen';
      rotOpen.onclick = () => {
        rotateSelection();
        closeContext();
      };
      menu.appendChild(rotOpen);

      const flipOpen = document.createElement('button');
      flipOpen.className = 'ci';
      flipOpen.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10v10"/><path d="M17 7L7 17"/></svg>Öffnung spiegeln';
      flipOpen.onclick = () => {
        const opening = project.openings.find((item) => item.id === selected.id);
        if (!opening) return;
        snapshot();
        opening.flip = (opening.flip || 1) * -1;
        renderAll();
        closeContext();
      };
      menu.appendChild(flipOpen);
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

  function rotateSelection() {
    if (!selected) return;
    snapshot();
    if (selected.type === 'element') {
      const element = project.elements.find((item) => item.id === selected.id);
      if (!element) return;
      if (element.attachedWallId) {
        element.rotationOffset = ((element.rotationOffset || 0) + 1) % 4;
        syncElementAttachment(element);
      } else {
        element.rot += Math.PI / 2;
      }
      renderAll();
      return;
    }
    if (selected.type === 'opening') {
      const opening = project.openings.find((item) => item.id === selected.id);
      if (!opening) return;
      opening.rotation = ((opening.rotation || 0) + 1) % 4;
      renderAll();
    }
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
    EXTRA_SYMBOL_TOOLS.forEach((item) => {
      if (document.getElementById(item.id)) return;
      const btn = document.createElement('button');
      const meta = SYMBOL_META[item.tool];
      const raw = icons[iconAliases[item.tool] || item.tool];
      const svg = raw.replaceAll('stroke="black"', 'stroke="currentColor"').replaceAll('fill="black"', 'fill="currentColor"');
      btn.className = 'tb';
      btn.id = item.id;
      btn.innerHTML = `${svg}${meta.label}`;
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
      const iconKey = iconAliases[type] || type;
      const raw = icons[iconKey];
      const svg = raw
        ? raw.replaceAll('stroke="black"', 'stroke="currentColor"').replaceAll('fill="black"', 'fill="currentColor"')
        : svgMarkup(type, meta.color);
      button.innerHTML = `${svg}${meta.label}`;
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
  window.okLen = function okLen() {
    const value = Number(document.getElementById('dleni').value);
    hideDialog('dlen');
    if (!lengthDialogState || !Number.isFinite(value) || value <= 0) return;
    const wall = project.walls.find((item) => item.id === lengthDialogState.wallId);
    lengthDialogState = null;
    if (!wall) return;
    snapshot();
    setWallLength(wall, value);
    syncAllAttachments();
    renderAll();
  };

  document.getElementById('dconfok').onclick = () => {
    hideDialog('dconf');
    if (typeof dialogAction === 'function') dialogAction();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('contextmenu', showContext);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomAt(event.offsetX, event.offsetY, event.deltaY < 0 ? 1.1 : 0.9);
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
    if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'r') {
      if (activeDialog) return;
      event.preventDefault();
      rotateSelection();
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
