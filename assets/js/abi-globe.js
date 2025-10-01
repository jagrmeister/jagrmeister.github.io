/* ABI SVG Globe: orthographic projection with simplified continents + animated great-circle "laser" routes.
   No libraries. CSP-safe. Colors: ABI palette. */

(function(){
  const svg = document.getElementById('abiGlobe');
  const rotG = document.getElementById('rotator');
  const landG = document.getElementById('land');
  const gratG = document.getElementById('graticule');
  const routeG = document.getElementById('routes');
  const nodeG = document.getElementById('nodes');
  if(!svg || !rotG) return;

  // ----- Projection (orthographic) -----
  const CX = 250, CY = 250, R = 165;          // sphere radius (matches circle in HTML)
  let lon0 = 0, lat0 = 0;                      // center of projection (deg)
  let auto = 0.12;                             // deg/frame auto-rotate
  let dragging = false, lastX = 0, vLon = 0;

  function deg2rad(d){ return d * Math.PI/180; }
  function rad2deg(r){ return r * 180/Math.PI; }

  // Orthographic forward projection: lon,lat -> x,y (2D)
  function project(lon,lat){
    const lam = deg2rad(lon - lon0);
    const phi = deg2rad(lat);
    const phi0 = deg2rad(lat0);
    const cosc = Math.sin(phi0)*Math.sin(phi) + Math.cos(phi0)*Math.cos(phi)*Math.cos(lam);
    if(cosc < 0) return null; // back side of globe
    const x = R * Math.cos(phi)*Math.sin(lam);
    const y = R * (Math.cos(phi0)*Math.sin(phi) - Math.sin(phi0)*Math.cos(phi)*Math.cos(lam));
    return [CX + x, CY - y];
  }

  // Great-circle arc between A and B -> path string using many small segments
  function arcPath(a, b, k=60){
    // a=[lon,lat], b=[lon,lat]
    const aR = [deg2rad(a[0]), deg2rad(a[1])];
    const bR = [deg2rad(b[0]), deg2rad(b[1])];
    const A = sph2cart(aR), B = sph2cart(bR);
    const omega = Math.acos(clamp(dot(A,B), -1, 1));
    if(omega === 0) return '';
    let d = '';
    for(let i=0;i<=k;i++){
      const t = i/k;
      const s1 = Math.sin((1-t)*omega)/Math.sin(omega);
      const s2 = Math.sin(t*omega)/Math.sin(omega);
      const P = normalize([
        s1*A[0]+s2*B[0],
        s1*A[1]+s2*B[1],
        s1*A[2]+s2*B[2]
      ]);
      const lon = rad2deg(Math.atan2(P[1], P[0]));
      const lat = rad2deg(Math.asin(P[2]));
      const p = project(lon, lat);
      if(!p) continue;
      d += (d ? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }
    return d;
  }
  function sph2cart([lam,phi]){ return [Math.cos(phi)*Math.cos(lam), Math.cos(phi)*Math.sin(lam), Math.sin(phi)]; }
  function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function normalize(v){ const m=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/m,v[1]/m,v[2]/m]; }
  function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }

  // ----- Minimal land data (very simplified) -----
  // Each polygon is an array of [lon,lat] points. Coarse but recognizable.
  // Regions: Americas, Europe+Africa, Asia, Australia
  const LAND = [
    // North America (very coarse)
    [[-168,72],[-140,70],[-125,60],[-100,49],[-95,40],[-105,32],[-117,32],[-123,49],[-135,56],[-150,60],[-160,65],[-168,72]],
    // South America
    [[-82,12],[-75,5],[-70,-3],[-63,-10],[-64,-20],[-60,-30],[-56,-34],[-54,-45],[-49,-48],[-45,-23],[-50,-10],[-60,-5],[-70,0],[-75,5],[-82,12]],
    // Europe + Africa
    [[-10,36],[0,43],[10,46],[20,45],[30,44],[40,44],[50,40],[45,35],[36,32],[27,37],[14,37],[5,36],[-5,36],[-10,36],
     [-10,20],[-5,10],[0,5],[10,4],[20,0],[25,-10],[20,-20],[10,-25],[0,-25],[-10,-20],[-10,0],[-12,10],[-10,20]],
    // Asia
    [[60,55],[75,55],[90,50],[105,42],[120,40],[130,45],[140,50],[150,55],[160,60],[170,62],[170,50],[160,45],[150,40],[140,35],[130,30],[120,25],[110,20],[100,20],[90,25],[80,30],[70,40],[60,45],[60,55]],
    // Australia
    [[113,-22],[120,-20],[132,-18],[138,-22],[142,-28],[145,-38],[134,-35],[126,-30],[122,-26],[118,-25],[113,-22]]
  ];

  // ----- Routes (lasers) between hubs -----
  const ROUTES = [
    { from:[-74,40.7], to:[-0.1,51.5] },        // NYC -> London
    { from:[-0.1,51.5], to:[77.2,28.6] },       // London -> Delhi
    { from:[139.7,35.7], to:[-122.3,37.8] },    // Tokyo -> SF
    { from:[2.35,48.85], to:[151.2,-33.9] },    // Paris -> Sydney
    { from:[13.4,52.5], to:[37.6,55.7] },       // Berlin -> Moscow
    { from:[-58.4,-34.6], to:[-3.7,40.4] }      // Buenos Aires -> Madrid
  ];

  // ----- Build graticule (lat/long lines) -----
  function buildGraticule(){
    gratG.innerHTML = '';
    // Parallels every 15°
    for(let lat=-60; lat<=60; lat+=15){
      let d = '';
      for(let lon=-180; lon<=180; lon+=3){
        const p = project(lon, lat);
        if(!p) continue;
        d += (d? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'url(#gLine)');
      path.setAttribute('fill','none');
      gratG.appendChild(path);
    }
    // Meridians every 15°
    for(let lon=-180; lon<=180; lon+=15){
      let d = '';
      for(let lat=-90; lat<=90; lat+=3){
        const p = project(lon, lat);
        if(!p) continue;
        d += (d? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'url(#gLine)');
      path.setAttribute('fill','none');
      gratG.appendChild(path);
    }
  }

  // ----- Draw land polygons -----
  function drawLand(){
    landG.innerHTML = '';
    LAND.forEach(poly => {
      let d = '';
      poly.forEach((pt,i) => {
        const p = project(pt[0], pt[1]);
        if(!p){ return; }
        d += (i===0 ? 'M ' : ' L ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      });
      if(d){
        d += ' Z';
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d', d);
        landG.appendChild(path);
      }
    });
  }

  // ----- Draw hubs and animated routes -----
  function drawRoutes(){
    routeG.innerHTML = '';
    nodeG.innerHTML = '';
    // Nodes
    ROUTES.forEach(r => {
      [r.from, r.to].forEach(coord => {
        const p = project(coord[0], coord[1]);
        if(!p) return;
        const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
        c.setAttribute('cx', p[0].toFixed(1));
        c.setAttribute('cy', p[1].toFixed(1));
        c.setAttribute('r', '2.4');
        c.setAttribute('opacity', '.95');
        nodeG.appendChild(c);
      });
    });

    // Arcs with dash animation
    ROUTES.forEach((r, idx) => {
      const d = arcPath(r.from, r.to, 80);
      if(!d) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#9fbeff');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.85');
      path.setAttribute('stroke-linecap','round');

      // animated dash to look like a traveling laser
      const len = path.getTotalLength ? path.getTotalLength() : 1200;
      path.setAttribute('stroke-dasharray', '6 ' + (len));
      // Offset will be animated in tick()
      path.dataset.len = len;
      path.dataset.phase = (idx * 120).toString(); // offset phase per arc
      routeG.appendChild(path);
    });
  }

  // ----- Interaction -----
  function bbox(){ return svg.getBoundingClientRect(); }
  function toDeg(dx){ return dx / (bbox().width || 500) * 180; }

  function onDown(e){ dragging = true; vLon = 0; lastX = (e.touches ? e.touches[0].clientX : e.clientX); }
  function onMove(e){
    if(!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const dx = x - lastX; lastX = x;
    const dLon = toDeg(dx);
    lon0 -= dLon; vLon = dLon;
    render();
  }
  function onUp(){ dragging = false; }

  svg.addEventListener('mousedown', onDown);
  svg.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  svg.addEventListener('touchstart', onDown, {passive:true});
  svg.addEventListener('touchmove', onMove, {passive:true});
  window.addEventListener('touchend', onUp);

  // ----- Render -----
  function render(){
    gratG.innerHTML = '';
    buildGraticule();
    drawLand();
    drawRoutes();
  }

  // Initial draw
  render();

  // ----- Animation loop -----
  function tick(){
    requestAnimationFrame(tick);
    if(!dragging){
      // auto-rotate + inertia decay
      vLon *= 0.96;
      lon0 += (auto - vLon);
      render();
    }
    // advance dash offset for each route to create moving "laser"
    Array.from(routeG.children).forEach(p => {
      const phase = (parseFloat(p.dataset.phase)||0) + 4; // speed
      p.dataset.phase = phase.toString();
      p.setAttribute('stroke-dashoffset', phase.toString());
    });
  }
  tick();
})();
