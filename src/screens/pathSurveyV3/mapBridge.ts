/**
 * Script injected into the map page. It adds the survey click handling and draw functions on top of the
 * global map, without changing the map page itself. Objects are kept by id and only rebuilt when their
 * description changes, so selecting one point on a phone does not recreate hundreds of markers.
 * A map click right after pressing an object is ignored, so a press never adds a point as well.
 */
export const SETUP_JS = `(function(){
  if (typeof map === 'undefined' || !window.naver) return;
  window.__surveyMode = true;
  map.setOptions({ minZoom: 10, maxBounds: null });
  function post(m){
    m.src = 'surveyV3';
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
  }
  function esc(t){ return String(t).replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function ll(a, b){ return new naver.maps.LatLng(a, b); }
  var lastHit = 0;
  function hit(){ lastHit = Date.now(); }

  if (window.__surveyV3Click) naver.maps.Event.removeListener(window.__surveyV3Click);
  window.__surveyV3Click = naver.maps.Event.addListener(map, 'click', function(e){
    if (Date.now() - lastHit < 350) return;
    post({ type: 'tap', lat: e.coord.lat(), lng: e.coord.lng() });
  });

  // Labels are hidden when zoomed out, otherwise hundreds of them cover the map.
  var LABEL_ZOOM = 18;
  if (typeof document !== 'undefined' && document.head && !document.getElementById('sv3-style')) {
    var style = document.createElement('style');
    style.id = 'sv3-style';
    style.textContent = '.sv3-far .sv3-label{display:none}';
    document.head.appendChild(style);
  }
  function applyZoom(){
    if (typeof document === 'undefined' || !document.documentElement || !map.getZoom) return;
    document.documentElement.classList.toggle('sv3-far', map.getZoom() < LABEL_ZOOM);
  }
  if (window.__surveyV3Zoom) naver.maps.Event.removeListener(window.__surveyV3Zoom);
  window.__surveyV3Zoom = naver.maps.Event.addListener(map, 'zoom_changed', applyZoom);
  applyZoom();

  function shapeSvg(n){
    var s = n.size, w = n.ringWidth, m = w / 2, e = s - m;
    var attrs = 'fill="' + n.fill + '" stroke="' + n.ring + '" stroke-width="' + w + '" stroke-linejoin="round"';
    var body;
    if (n.shape === 'square') body = '<rect x="' + m + '" y="' + m + '" width="' + (s - w) + '" height="' + (s - w) + '" rx="2" ' + attrs + '/>';
    else if (n.shape === 'diamond') body = '<polygon points="' + (s / 2) + ',' + m + ' ' + e + ',' + (s / 2) + ' ' + (s / 2) + ',' + e + ' ' + m + ',' + (s / 2) + '" ' + attrs + '/>';
    else if (n.shape === 'triangle') body = '<polygon points="' + (s / 2) + ',' + m + ' ' + e + ',' + e + ' ' + m + ',' + e + '" ' + attrs + '/>';
    else body = '<circle cx="' + (s / 2) + '" cy="' + (s / 2) + '" r="' + (s / 2 - m) + '" ' + attrs + '/>';
    return '<svg data-shape="' + n.shape + '" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '" style="display:block;filter:drop-shadow(0 0 2px rgba(0,0,0,.45))">' + body + '</svg>';
  }
  function labelHtml(n){
    var parts = '<b>' + esc(n.num) + '</b>';
    if (n.letter) parts += ' <span style="color:' + n.fill + '">' + esc(n.letter) + '</span>';
    if (n.badge) parts += ' <span style="background:#111827;color:#fff;border-radius:3px;padding:0 3px">' + esc(n.badge) + '</span>';
    var cls = n.emphasized ? '' : ' class="sv3-label"';
    return '<span' + cls + ' style="position:absolute;left:29px;top:9px;font:600 11px sans-serif;color:#111827;background:rgba(255,255,255,.92);padding:0 3px;border-radius:4px;white-space:nowrap">' + parts + '</span>';
  }
  // The 34px box is the touch target. The visible shape is centered in it.
  function nodeHtml(n){
    return '<div style="position:relative;transform:translate(-17px,-17px);width:34px;height:34px;display:flex;align-items:center;justify-content:center;opacity:' + (n.dim ? 0.25 : 1) + (n.clickable ? '' : ';pointer-events:none') + '">'
      + shapeSvg(n) + labelHtml(n) + '</div>';
  }

  var current = { edges: [] };
  function snapTarget(n, p){
    var projection = map.getProjection();
    var point = projection.fromCoordToOffset(p);
    var best = null, bestDistance = 12 * 12;
    current.edges.forEach(function(e){
      if (!e.snap || e.a === n.id || e.b === n.id) return;
      var a = projection.fromCoordToOffset(ll(e.p[0], e.p[1]));
      var b = projection.fromCoordToOffset(ll(e.p[2], e.p[3]));
      var dx = b.x - a.x, dy = b.y - a.y;
      var length2 = dx * dx + dy * dy;
      if (!length2) return;
      var t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2;
      if (t <= 0 || t >= 1) return;
      // Do not split right next to an end point.
      if (Math.min(t, 1 - t) * Math.sqrt(length2) < 9) return;
      var x = a.x + t * dx, y = a.y + t * dy;
      var distance = (point.x - x) * (point.x - x) + (point.y - y) * (point.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { id: e.id, coord: projection.fromOffsetToCoord(new naver.maps.Point(x, y)) };
      }
    });
    return best;
  }

  function makeNode(n){
    var mk = new naver.maps.Marker({
      position: ll(n.lat, n.lng), map: map, zIndex: n.emphasized ? 800 : (n.dim ? 500 : 700), title: n.id,
      clickable: n.clickable, draggable: n.draggable, icon: { content: nodeHtml(n) }
    });
    if (n.clickable) naver.maps.Event.addListener(mk, 'click', function(){ hit(); post({ type: 'node', id: n.id }); });
    if (n.draggable) naver.maps.Event.addListener(mk, 'dragend', function(){
      hit();
      var p = mk.getPosition();
      var best = snapTarget(n, p);
      if (best) p = best.coord;
      post({ type: 'move', id: n.id, lat: p.lat(), lng: p.lng(), edgeId: best ? best.id : null });
    });
    return [mk];
  }
  function makeEdge(e){
    var path = [ll(e.p[0], e.p[1]), ll(e.p[2], e.p[3])];
    var list = [new naver.maps.Polyline({ map: map, zIndex: 300, clickable: false, strokeColor: e.color, strokeWeight: e.weight, strokeOpacity: e.opacity, strokeLineCap: 'round', path: path })];
    // Stairs look the same everywhere: dark line with a white dash on top.
    if (e.stairs) list.push(new naver.maps.Polyline({ map: map, zIndex: 301, clickable: false, strokeColor: '#fff', strokeWeight: 2, strokeOpacity: e.opacity, strokeStyle: 'shortdash', path: path }));
    if (e.clickable) {
      var hitLine = new naver.maps.Polyline({ map: map, zIndex: 330, clickable: true, strokeColor: e.color, strokeWeight: 22, strokeOpacity: 0.01, path: path });
      naver.maps.Event.addListener(hitLine, 'click', function(){ hit(); post({ type: 'edge', id: e.id }); });
      list.push(hitLine);
    }
    return list;
  }
  function dotHtml(n){
    return '<div style="transform:translate(-5px,-5px);display:flex;align-items:center;gap:4px;white-space:nowrap"><span style="box-sizing:border-box;flex:none;width:10px;height:10px;border-radius:50%;background:#94A3B8;border:2px solid #fff"></span>'
      + (n.label ? '<span class="sv3-label" style="font:600 10px sans-serif;color:#475569;background:rgba(255,255,255,.85);padding:0 3px;border-radius:3px">' + esc(n.label) + '</span>' : '') + '</div>';
  }
  function makeLegacy(legacy){
    var list = [];
    legacy.lines.forEach(function(l){
      list.push(new naver.maps.Polyline({ map: map, zIndex: 200, clickable: false, strokeColor: '#94A3B8', strokeWeight: 3, strokeOpacity: 0.7, strokeStyle: l[4] ? 'shortdash' : 'solid', path: [ll(l[0], l[1]), ll(l[2], l[3])] }));
    });
    legacy.nodes.forEach(function(n){
      list.push(new naver.maps.Marker({ position: ll(n.lat, n.lng), map: map, zIndex: 400, clickable: false, title: n.id, icon: { content: dotHtml(n) } }));
    });
    return list;
  }

  var objects = window.__surveyV3Objects || {};
  Object.keys(objects).forEach(function(key){ objects[key].list.forEach(function(o){ o.setMap(null); }); });
  objects = window.__surveyV3Objects = {};

  window.__surveyV3Render = function(s){
    current = s;
    var seen = {};
    function sync(key, item, make){
      seen[key] = true;
      var sig = JSON.stringify(item);
      var old = objects[key];
      if (old && old.sig === sig) return;
      if (old) old.list.forEach(function(o){ o.setMap(null); });
      objects[key] = { sig: sig, list: make(item) };
    }
    sync('legacy', s.legacy, makeLegacy);
    s.edges.forEach(function(e){ sync('e:' + e.id, e, makeEdge); });
    s.nodes.forEach(function(n){ sync('n:' + n.id, n, makeNode); });
    Object.keys(objects).forEach(function(key){
      if (seen[key]) return;
      objects[key].list.forEach(function(o){ o.setMap(null); });
      delete objects[key];
    });
  };

  window.__surveyV3Focus = function(lat, lng){
    map.setCenter(ll(lat, lng));
    if (map.getZoom && map.setZoom && map.getZoom() < 18) map.setZoom(18);
  };
})(); true;`
