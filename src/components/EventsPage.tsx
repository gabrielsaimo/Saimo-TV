import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './EventsPage.css';

interface EventData {
  id: number;
  slug: string;
  title: string;
  league: {
    name: string;
    image: string;
  };
  teams: {
    home: { name: string; image: string };
    away: { name: string; image: string };
  };
  time_start: string;
  time_end: string;
  players: string[];
}

export function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://embedtv.cc/api/events')
      .then(r => r.json())
      .then(data => {
        setEvents(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleWatch = (players: string[]) => {
    if (!players || players.length === 0) return;
    const url = players[0];
    const slug = url.split('/').pop();
    if (slug) {
      localStorage.setItem('tv-last-channel', slug);
      navigate('/tv');
    }
  };

  const isLive = (start: string, end: string) => {
    const now = new Date().getTime();
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return now >= startTime && now <= endTime;
  };

  const getStatus = (start: string, end: string) => {
    const now = new Date().getTime();
    const startTime = new Date(start).getTime();
    
    if (isLive(start, end)) return <div className="event-badge live"><span className="pulse"></span>AO VIVO</div>;
    
    const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', hour: '2-digit', minute: '2-digit' };
    if (startTime > now) {
      return <div className="event-badge upnext">{new Date(start).toLocaleDateString('pt-BR', dateOpts)}</div>;
    }
    return <div className="event-badge ended">Encerrado</div>;
  };

  return (
    <div className="events-page">
      <div className="events-header">
        <h1>Eventos Esportivos</h1>
        <p>Acompanhe os melhores jogos e campeonatos ao vivo na Saimo TV.</p>
      </div>

      <div className="events-content">
        {loading && <div className="events-loading">Carregando eventos incríves...</div>}
        {error && <div className="events-error">Erro ao carregar eventos: {error}</div>}
        
        {!loading && !error && events.length === 0 && (
          <div className="events-empty">Nenhum evento rolando hoje. Tente mais tarde!</div>
        )}

        <div className="events-grid">
          {events.map(ev => {
            const live = isLive(ev.time_start, ev.time_end);
            return (
              <div key={ev.id} className={`event-card ${live ? 'is-live' : ''}`}>
                <div className="event-card-header">
                  <div className="event-league">
                    <img src={ev.league.image} alt={ev.league.name} />
                    <span>{ev.league.name}</span>
                  </div>
                  {getStatus(ev.time_start, ev.time_end)}
                </div>

                <div className="event-teams">
                  <div className="team home">
                    <img src={ev.teams.home.image} alt={ev.teams.home.name} />
                    <span>{ev.teams.home.name}</span>
                  </div>
                  <div className="team-vs">X</div>
                  <div className="team away">
                    <img src={ev.teams.away.image} alt={ev.teams.away.name} />
                    <span>{ev.teams.away.name}</span>
                  </div>
                </div>

                <div className="event-footer">
                  <h3 className="event-title">{ev.title}</h3>
                  <button 
                    className={`btn-watch ${!live ? 'disabled' : ''}`}
                    onClick={() => handleWatch(ev.players)}
                    title={live ? "Assistir agora" : "Canal estará disponível na hora do jogo"}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Assistir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
