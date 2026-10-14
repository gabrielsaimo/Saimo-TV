/**
 * A abertura animada: a logo se monta peça por peça (cartão, S, TV, antena,
 * play, letras) a partir das camadas da arte original, e no fim a própria
 * arte assume, então o último quadro é a logo exata. É a mesma animação dos
 * apps (SaimoPlayer/abertura), aqui em SVG para sair nítida em qualquer tela,
 * e no dobro da velocidade: no site ela aparece toda vez que a página inicial
 * abre. Clique ou tecla pula.
 */
import { useEffect, useRef, useState } from 'react';
import './Abertura.css';

const BASE = `${import.meta.env.BASE_URL}abertura/`;
/** Onde cada camada fica na arte de 1024 px. */
const CAMADAS = {
  cartao: [129, 130, 766, 765], final: [129, 130, 766, 765], tv: [312, 289, 402, 275],
  s: [381, 210, 266, 415], play: [470, 372, 103, 113], antena: [393, 201, 69, 77], texto: [230, 625, 564, 246],
} as const;
/** Colunas de cada letra de "Saimo" e "TV" na arte: x0, x1, y0, y1. */
const LETRAS = [[228, 350, 620, 772], [350, 455, 620, 772], [455, 496, 600, 772], [496, 650, 620, 772],
  [650, 800, 620, 772], [600, 681, 772, 875], [681, 800, 772, 875]];
/** A linha do tempo dos apps tem 4,2 s; aqui corre no dobro. */
const DUR = 4.2;
const VELOCIDADE = 2;
const SAIDA_MS = 300;

const cl = (t: number) => Math.min(1, Math.max(0, t));
const fase = (t: number, a: number, b: number) => cl((t - a) / (b - a));
const sai = (t: number) => 1 - Math.pow(1 - t, 3);
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mola = (t: number) => (t === 0 ? 0 : t === 1 ? 1
  : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
const voltaUm = (t: number) => 1 + 2.6 * Math.pow(t - 1, 3) + 1.6 * Math.pow(t - 1, 2);

function Camada({ nome }: { nome: keyof typeof CAMADAS }) {
  const [x, y, w, h] = CAMADAS[nome];
  return <image href={`${BASE}${nome}.webp`} x={x} y={y} width={w} height={h} />;
}

export function Abertura() {
  const [saindo, setSaindo] = useState(false);
  const [fim, setFim] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const luz = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = raiz.current;
    const cv = luz.current;
    if (!el || !cv) return;
    const $ = (id: string) => el.querySelector<SVGGraphicsElement>(`#ab-${id}`)!;
    const caminho = (id: string) => {
      const p = el.querySelector<SVGGeometryElement>(`#ab-${id}`)!;
      const L = p.getTotalLength();
      p.style.strokeDasharray = String(L);
      return [p, L] as const;
    };
    const [pS, LS] = caminho('trilhaS');
    const [pTv, LTv] = caminho('trilhaTv');
    const [pAnt, LAnt] = caminho('trilhaAnt');
    const [pC, LC] = caminho('contorno');
    const [pC2, LC2] = caminho('contornoNitido');
    const letras = LETRAS.map(([x0, x1, y0, y1], i) => ({ g: $(`letra${i}`), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }));

    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = window.innerWidth * dpr;
    cv.height = window.innerHeight * dpr;
    const P = Array.from({ length: 110 }, () => ({
      a: Math.random() * Math.PI * 2, d: 0.55 + Math.random() * 0.6, v: 0.5 + Math.random() * 0.9,
      s: 0.6 + Math.random() * 1.8, h: Math.random() < 0.55 ? '79,243,224' : '163,92,240', atraso: Math.random() * 0.5,
    }));

    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let pedido = 0;
    let encerrado = false;
    const encerrar = () => {
      if (encerrado) return;
      encerrado = true;
      setSaindo(true);
      window.setTimeout(() => setFim(true), SAIDA_MS);
    };

    const quadro = (agora: number) => {
      const t = reduzir ? DUR : ((agora - t0) / 1000) * VELOCIDADE;
      if (ctx) {
        const W = cv.width, H = cv.height, m = Math.min(W, H);
        ctx.clearRect(0, 0, W, H);
        for (const p of P) {
          const k = fase(t, p.atraso, p.atraso + 1.1 / p.v);
          if (k <= 0 || k >= 1) continue;
          const d = p.d * (1 - sai(k)) * m * 0.75, d2 = d + m * 0.05 * (1 - k);
          ctx.strokeStyle = `rgba(${p.h},${(1 - k) * 0.8})`;
          ctx.lineWidth = p.s * dpr;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(W / 2 + Math.cos(p.a) * d2, H / 2 + Math.sin(p.a) * d2);
          ctx.lineTo(W / 2 + Math.cos(p.a) * d, H / 2 + Math.sin(p.a) * d);
          ctx.stroke();
        }
      }
      // cartão
      const kC = suave(fase(t, 0.25, 1.15));
      pC.style.strokeDashoffset = String(LC * (1 - kC));
      pC2.style.strokeDashoffset = String(LC2 * (1 - kC));
      const kF = sai(fase(t, 0.9, 1.4));
      $('cartao').setAttribute('opacity', String(kF));
      $('cartao').setAttribute('transform', `translate(512 512) scale(${0.94 + 0.06 * kF}) translate(-512 -512)`);
      $('halo').setAttribute('opacity', (0.35 * kF + 0.25 * Math.max(0, Math.sin(Math.PI * fase(t, 3.05, 3.9)))).toFixed(3));
      pC.setAttribute('opacity', String(1 - 0.7 * fase(t, 1.2, 1.6)));
      pC2.setAttribute('opacity', String(1 - fase(t, 1.2, 1.6)));
      // S com a faísca na ponta
      const kS = suave(fase(t, 1.2, 2.0));
      pS.style.strokeDashoffset = String(LS * (1 - kS));
      const fa = $('faisca');
      if (kS > 0 && kS < 1) {
        const pt = pS.getPointAtLength(LS * kS);
        fa.setAttribute('cx', String(pt.x)); fa.setAttribute('cy', String(pt.y)); fa.setAttribute('r', '14');
      } else fa.setAttribute('r', '0');
      // TV por trás do S
      pTv.style.strokeDashoffset = String(LTv * (1 - suave(fase(t, 1.6, 2.35))));
      $('telaTv').setAttribute('r', String(260 * sai(fase(t, 2.0, 2.6))));
      // antena e play
      pAnt.style.strokeDashoffset = String(LAnt * (1 - sai(fase(t, 2.25, 2.55))));
      $('bolaAnt').setAttribute('r', String(16 * mola(fase(t, 2.45, 2.95))));
      const kP = fase(t, 2.35, 2.95);
      $('play').setAttribute('opacity', String(cl(kP * 3)));
      $('play').setAttribute('transform', `translate(518 427) rotate(${-25 * (1 - sai(kP))}) scale(${mola(kP)}) translate(-518 -427)`);
      // letras
      letras.forEach((l, i) => {
        const a = i < 5 ? 2.55 + i * 0.09 : 3.0 + (i - 5) * 0.08;
        const k = fase(t, a, a + 0.45);
        l.g.setAttribute('opacity', String(cl(k * 2.2)));
        const y = 46 * (1 - voltaUm(k)), s = i < 5 ? 1 : 0.6 + 0.4 * mola(k);
        l.g.setAttribute('transform', `translate(${l.cx} ${l.cy + y}) scale(${s}) translate(${-l.cx} ${-l.cy})`);
      });
      // reflexo, arte original e onda
      const kR = suave(fase(t, 3.05, 3.65));
      $('faixa').setAttribute('x', String(-400 + 1500 * kR));
      $('faixa').setAttribute('opacity', kR > 0 && kR < 1 ? '0.55' : '0');
      $('final').setAttribute('opacity', String(suave(fase(t, 3.35, 3.8))));
      const kO = fase(t, 3.2, 4.1);
      $('onda').setAttribute('r', String(390 + 140 * sai(kO)));
      $('onda').setAttribute('opacity', kO > 0 && kO < 1 ? String(0.5 * (1 - kO)) : '0');

      if (t >= DUR) {
        window.setTimeout(encerrar, reduzir ? 400 : 120);
        return;
      }
      pedido = requestAnimationFrame(quadro);
    };
    pedido = requestAnimationFrame(quadro);

    window.addEventListener('keydown', encerrar);
    return () => {
      cancelAnimationFrame(pedido);
      window.removeEventListener('keydown', encerrar);
    };
  }, []);

  if (fim) return null;
  return (
    <div ref={raiz} className={`abertura ${saindo ? 'saindo' : ''}`} onClick={() => setSaindo(true)}
      onTransitionEnd={() => saindo && setFim(true)} role="presentation">
      <canvas ref={luz} className="abertura-luz" />
      <svg className="abertura-logo" viewBox="129 130 766 765" aria-label="Saimo TV">
        <defs>
          <filter id="ab-brilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18" /></filter>
          <filter id="ab-brilhoFino" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
          <clipPath id="ab-formaCartao"><rect x="129" y="130" width="766" height="765" rx="146" /></clipPath>
          <mask id="ab-mS" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
            <path id="ab-trilhaS" d="M540 242 C 470 244 420 285 413 330 C 405 378 440 400 495 412 C 560 428 612 452 614 500 C 616 545 560 580 490 592"
              fill="none" stroke="#fff" strokeWidth="78" strokeLinecap="round" />
          </mask>
          <mask id="ab-mTv" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
            <path id="ab-trilhaTv" d="M452 300 H 687 Q 703 300 703 316 V 536 Q 703 552 687 552 H 338 Q 322 552 322 536 V 316 Q 322 300 338 300 Z"
              fill="none" stroke="#fff" strokeWidth="40" strokeLinejoin="round" />
            <circle id="ab-telaTv" cx="512" cy="426" r="0" fill="#fff" />
          </mask>
          <mask id="ab-mAnt" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
            <path id="ab-trilhaAnt" d="M455 272 L 405 214" fill="none" stroke="#fff" strokeWidth="22" strokeLinecap="round" />
            <circle id="ab-bolaAnt" cx="405" cy="214" r="0" fill="#fff" />
          </mask>
          <linearGradient id="ab-reflexo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          {LETRAS.map(([x0, x1, y0, y1], i) => (
            <clipPath key={i} id={`ab-l${i}`}><rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} /></clipPath>
          ))}
        </defs>
        <rect id="ab-halo" x="129" y="130" width="766" height="765" rx="146" fill="#4ff3e0" filter="url(#ab-brilho)" opacity="0" />
        <rect id="ab-contorno" x="131" y="132" width="762" height="761" rx="144" fill="none" stroke="#4ff3e0" strokeWidth="5" filter="url(#ab-brilhoFino)" />
        <rect id="ab-contornoNitido" x="131" y="132" width="762" height="761" rx="144" fill="none" stroke="#c9fff8" strokeWidth="2.5" />
        <g id="ab-cartao" opacity="0"><Camada nome="cartao" /></g>
        <g clipPath="url(#ab-formaCartao)">
          <g mask="url(#ab-mTv)"><Camada nome="tv" /></g>
          <g mask="url(#ab-mAnt)"><Camada nome="antena" /></g>
          <g mask="url(#ab-mS)"><Camada nome="s" /></g>
          <g id="ab-play" opacity="0"><Camada nome="play" /></g>
          {LETRAS.map((_, i) => (
            <g key={i} id={`ab-letra${i}`} opacity="0"><g clipPath={`url(#ab-l${i})`}><Camada nome="texto" /></g></g>
          ))}
          <g id="ab-final" opacity="0"><Camada nome="final" /></g>
          <rect id="ab-faixa" x="-400" y="80" width="260" height="900" fill="url(#ab-reflexo)" transform="rotate(18 512 512)" opacity="0" />
        </g>
        <circle id="ab-faisca" r="0" fill="#fff" filter="url(#ab-brilhoFino)" />
        <circle id="ab-onda" cx="512" cy="512" r="380" fill="none" stroke="#4ff3e0" strokeWidth="3" opacity="0" />
      </svg>
    </div>
  );
}
