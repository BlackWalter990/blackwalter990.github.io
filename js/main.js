// Wait for the entire HTML document to be loaded and parsed before running any script.
document.addEventListener('DOMContentLoaded', () => {

    // --- Component Loader: HTML-first, safe, in-order ---
    const loadComponents = async () => {
      const mainContainer = document.getElementById('main-content');
      if (!mainContainer) return;
  
      // fixed order to preserve layout/animations
      const names = ['hero','about','projects','skills','contact','footer'];
      const version = Date.now(); // cache-bust so edits show immediately
  
      try {
        const htmls = await Promise.all(
          names.map(async (n) => {
            const url = `components/${n}.html?v=${version}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
            return res.text();
          })
        );
  
        // Inject once after all files are ready to avoid half-render flicker
        mainContainer.innerHTML = htmls.join('');
        console.info('[components] rendered from HTML:', names.map(n => `components/${n}.html`));
  
      } catch (err) {
        console.error('[components] HTML load failed:', err);
        mainContainer.innerHTML = `
          <p style="color:red; text-align:center; padding: 2rem;">
            Failed to load components from <code>components/</code>.<br>
            Please run via a local server (not <code>file://</code>) and check file paths.
          </p>`;
      }
    };
  
    // --- Animation & Interaction Logic ---
    const initializePortfolioScripts = () => {
      // Loader
      setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');
      }, 2000);
  
      // Custom Cursor
      const cursor = document.getElementById('cursor');
      const cursorDot = document.getElementById('cursorDot');
      let mouseX = 0, mouseY = 0;
      let cursorX = 0, cursorY = 0;
  
      window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
      });
  
      function animateCursor() {
        if (cursor && cursorDot) {
          cursorX += (mouseX - cursorX) * 0.15;
          cursorY += (mouseY - cursorY) * 0.15;
          cursor.style.left = cursorX + 'px';
          cursor.style.top = cursorY + 'px';
          cursorDot.style.left = mouseX + 'px';
          cursorDot.style.top = mouseY + 'px';
        }
        requestAnimationFrame(animateCursor);
      }
      animateCursor();
  
      const hoverElements = document.querySelectorAll('a, button, .project-image, .stat-card, .skill-card, .contact-icon');
      hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursor && cursor.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursor && cursor.classList.remove('hover'));
      });
  
      // Navigation Scroll Effect
      const nav = document.getElementById('nav');
      window.addEventListener('scroll', () => {
        if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
      });
  
      // Intersection Observer for Scroll Animations
      const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -100px 0px' };
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, observerOptions);
      document.querySelectorAll('.section-header, .about-content, .about-stats, .project-item, .skill-card, .contact-title, .contact-description, .contact-links')
        .forEach(el => observer.observe(el));
  
      // --- WebGL background mounts on #heroBg if present ---
      if (typeof THREE !== 'undefined') {
        const heroBg = document.getElementById('heroBg');
        if (heroBg) {
          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1600);
          const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(window.innerWidth, window.innerHeight);
          heroBg.appendChild(renderer.domElement);
  
          const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
          const nodeColor = new THREE.Color(cssVar('--muted') || '#A8B0BD');
          const lineColor = new THREE.Color(cssVar('--border') || '#1a2030');
  
          function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
          const rand = mulberry32(0xA11CE);
  
          const nodeCount = 120; const radius = 280; const minSep = 18;
          const nodes = [];
          function randInSphere(){let x,y,z,s; do{ x=rand()*2-1; y=rand()*2-1; z=rand()*2-1; s=x*x+y*y+z*z; } while (s===0 || s>1);
            const len=Math.sqrt(s); return new THREE.Vector3(x/len,y/len,z/len).multiplyScalar(radius*(0.4+0.6*rand()));}
          function tooClose(p){ for(let i=0;i<nodes.length;i++){ if(p.distanceTo(nodes[i].position) < minSep) return true; } return false; }
          while(nodes.length<nodeCount){ const p=randInSphere(); if(!tooClose(p)){ nodes.push({ position:p, velocity:new THREE.Vector3((rand()-0.5)*0.08,(rand()-0.5)*0.08,(rand()-0.5)*0.08) }); }}
  
          const k=3, maxEdge=120; const edges=[];
          for(let i=0;i<nodes.length;i++){ const dists=[]; for(let j=0;j<nodes.length;j++) if(i!==j) dists.push([j,nodes[i].position.distanceTo(nodes[j].position)]);
            dists.sort((a,b)=>a[1]-b[1]); let added=0; for(let m=0;m<dists.length && added<k;m++){ const [j,d]=dists[m]; if(d<=maxEdge && i<j){ edges.push([i,j]); added++; } } }
  
          const nodeGeom=new THREE.SphereGeometry(1.05,12,12);
          const nodeMat=new THREE.MeshBasicMaterial({ color: nodeColor, transparent:true, opacity:0.95 });
          const group = new THREE.Group();
          nodes.forEach(n=>{ const mesh=new THREE.Mesh(nodeGeom,nodeMat); mesh.position.copy(n.position); n.mesh=mesh; group.add(mesh); });
          scene.add(group);
  
          const linePositions=new Float32Array(edges.length*2*3);
          const lineGeom=new THREE.BufferGeometry(); lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions,3));
          const lineMat=new THREE.LineBasicMaterial({ color: lineColor, transparent:true, opacity:0.28 });
          const lineMesh=new THREE.LineSegments(lineGeom,lineMat); scene.add(lineMesh);
  
          camera.position.set(0,0,440);
          let targetX=0, targetY=0;
          window.addEventListener('mousemove', e=>{ targetX=(e.clientX/window.innerWidth-0.5)*18; targetY=-(e.clientY/window.innerHeight-0.5)*18; });
  
          let cursorWorld=new THREE.Vector3(); let hasMouse=false;
          window.addEventListener('mousemove', e=>{
            const x=(e.clientX/window.innerWidth)*2-1, y=-(e.clientY/window.innerHeight)*2+1;
            const vec=new THREE.Vector3(x,y,0.5).unproject(camera);
            const dir=vec.sub(camera.position).normalize();
            const dist=(0 - camera.position.z)/dir.z;
            cursorWorld.copy(camera.position).add(dir.multiplyScalar(dist));
            hasMouse=true;
          });
  
          function onResize(){
            camera.aspect=window.innerWidth/window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth,window.innerHeight);
          }
          window.addEventListener('resize', onResize);
  
          const influence=70;
          function tick(){
            camera.position.x += (targetX - camera.position.x) * 0.05;
            camera.position.y += (targetY - camera.position.y) * 0.05;
            camera.lookAt(0,0,0);
  
            for(const n of nodes){
              if(hasMouse){
                const diff=n.position.clone().sub(cursorWorld); const d=diff.length();
                if(d<influence){ const s=(influence-d)/influence; n.velocity.add(diff.normalize().multiplyScalar(0.14*s)); }
              }
              n.position.add(n.velocity);
              const len=n.position.length();
              if(len>radius){ n.position.multiplyScalar(radius/len); n.velocity.reflect(n.position.clone().normalize()).multiplyScalar(0.6); }
              n.velocity.x += (rand()-0.5)*0.004; n.velocity.y += (rand()-0.5)*0.004; n.velocity.z += (rand()-0.5)*0.004;
              n.velocity.clampLength(0.01,0.14);
              n.mesh.position.copy(n.position);
            }
  
            let ptr=0;
            for(let e=0;e<edges.length;e++){
              const [i,j]=edges[e]; const a=nodes[i].position, b=nodes[j].position;
              linePositions[ptr++]=a.x; linePositions[ptr++]=a.y; linePositions[ptr++]=a.z;
              linePositions[ptr++]=b.x; linePositions[ptr++]=b.y; linePositions[ptr++]=b.z;
            }
            lineGeom.attributes.position.needsUpdate=true;
  
            renderer.render(scene,camera);
            requestAnimationFrame(tick);
          }
          tick();
        }
      }
  
      // Typing Animation for Hero Title
      const heroText = document.querySelector('.hero-title .gradient-text');
      if (heroText) {
        const text = heroText.textContent;
        heroText.textContent = '';
        let i = 0;
        function typeWriter() {
          if (i < text.length) {
            heroText.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 80);
          }
        }
        setTimeout(typeWriter, 3000); // Start after loader and fade-in
      }
    };
  
    // Execution Order
    loadComponents().then(initializePortfolioScripts);
  });
