/**
 * Ajustes: o que abrir ao iniciar, modo adulto, importar/exportar canais,
 * atalhos, limpezas e links.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraTopo } from '../components/BarraTopo';
import { FormListas } from '../components/FormListas';
import { useListas } from '../services/listas';
import { useAdultMode } from '../contexts/adultoContexto';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCanais } from '../hooks/useCanais';
import {
  aoMudar as aoMudarPersonalizados,
  exportarM3U,
  importar,
  limpar as limparPersonalizados,
  locais as canaisLocais,
} from '../services/canaisPersonalizados';
import type { Channel } from '../types/channel';
import './Ajustes.css';

export type AoIniciar = 'inicio' | 'ultimo';
export const CHAVE_AO_INICIAR = 'saimo-ao-iniciar';

export type ModoUpscaling = 'off' | 'hd' | '4k';
export const CHAVE_UPSCALING = 'saimo-upscaling';


const LIMPAR: { rotulo: string; chaves: string[]; aviso: string }[] = [
  { rotulo: 'Limpar “Continue assistindo”', chaves: ['saimo-continuar'], aviso: 'Histórico limpo' },
  { rotulo: 'Limpar buscas recentes', chaves: ['saimo-buscas-recentes'], aviso: 'Buscas limpas' },
  { rotulo: 'Limpar rádios ouvidas', chaves: ['saimo-radios-recentes'], aviso: 'Rádios limpas' },
  { rotulo: 'Limpar favoritos', chaves: ['tv-favorites', 'saimo-vod-favoritos'], aviso: 'Favoritos limpos' },
];

export function Ajustes() {
  const navigate = useNavigate();
  const canais = useCanais();
  const listas = useListas();
  const [favoritosIds] = useLocalStorage<string[]>('tv-favorites', []);
  const { isAdultUnlocked, lockAdult } = useAdultMode();
  const [aoIniciar, setAoIniciar] = useLocalStorage<AoIniciar>(CHAVE_AO_INICIAR, 'inicio');
  const [upscaling, setUpscaling] = useLocalStorage<ModoUpscaling>(CHAVE_UPSCALING, 'off');
  const [aviso, setAviso] = useState('');
  const [personalizados, setPersonalizados] = useState<Channel[]>(canaisLocais);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const alterarUpscaling = (modo: ModoUpscaling) => {
    setUpscaling(modo);
    document.documentElement.dataset.upscaling = modo;
    window.dispatchEvent(new Event('saimo-upscaling-mudou'));
  };

  useEffect(() => aoMudarPersonalizados(() => setPersonalizados(canaisLocais())), []);

  const notificar = (msg: string) => {
    setAviso(msg);
    window.setTimeout(() => setAviso(''), 3000);
  };

  const limparDados = (chaves: string[], texto: string) => {
    chaves.forEach((c) => localStorage.removeItem(c));
    window.dispatchEvent(new Event('saimo-vod-favoritos-mudou'));
    notificar(texto);
  };

  const handleExportarTodos = () => {
    exportarM3U(canais, 'saimo-tv-todos-canais.m3u');
    notificar('Lista de canais exportada!');
  };

  const handleExportarFavoritos = () => {
    const favs = canais.filter((c) => favoritosIds.includes(c.id));
    if (!favs.length) {
      notificar('Você não tem canais favoritos para exportar');
      return;
    }
    exportarM3U(favs, 'saimo-tv-favoritos.m3u');
    notificar('Canais favoritos exportados!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        const qtd = importar(text);
        if (qtd > 0) {
          notificar(`${qtd} canal(is) importado(s) com sucesso!`);
        } else {
          notificar('Nenhum canal válido encontrado no arquivo.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <div className="tela-miolo ajustes">
        <h1 className="tela-titulo">Ajustes</h1>
        {aviso && <div className="ajustes-aviso">{aviso}</div>}

        <section className="ajustes-bloco" id="listas">
          <h2>Listas</h2>
          <p>Os endereços de onde o site lê os canais e os filmes e séries. Sem eles o site abre vazio.</p>
          <FormListas
            key={`${listas.canais}|${listas.filmes}`}
            permitirApagar
            aoSalvar={() => notificar('Listas salvas')}
            aoApagar={() => notificar('Endereço apagado')}
          />
        </section>

        <section className="ajustes-bloco">
          <h2>Ao iniciar</h2>
          <p>O que o site abre quando você entra.</p>
          <div className="pilulas">
            <button className={aoIniciar === 'inicio' ? 'on' : ''} onClick={() => setAoIniciar('inicio')}>Início</button>
            <button className={aoIniciar === 'ultimo' ? 'on' : ''} onClick={() => setAoIniciar('ultimo')}>Último canal assistido</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Super Resolução (Upscaling)</h2>
          <p>Reconstrói bordas e realça a nitidez do vídeo em tempo real (HD → Full HD e Full HD → 4K).</p>
          <div className="pilulas">
            <button className={upscaling === 'off' ? 'on' : ''} onClick={() => alterarUpscaling('off')}>Desligado</button>
            <button className={upscaling === 'hd' ? 'on' : ''} onClick={() => alterarUpscaling('hd')}>Nitidez HD (720p → Full HD)</button>
            <button className={upscaling === '4k' ? 'on' : ''} onClick={() => alterarUpscaling('4k')}>Super Resolução Ultra (Full HD → 4K)</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Canais e listas (M3U / TXT)</h2>
          <p>Exporte seus canais favoritos ou importe uma lista própria de IPTV.</p>
          <div className="ajustes-botoes">
            <button className="ajustes-botao" onClick={handleExportarTodos}>Exportar todos os canais (M3U)</button>
            <button className="ajustes-botao" onClick={handleExportarFavoritos}>Exportar favoritos (M3U)</button>
            <button className="ajustes-botao destaque" onClick={() => fileInputRef.current?.click()}>
              Importar lista (.m3u / .txt)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".m3u,.m3u8,.txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {personalizados.length > 0 && (
              <button
                className="ajustes-botao perigo"
                onClick={() => {
                  limparPersonalizados();
                  notificar('Canais importados removidos.');
                }}
              >
                Limpar {personalizados.length} canais importados
              </button>
            )}
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Modo adulto (+18)</h2>
          <p>{isAdultUnlocked
            ? 'Ligado: o catálogo mostra também o conteúdo adulto.'
            : 'Desligado. Para ligar, clique vinte vezes no ícone da barra do topo e digite o PIN.'}</p>
          {isAdultUnlocked && <button className="ajustes-botao" onClick={lockAdult}>Desligar</button>}
        </section>


        <section className="ajustes-bloco">
          <h2>Dados deste navegador</h2>
          <div className="ajustes-botoes">
            {LIMPAR.map((l) => (
              <button key={l.rotulo} className="ajustes-botao" onClick={() => limparDados(l.chaves, l.aviso)}>{l.rotulo}</button>
            ))}
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Mais</h2>
          <div className="ajustes-botoes">
            <button className="ajustes-botao" onClick={() => navigate('/app')}>Baixar o app (TV Box, celular, Mac, Windows)</button>
            <button className="ajustes-botao" onClick={() => navigate('/novidades')}>Novidades</button>
            <a className="ajustes-botao" href="https://discord.gg/8DKqT3xJvD" target="_blank" rel="noreferrer noopener">Comunidade no Discord</a>
            {listas.canais && (
              <a className="ajustes-botao" href={`${listas.canais}catalogo.txt`} target="_blank" rel="noreferrer noopener">Lista de canais (texto)</a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
