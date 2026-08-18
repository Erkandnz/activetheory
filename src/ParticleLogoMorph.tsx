import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ---------------------------------------------------------------------------
// Bu bileşen, orijinal Active Theory paketinden (app.js) TAMAMEN BAĞIMSIZ,
// sıfırdan yazılmış bir "parçacıklar harfe dönüşüyor" efektidir.
// Orijinal sitenin `logo_animation/A_logo_base.bin` dosyası ve ona bağlı
// animasyon JSON'ları telifli/eksik olduğu için buraya dahil edilmedi;
// bunun yerine kendi "E" logonuzu (public/assets/geometry/logo_animation/
// A_logo_base.bin) hedef şekil olarak kullanır.
//
// AYAR NOKTALARI (kendi "work" bölümünüzün gerçek konumuna göre düzenleyin):
//   TRIGGER_START / TRIGGER_END — sayfanın yüzde kaçında efektin
//   başlayıp bittiğini belirler (0 = sayfa başı, 1 = sayfa sonu).
// ---------------------------------------------------------------------------

const ASSET_URL = '/assets/geometry/logo_animation/A_logo_base.bin';
const DRACO_DECODER_PATH = '/assets/js/lib/draco_three/';

const PARTICLE_COUNT = 4000;
const SCATTER_RADIUS = 3.2;

// Efektin sayfa scroll'unun hangi yüzdesinde başlayıp biteceği.
// "work" bölümünüz DOM'da ayrı bir eleman olarak bulunabiliyorsa,
// bunun yerine o elemente bir IntersectionObserver bağlamak daha sağlıklı olur.
const TRIGGER_START = 0.45;
const TRIGGER_END = 0.7;

function parseCustomBin(buffer: ArrayBuffer): ArrayBuffer {
  // Bu projedeki .bin dosyaları düz Draco değil; başında küçük bir
  // metin header'ı var: "<uzunluk>\0\0\0\0\0\0\0\0{json...}" ardından "DRACO...".
  // DRACOLoader'a vermeden önce bu header'ı atlamamız gerekiyor.
  const bytes = new Uint8Array(buffer);
  const marker = [0x44, 0x52, 0x41, 0x43, 0x4f]; // "DRACO"
  outer: for (let i = 0; i < bytes.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) continue outer;
    }
    return buffer.slice(i);
  }
  throw new Error('DRACO işareti bulunamadı, dosya formatı beklenenden farklı.');
}

function sampleSurfacePoints(geometry: THREE.BufferGeometry, count: number): Float32Array {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const index = geometry.getIndex();

  const triCount = index ? index.count / 3 : posAttr.count / 3;
  const getIdx = (t: number, k: number) =>
    index ? index.getX(t * 3 + k) : t * 3 + k;

  const areas = new Float32Array(triCount);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let totalArea = 0;

  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(posAttr, getIdx(t, 0));
    b.fromBufferAttribute(posAttr, getIdx(t, 1));
    c.fromBufferAttribute(posAttr, getIdx(t, 2));
    const area = new THREE.Triangle(a, b, c).getArea();
    areas[t] = area;
    totalArea += area;
  }

  // Kümülatif alan tablosu -> alanla orantılı rastgele üçgen seçimi
  const cumulative = new Float32Array(triCount);
  let running = 0;
  for (let t = 0; t < triCount; t++) {
    running += areas[t];
    cumulative[t] = running / totalArea;
  }

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let lo = 0;
    let hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const t = lo;

    a.fromBufferAttribute(posAttr, getIdx(t, 0));
    b.fromBufferAttribute(posAttr, getIdx(t, 1));
    c.fromBufferAttribute(posAttr, getIdx(t, 2));

    // rastgele barycentric örnekleme
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;

    out[i * 3 + 0] = a.x * w + b.x * u + c.x * v;
    out[i * 3 + 1] = a.y * w + b.y * u + c.y * v;
    out[i * 3 + 2] = a.z * w + b.z * u + c.z * v;
  }

  return out;
}

function makeScatterPositions(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // küre içinde rastgele nokta
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ).normalize();
    const r = radius * Math.cbrt(Math.random());
    out[i * 3 + 0] = dir.x * r;
    out[i * 3 + 1] = dir.y * r;
    out[i * 3 + 2] = dir.z * r;
  }
  return out;
}

function getScrollProgress(): number {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / scrollable));
}

export default function ParticleLogoMorph() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let rafId = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const scatterPositions = makeScatterPositions(PARTICLE_COUNT, SCATTER_RADIUS);
    let targetPositions: Float32Array = Float32Array.from(scatterPositions);
    const currentPositions: Float32Array = Float32Array.from(scatterPositions);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.028,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // --- Draco varlığını yükle ---
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);

    fetch(ASSET_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Asset yüklenemedi: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const dracoBuffer = parseCustomBin(buffer);
        return new Promise<THREE.BufferGeometry>((resolve, reject) => {
          dracoLoader.parse(dracoBuffer, (geo: THREE.BufferGeometry) => resolve(geo), reject);
        });
      })
      .then((logoGeometry) => {
        if (disposed) return;
        // "E" harfini merkeze al ve efekt sahnesine uygun boyuta getir
        logoGeometry.computeBoundingBox();
        const box = logoGeometry.boundingBox!;
        const center = new THREE.Vector3();
        box.getCenter(center);
        logoGeometry.translate(-center.x, -center.y, -center.z);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 3.4 / maxDim;
        logoGeometry.scale(scale, scale, scale);

        targetPositions = sampleSurfacePoints(logoGeometry, PARTICLE_COUNT);
        logoGeometry.dispose();
      })
      .catch((err) => {
        console.error('[ParticleLogoMorph] logo yüklenemedi:', err);
      });

    let progress = 0;
    let targetProgress = 0;

    const handleScroll = () => {
      const p = getScrollProgress();
      const t = THREE.MathUtils.clamp(
        (p - TRIGGER_START) / (TRIGGER_END - TRIGGER_START),
        0,
        1,
      );
      targetProgress = t;
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleScroll();

    const clock = new THREE.Clock();

    const animate = () => {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);

      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // yumuşak geçiş (ease)
      progress += (targetProgress - progress) * Math.min(1, dt * 3);

      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        // parçacık başına hafif faz farkı -> daha organik toplanma
        const phase = (i % 97) / 97;
        const localT = THREE.MathUtils.clamp(
          (progress - phase * 0.15) / (1 - 0.15),
          0,
          1,
        );
        const eased = localT * localT * (3 - 2 * localT); // smoothstep

        const sx = scatterPositions[ix + 0];
        const sy = scatterPositions[ix + 1];
        const sz = scatterPositions[ix + 2];
        const tx = targetPositions[ix + 0];
        const ty = targetPositions[ix + 1];
        const tz = targetPositions[ix + 2];

        // hafif dönen kaotik hareket, progress arttıkça sönümlenir
        const swirl = (1 - eased) * 0.6;
        const nx = Math.sin(elapsed * 0.6 + i) * swirl;
        const ny = Math.cos(elapsed * 0.5 + i * 1.3) * swirl;

        arr[ix + 0] = sx + (tx - sx) * eased + nx;
        arr[ix + 1] = sy + (ty - sy) * eased + ny;
        arr[ix + 2] = sz + (tz - sz) * eased;
      }
      posAttr.needsUpdate = true;

      points.rotation.y = (1 - progress) * 0.4 + elapsed * 0.02;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      dracoLoader.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5,
        pointerEvents: 'none',
      }}
    />
  );
}
