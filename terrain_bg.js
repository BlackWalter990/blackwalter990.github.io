// terrain_bg.js — full-viewport contour-noise field + theme toggle
(function(){
  if (typeof THREE === 'undefined') return;

  let waveMaterial = null;
  const lightWaveColor = new THREE.Color(0xffa500); // orange
  const darkWaveColor  = new THREE.Color(0x1980ff); // blue

  // Theme state from storage or system preference
  let isDarkMode = localStorage.getItem('color-theme') === 'dark'
    || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);

    const sun = document.getElementById('theme-toggle-sun');
    const moon = document.getElementById('theme-toggle-moon');
    if (sun && moon){
      sun.classList.toggle('hidden', !dark);
      moon.classList.toggle('hidden', dark);
    }

    if (waveMaterial){
      waveMaterial.uniforms.u_isLightMode.value = dark ? 0.0 : 1.0;
      waveMaterial.uniforms.u_waveColor.value = dark ? darkWaveColor : lightWaveColor;
    }
  }

  function ensureToggle(){
    let btn = document.getElementById('theme-toggle');
    if (!btn){
      btn = document.createElement('button');
      btn.id = 'theme-toggle';
      btn.setAttribute('aria-label','Toggle theme');
      btn.style.position = 'fixed';
      btn.style.top = '1rem';
      btn.style.right = '1rem';
      btn.style.zIndex = '10050';
      btn.style.pointerEvents = 'auto';
      btn.innerHTML = `
        <svg id="theme-toggle-sun" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="hidden">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <svg id="theme-toggle-moon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>`;
      document.body.appendChild(btn);
    }
    btn.onclick = function(){
      isDarkMode = !isDarkMode;
      localStorage.setItem('color-theme', isDarkMode ? 'dark' : 'light');
      applyTheme(isDarkMode);
    };
  }

  function ensureCanvas(){
    const existing = document.getElementById('bg-canvas');
    if (existing) return existing;
    const c = document.createElement('canvas');
    c.id = 'bg-canvas';
    document.body.prepend(c);
    return c;
  }

  function initThree(){
    const clock = new THREE.Clock();
    const canvas = ensureCanvas();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_waveColor: { value: isDarkMode ? darkWaveColor : lightWaveColor },
      u_isLightMode: { value: isDarkMode ? 0.0 : 1.0 }
    };

    const waveGeometry = new THREE.PlaneGeometry(2,2);
    waveMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `void main(){ gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform vec3 u_waveColor;
        uniform float u_isLightMode;

        float random(vec3 st){ return fract(sin(dot(st.xyz, vec3(12.9898,78.233,151.7182))) * 43758.5453123); }
        float noise(vec3 st){
          vec3 i = floor(st);
          vec3 f = fract(st);
          vec3 u = f * f * (3.0 - 2.0 * f);
          float a = mix(random(i + vec3(0,0,0)), random(i + vec3(1,0,0)), u.x);
          float b = mix(random(i + vec3(0,1,0)), random(i + vec3(1,1,0)), u.x);
          float c = mix(random(i + vec3(0,0,1)), random(i + vec3(1,0,1)), u.x);
          float d = mix(random(i + vec3(0,1,1)), random(i + vec3(1,1,1)), u.x);
          return mix(mix(a,b,u.y), mix(c,d,u.y), u.z);
        }

        void main(){
          vec2 st = gl_FragCoord.xy / u_resolution.xy;
          st.x *= u_resolution.x / u_resolution.y;

          float dist = distance(st, u_mouse);
          float warp = smoothstep(0.2, 0.0, dist) * 0.5;

          float n = noise(vec3(st * 4.0 + warp, u_time * 0.1));

          float lines = fract(n * 10.0);
          float highlight = smoothstep(0.495, 0.5, lines) - smoothstep(0.5, 0.505, lines);
          lines = smoothstep(0.48, 0.52, lines) - smoothstep(0.52, 0.56, lines);

          vec3 finalColor;
          if (u_isLightMode > 0.5){
            vec3 baseColor = vec3(1.0);
            vec3 lineColor = mix(baseColor, u_waveColor, lines);
            finalColor = mix(lineColor, vec3(1.0), highlight);
          } else {
            finalColor = u_waveColor * lines;
          }
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    const plane = new THREE.Mesh(waveGeometry, waveMaterial);
    scene.add(plane);

    window.addEventListener('mousemove', function(e){
      uniforms.u_mouse.value.x = (e.clientX / window.innerWidth);
      uniforms.u_mouse.value.y = 1.0 - (e.clientY / window.innerHeight);
    });

    window.addEventListener('resize', function(){
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    });

    (function animate(){
      requestAnimationFrame(animate);
      uniforms.u_time.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    })();
  }

  // Boot
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      ensureToggle();
      initThree();
      applyTheme(isDarkMode);
    });
  } else {
    ensureToggle();
    initThree();
    applyTheme(isDarkMode);
  }
})();