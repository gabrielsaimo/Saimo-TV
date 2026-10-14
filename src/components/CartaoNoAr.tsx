import { useState, useEffect, memo } from 'react';
import type { Channel } from '../types/channel';
import { getCurrentProgram, onEPGUpdate } from '../services/epgService';
import { ChannelIcon } from './ChannelIcon';
import './CartaoNoAr.css';

interface CartaoNoArProps {
  channel: Channel | null;
  channelNumber?: number;
  className?: string;
}

const hora = (data: Date) =>
  data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const CartaoNoAr = memo(function CartaoNoAr({
  channel,
  channelNumber,
  className = '',
}: CartaoNoArProps) {
  const [prog, setProg] = useState(() => (channel ? getCurrentProgram(channel.id) : null));

  useEffect(() => {
    if (!channel) {
      setProg(null);
      return;
    }
    const atualizar = () => {
      setProg(getCurrentProgram(channel.id));
    };
    atualizar();
    const unsub = onEPGUpdate(atualizar);
    const interval = window.setInterval(atualizar, 15_000);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, [channel]);

  if (!channel) return null;

  const current = prog?.current;
  const next = prog?.next;
  const progress = prog?.progress ?? 0;

  let faltamMin = 0;
  if (current?.endTime) {
    faltamMin = Math.max(0, Math.round((current.endTime.getTime() - Date.now()) / 60000));
  }

  return (
    <div className={`cartao-no-ar ${className}`}>
      <ChannelIcon channel={channel} size={54} className="cartao-logo" />
      <div className="cartao-corpo">
        <div className="cartao-cabecalho">
          {channelNumber !== undefined && channelNumber > 0 && (
            <span className="cartao-numero">{channelNumber}</span>
          )}
          <span className="cartao-canal-nome">{channel.name}</span>
        </div>

        {current ? (
          <>
            <h4 className="cartao-programa-titulo" title={current.title}>
              {current.title}
            </h4>
            <div className="cartao-horario">
              {hora(current.startTime)} – {hora(current.endTime)}
              {faltamMin > 0 ? ` · faltam ${faltamMin} min` : ' · terminando'}
            </div>
            {next && (
              <div className="cartao-a-seguir" title={`A seguir: ${next.title}`}>
                A seguir: {next.title}
              </div>
            )}
            <div className="cartao-progresso-trilho">
              <div
                className="cartao-progresso-barra"
                style={{ width: `${Math.min(100, Math.max(0, Math.round(progress)))}%` }}
              />
            </div>
          </>
        ) : (
          <div className="cartao-sem-guia">Sem programação para este canal</div>
        )}
      </div>
    </div>
  );
});
