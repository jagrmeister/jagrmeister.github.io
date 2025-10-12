/* ABI SVG Globe v3.1 — orthographic projection, routes, free 360° drag, inertia,
   autorotate, + visitor pin API (setVisitorLocation/clearVisitorLocation). */

(function () {
  const svg   = document.getElementById('abiGlobe');
  const rotG  = document.getElementById('rotator');
  const landG = document.getElementById('land');
  const gratG = document.getElementById('graticule');
  const routeG= document.getElementById('routes');
  const nodeG = document.getElementById('nodes');
  if (!svg || !rotG) return;


// Visitor layer (create if missing)
let visitorG = document.getElementById('visitor');
if (!visitorG && rotG) {
  visitorG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  visitorG.setAttribute('id', 'visitor');
  visitorG.setAttribute('class', 'nodes visitor');
  rotG.appendChild(visitorG);
}


  // ---- Projection ----
  const CX = 250, CY = 250, R = 165;

  // View center (deg)
  let lon0 = 0, lat0 = 0;

  // Motion state
  let dragging = false;
  let lastX = 0, lastY = 0;
  let vLon = 0, vLat = 0;

  // Autorotate + timing
  let auto = 0.12;
  let lastT = performance.now();
  let idleUntil = 0;
  const RESUME_DELAY = 1600;
  const MAX_SPEED = 2.4;

// ---- Visitor pin (single pulsing red dot) ----
if (visitorG) {
  let pin = visitorG.querySelector('.visitor-pin');
  if (!pin) {
    pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pin.setAttribute('r', '3.2');
    pin.setAttribute('class', 'visitor-pin');
    visitorG.appendChild(pin);
  }

  if (showVisitor) {
    const p = project(visitorLon, visitorLat);
    if (p) {
      pin.setAttribute('cx', p[0].toFixed(1));
      pin.setAttribute('cy', p[1].toFixed(1));
      pin.style.display = '';
    } else {
      pin.style.display = 'none';
    }
  } else {
    pin.style.display = 'none';
  }
}


  // Utils
  const deg2rad = d => d * Math.PI / 180;
  const rad2deg = r => r * 180 / Math.PI;
  const clamp = (x,a,b) => Math.max(a, Math.min(b, x));

  function project(lon, lat) {
    const lam = deg2rad(lon - lon0);
    const phi = deg2rad(lat);
    const phi0 = deg2rad(lat0);
    const cosc = Math.sin(phi0)*Math.sin(phi) + Math.cos(phi0)*Math.cos(phi)*Math.cos(lam);
    if (cosc < 0) return null; // back side
    const x = R * Math.cos(phi) * Math.sin(lam);
    const y = R * (Math.cos(phi0)*Math.sin(phi) - Math.sin(phi0)*Math.cos(phi)*Math.cos(lam));
    return [CX + x, CY - y];
  }

  // Great-circle helpers
  const sph2cart = ([lam,phi]) => [Math.cos(phi)*Math.cos(lam), Math.cos(phi)*Math.sin(lam), Math.sin(phi)];
  const dot = (a,b)=> a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const normalize = v => { const m=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/m,v[1]/m,v[2]/m]; };

  function arcPath(a, b, k = 80) {
    const aR = [deg2rad(a[0]), deg2rad(a[1])];
    const bR = [deg2rad(b[0]), deg2rad(b[1])];
    const A = sph2cart(aR), B = sph2cart(bR);
    const omega = Math.acos(clamp(dot(A,B), -1, 1));
    if (!isFinite(omega) || omega === 0) return '';
    let d = '';
    for (let i = 0; i <= k; i++) {
      const t = i / k;
      const s1 = Math.sin((1-t)*omega) / Math.sin(omega);
      const s2 = Math.sin(t*omega) / Math.sin(omega);
      const P = normalize([s1*A[0]+s2*B[0], s1*A[1]+s2*B[1], s1*A[2]+s2*B[2]]);
      const lon = rad2deg(Math.atan2(P[1], P[0]));
      const lat = rad2deg(Math.asin(P[2]));
      const p = project(lon, lat);
      if (!p) continue;
      d += (d ? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }
    return d;
  }

  // Demo routes
  const ROUTES = [
    { from: [-74, 40.7], to: [-0.1, 51.5] },
    { from: [-0.1, 51.5], to: [77.2, 28.6] },
    { from: [139.7, 35.7], to: [-122.3, 37.8] },
    { from: [2.35, 48.85], to: [151.2, -33.9] },
    { from: [13.4, 52.5], to: [37.6, 55.7] },
    { from: [-58.4, -34.6], to: [-3.7, 40.4] }
  ];

  // Fallback land rings (simplified)
  const FALLBACK_LAND = [
    [[-168,72],[-140,70],[-125,60],[-100,49],[-95,40],[-105,32],[-117,32],[-123,49],[-135,56],[-150,60],[-160,65],[-168,72]],
    [[-82,12],[-75,5],[-70,-3],[-63,-10],[-64,-20],[-60,-30],[-56,-34],[-54,-45],[-49,-48],[-45,-23],[-50,-10],[-60,-5],[-70,0],[-75,5],[-82,12]],
    [[-10,36],[0,43],[10,46],[20,45],[30,44],[40,44],[50,40],[45,35],[36,32],[27,37],[14,37],[5,36],[-5,36],[-10,36],[-10,20],[-5,10],[0,5],[10,4],[20,0],[25,-10],[20,-20],[10,-25],[0,-25],[-10,-20],[-10,0],[-12,10],[-10,20]],
    [[60,55],[75,55],[90,50],[105,42],[120,40],[130,45],[140,50],[150,55],[160,60],[170,62],[170,50],[160,45],[150,40],[140,35],[130,30],[120,25],[110,20],[100,20],[90,25],[80,30],[70,40],[60,45],[60,55]],
    [[113,-22],[120,-20],[132,-18],[138,-22],[142,-28],[145,-38],[134,-35],[126,-30],[122,-26],[118,-25],[113,-22]]
  ];

  // Graticule
  function buildGraticule() {
    gratG.innerHTML = '';
    for (let lat = -60; lat <= 60; lat += 15) {
      let d = '';
      for (let lon = -180; lon <= 180; lon += 3) {
        const p = project(lon, lat);
        if (!p) continue;
        d += (d ? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      if (d) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', 'url(#gLine)');
        path.setAttribute('fill', 'none');
        gratG.appendChild(path);
      }
    }
    for (let lon = -180; lon <= 180; lon += 15) {
      let d = '';
      for (let lat = -90; lat <= 90; lat += 3) {
        const p = project(lon, lat);
        if (!p) continue;
        d += (d ? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      if (d) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', 'url(#gLine)');
        path.setAttribute('fill', 'none');
        gratG.appendChild(path);
      }
    }
  }

  // Land drawing
  function drawLandRings(rings) {
    landG.innerHTML = '';
    rings.forEach(ring => {
      let d = '';
      for (let i = 0; i < ring.length; i++) {
        const p = project(ring[i][0], ring[i][1]);
        if (!p) continue;
        d += (i === 0 ? 'M ' : ' L ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      if (d) {
        d += ' Z';
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        landG.appendChild(path);
      }
    });
  }

  // Routes + hubs
  function drawRoutes() {
    routeG.innerHTML = '';
    nodeG.innerHTML = '';

    // hubs
    ROUTES.forEach(r => {
      [r.from, r.to].forEach(coord => {
        const p = project(coord[0], coord[1]);
        if (!p) return;
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', p[0].toFixed(1));
        c.setAttribute('cy', p[1].toFixed(1));
        c.setAttribute('r', '2.4');
        c.setAttribute('opacity', '.95');
        nodeG.appendChild(c);
      });
    });

    // arcs
    ROUTES.forEach((r, idx) => {
      const d = arcPath(r.from, r.to, 90);
      if (!d) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#9fbeff');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.85');
      path.setAttribute('stroke-linecap', 'round');
      const len = path.getTotalLength ? path.getTotalLength() : 1200;
      path.setAttribute('stroke-dasharray', '6 ' + (len));
      path.dataset.len = len;
      path.dataset.phase = (idx * 120).toString();
      routeG.appendChild(path);
    });
  }

  let geoRings = null, usingGeo = false;

  function render() {
    gratG.innerHTML = '';
    buildGraticule();

    if (usingGeo && geoRings) drawLandRings(geoRings.raw);
    else drawLandRings(FALLBACK_LAND);

    drawRoutes();

    // ---- Visitor pin (NEW) ----
    if (visitorG) {
      visitorG.innerHTML = '';
      if (showVisitor) {
        const p = project(visitorLon, visitorLat);
        if (p) {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('cx', p[0].toFixed(1));
          c.setAttribute('cy', p[1].toFixed(1));
          c.setAttribute('r', '3.2');
          c.setAttribute('class', 'visitor-pin');
          visitorG.appendChild(c);

          const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          ring.setAttribute('cx', p[0].toFixed(1));
          ring.setAttribute('cy', p[1].toFixed(1));
          ring.setAttribute('r', '3.2');
          ring.setAttribute('class', 'visitor-pulse');
          visitorG.appendChild(ring);
        }
      }
    }
  }

  // Interaction
  function box(){ return svg.getBoundingClientRect(); }
  function kScale(){ return 180 / (box().width || 500); }

  function onDown(e){
    dragging = true;
    svg.style.cursor = 'grabbing';
    const t = e.touches ? e.touches[0] : e;
    lastX = t.clientX; lastY = t.clientY;
    vLon = vLat = 0;
    idleUntil = performance.now() + RESUME_DELAY;
  }
  function onMove(e){
    if(!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - lastX;
    const dy = t.clientY - lastY;
    lastX = t.clientX; lastY = t.clientY;

    const k = (kScale() * Math.max(0.25, Math.cos(deg2rad(lat0)))) || 0.25;
    lon0 -= dx * k;
    lat0 += dy * k;
    lat0 = clamp(lat0, -90, 90);

    vLon = -dx * k;
    vLat =  dy * k;

    idleUntil = performance.now() + RESUME_DELAY;
    render();
  }
  function onUp(){
    dragging = false;
    svg.style.cursor = 'grab';
    idleUntil = performance.now() + RESUME_DELAY;
  }

  svg.addEventListener('mousedown', onDown);
  svg.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  svg.addEventListener('touchstart', onDown, { passive: true });
  svg.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onUp);
  svg.style.cursor = 'grab';

  // Animation loop
  function tick(){
    requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.max(0, now - lastT); lastT = now;

    const decay = Math.exp(-dt * 0.0045);
    const clampSpeed = v => clamp(v, -MAX_SPEED, MAX_SPEED);

    if(!dragging){
      vLon = clampSpeed(vLon) * decay;
      vLat = clampSpeed(vLat) * decay;

      lon0 += vLon;
      lat0 += vLat;
      lat0 = clamp(lat0, -90, 90);

      if(now > idleUntil){
        lon0 += auto * (dt / 16.67);
      }
      render();
    }

    // Route dash animation
    Array.from(routeG.children).forEach(p => {
      const phase = (parseFloat(p.dataset.phase)||0) + 4;
      p.dataset.phase = phase.toString();
      p.setAttribute('stroke-dashoffset', phase.toString());
    });
  }

  // Try to load GeoJSON land (optional)
  async function tryLoadGeo() {
    try {
      const res = await fetch('assets/data/world-geo.json', { cache: 'force-cache' });
      if (!res.ok) throw new Error('no geojson');
      const gj = await res.json();
      const polys = [];
      const features = (gj.type === 'FeatureCollection') ? gj.features : [{ type:'Feature', geometry: gj }];
      features.forEach(feat => {
        const g = feat.geometry; if (!g) return;
        if (g.type === 'Polygon') { if (g.coordinates && g.coordinates[0]) polys.push(g.coordinates[0]); }
        else if (g.type === 'MultiPolygon') { g.coordinates.forEach(coords => { if (coords && coords[0]) polys.push(coords[0]); }); }
      });
      const rings = [];
      const targetPts = 120;
      polys.forEach(r => {
        const step = Math.max(1, Math.floor(r.length / targetPts));
        const ring = [];
        for (let i = 0; i < r.length; i += step) {
          const ll = r[i]; ring.push([+ll[0], +ll[1]]);
        }
        rings.push(ring);
      });
      geoRings = { raw: rings }; usingGeo = true;
    } catch (_) {
      usingGeo = false;
    } finally {
      render(); tick();
    }
  }

  render(); tryLoadGeo();

  // ---- Public API for visitor pin (NEW) ----
  window.abiGlobe = {
    setVisitorLocation(lon, lat){ visitorLon = lon; visitorLat = lat; showVisitor = true; render(); },
    clearVisitorLocation(){ showVisitor = false; render(); }
  };
})();
