"use client";

import { useEffect, useRef } from "react";

export function AmbientBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!ref.current || initialized.current) return;
    initialized.current = true;
    const container = ref.current;

    import("three").then((THREE) => {
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0xfafafa, 0.0025);

      let w = window.innerWidth;
      let h = window.innerHeight;

      const camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 1000);
      camera.position.z = 25;
      camera.position.y = 2;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xfafafa, 0);
      container.appendChild(renderer.domElement);

      // Torus knot
      const geo = new THREE.TorusKnotGeometry(10, 2, 120, 16);
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0x888888,
        emissive: 0x000000,
        roughness: 0.2,
        metalness: 0.1,
        wireframe: true,
        transparent: true,
        opacity: 0.06,
      });
      const knot = new THREE.Mesh(geo, mat);
      scene.add(knot);

      // Sparks
      const sparkCount = 60;
      const sparkGeo = new THREE.CircleGeometry(0.12, 4);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xa3a3a3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
        depthTest: false,
      });
      const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
      knot.add(sparks);

      const dummy = new THREE.Object3D();
      const radial = 16;
      const tubular = 120;
      const stride = radial + 1;
      const sparkData = Array.from({ length: sparkCount }, () => ({
        speed: 0.0003 + Math.random() * 0.0008,
        progress: Math.random(),
        pathIndex: Math.floor(Math.random() * radial),
      }));

      const pos = geo.attributes.position;
      const v1 = new THREE.Vector3();
      const v2 = new THREE.Vector3();

      function updateSparks() {
        sparkData.forEach((s, i) => {
          s.progress += s.speed;
          if (s.progress >= 1) s.progress = 0;
          const exact = s.progress * tubular;
          const u = Math.floor(exact);
          const next = (u + 1) % tubular;
          const idx1 = (u * stride + s.pathIndex) * 3;
          const idx2 = (next * stride + s.pathIndex) * 3;
          v1.fromArray(pos.array as Float32Array, idx1);
          v2.fromArray(pos.array as Float32Array, idx2);
          v1.lerp(v2, exact - u);
          dummy.position.copy(v1);
          dummy.lookAt(v2);
          dummy.updateMatrix();
          sparks.setMatrixAt(i, dummy.matrix);
        });
        sparks.instanceMatrix.needsUpdate = true;
      }

      scene.add(new THREE.AmbientLight(0xffffff, 1));

      let mx = 0, my = 0;
      const hw = window.innerWidth / 2;
      const hh = window.innerHeight / 2;
      const onMouse = (e: MouseEvent) => {
        mx = (e.clientX - hw) * 0.0002;
        my = (e.clientY - hh) * 0.0002;
      };
      document.addEventListener("mousemove", onMouse);

      let raf: number;
      const animate = () => {
        raf = requestAnimationFrame(animate);
        knot.rotation.y += 0.03 * (mx * 0.5 - knot.rotation.y) + 0.0008;
        knot.rotation.x += 0.03 * (my * 0.5 - knot.rotation.x) + 0.0004;
        updateSparks();
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        w = window.innerWidth;
        h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("mousemove", onMouse);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
      };
    });
  }, []);

  return <div ref={ref} id="canvas-container" />;
}
