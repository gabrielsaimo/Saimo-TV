import React, { useCallback, useRef, useState, useEffect } from 'react';
import { DpadContext, type Direction, type DpadContextValue } from './dpadContexto';
import { useNavigate, useLocation } from 'react-router-dom';
import { ehTv } from '../plataforma/tv';

// Tipos


// Seletor para elementos focáveis
const FOCUSABLE_SELECTOR = '[data-focusable="true"]:not([disabled]):not([data-disabled="true"]):not([aria-hidden="true"])';
// Na TV não há mouse: todo controle da tela precisa ser alcançável pelo controle remoto, tenha
// ou não o atributo data-focusable (só as telas feitas para o D-pad o tinham).
const FOCUSAVEIS_NA_TV = [
  '[data-focusable="true"]', 'button', 'a[href]', '[role="button"]', '[role="tab"]', '[role="menuitem"]',
  'input:not([type="hidden"])', 'select', 'textarea', '[tabindex]:not([tabindex="-1"])',
].map((q) => `${q}:not([disabled]):not([data-disabled="true"]):not([aria-hidden="true"])`).join(',');
const seletorFocavel = () => (ehTv() ? FOCUSAVEIS_NA_TV : FOCUSABLE_SELECTOR);

// Zonas de navegação - define como navegação entre áreas funciona
interface NavigationZone {
  selector: string;
  name: string;
  // Define para qual zona ir quando navegar em uma direção
  neighbors: {
    up?: string;
    down?: string;
    left?: string;
    right?: string;
  };
}

// Definição das zonas de navegação para TV page
const NAVIGATION_ZONES: NavigationZone[] = [
  {
    selector: '.sidebar, .sidebar-wrapper',
    name: 'sidebar',
    neighbors: {
      right: '.main-content, .video-player-container',
    }
  },
  {
    selector: '.main-content, .video-player-container',
    name: 'player',
    neighbors: {
      left: '.sidebar, .sidebar-wrapper',
    }
  },
  {
    selector: '.mobile-content',
    name: 'mobile',
    neighbors: {}
  }
];

// Componente de navegação hint
const NavigationHint = React.memo(function NavigationHint({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="dpad-navigation-hint auto-hide">
      <div className="hint-item">
        <span className="hint-key">↑↓←→</span>
        <span>Navegar</span>
      </div>
      <div className="hint-item">
        <span className="hint-key">Enter</span>
        <span>Selecionar</span>
      </div>
      <div className="hint-item">
        <span className="hint-key">Esc</span>
        <span>Voltar</span>
      </div>
    </div>
  );
});

// Provider do contexto D-pad
/**
 * Deixa o elemento focado à vista: primeiro dentro da fileira que rola de lado (os trilhos de
 * capas do On Demand, do Início…), depois na página. A conta é feita contra a caixa de quem rola,
 * e não contra a janela: o trilho costuma ser mais estreito que a tela, e o cartão "fora" dele
 * ainda parecia dentro da janela — a fileira ficava parada e o foco sumia para a direita.
 */
function rolarAteVer(el: HTMLElement): void {
  const suave = 'smooth' as ScrollBehavior;
  // Fileira horizontal mais próxima.
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (p.scrollWidth <= p.clientWidth + 1) continue;
    const ox = window.getComputedStyle(p).overflowX;
    if (ox === 'visible') continue;
    const r = el.getBoundingClientRect();
    const c = p.getBoundingClientRect();
    const margem = Math.min(140, c.width * 0.12);
    if (r.left < c.left + margem) p.scrollBy({ left: r.left - c.left - margem, behavior: suave });
    else if (r.right > c.right - margem) p.scrollBy({ left: r.right - c.right + margem, behavior: suave });
    break;
  }
  // Na vertical: a página (ou o painel que rola) leva a fileira para perto do meio.
  const r = el.getBoundingClientRect();
  if (r.top < 120 || r.bottom > window.innerHeight - 60) {
    el.scrollIntoView({ behavior: suave, block: 'center', inline: 'nearest' });
  }
}

/** A janela de cima (dialog visível mais recente), se houver. */
function janelaAberta(): HTMLElement | null {
  const todas = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]'))
    .filter((d) => d.getClientRects().length > 0 && window.getComputedStyle(d).visibility !== 'hidden');
  return todas.length ? todas[todas.length - 1] : null;
}

export function DpadNavigationProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  // Na TV (Samsung/LG) o controle remoto é o único jeito de navegar: nasce ligado.
  const [isEnabled, setEnabled] = useState(() => ehTv());
  const [isUsingDpad, setIsUsingDpad] = useState(() => ehTv());
  const [showHint, setShowHint] = useState(false);
  
  const currentFocusRef = useRef<HTMLElement | null>(null);
  const backHandlersRef = useRef<Array<() => boolean | void>>([]);

  // Função para verificar se um elemento está visível
  const isElementVisible = useCallback((element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0' &&
      !element.closest('[aria-hidden="true"]') &&
      !element.closest('.hidden-catalog')
    );
  }, []);

  // Função para obter todos os elementos focáveis em um container
  const getFocusableElements = useCallback((container?: HTMLElement | Document | null): HTMLElement[] => {
    // Na TV, com uma janela aberta por cima (ficha do título, ator…), o controle anda só
    // dentro dela: antes as setas continuavam nos cartões que ficaram atrás.
    const scope = container || (ehTv() ? janelaAberta() : null) || document;
    const dentro = Array.from(scope.querySelectorAll<HTMLElement>(seletorFocavel()))
      .filter(isElementVisible);
    // Zona vizinha fora da janela aberta: não vale.
    const janela = ehTv() ? janelaAberta() : null;
    return janela && container && !janela.contains(container as Node) ? [] : dentro;
  }, [isElementVisible]);

  // Função para calcular a distância entre elementos na direção especificada
  const calculateDistance = useCallback((
    from: DOMRect,
    to: DOMRect,
    direction: Direction
  ): number => {
    const fromCenter = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    const toCenter = { x: to.left + to.width / 2, y: to.top + to.height / 2 };

    // Verificar direção válida
    const tolerance = 5;
    switch (direction) {
      case 'up':
        if (toCenter.y >= fromCenter.y - tolerance) return Infinity;
        break;
      case 'down':
        if (toCenter.y <= fromCenter.y + tolerance) return Infinity;
        break;
      case 'left':
        if (toCenter.x >= fromCenter.x - tolerance) return Infinity;
        break;
      case 'right':
        if (toCenter.x <= fromCenter.x + tolerance) return Infinity;
        break;
    }

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    // Peso baseado na direção para priorizar elementos alinhados
    const isVertical = direction === 'up' || direction === 'down';
    const weightMain = 1;
    const weightCross = 3;

    // Calcular alinhamento
    let alignmentBonus = 0;
    if (isVertical) {
      const overlapLeft = Math.max(from.left, to.left);
      const overlapRight = Math.min(from.right, to.right);
      if (overlapRight > overlapLeft) {
        alignmentBonus = -1000 * ((overlapRight - overlapLeft) / Math.min(from.width, to.width));
      }
    } else {
      const overlapTop = Math.max(from.top, to.top);
      const overlapBottom = Math.min(from.bottom, to.bottom);
      if (overlapBottom > overlapTop) {
        alignmentBonus = -1000 * ((overlapBottom - overlapTop) / Math.min(from.height, to.height));
      }
    }

    const mainAxis = isVertical ? dy : dx;
    const crossAxis = isVertical ? dx : dy;

    return Math.sqrt(
      Math.pow(mainAxis * weightMain, 2) + 
      Math.pow(crossAxis * weightCross, 2)
    ) + alignmentBonus;
  }, []);

  // Encontrar próximo elemento na direção
  const findNextElement = useCallback((
    currentElement: HTMLElement | null,
    direction: Direction,
    container?: HTMLElement | Document | null
  ): HTMLElement | null => {
    const elements = getFocusableElements(container);
    
    if (elements.length === 0) return null;
    if (!currentElement || !isElementVisible(currentElement)) {
      return elements[0];
    }

    const currentRect = currentElement.getBoundingClientRect();
    let bestElement: HTMLElement | null = null;
    let bestDistance = Infinity;

    for (const element of elements) {
      if (element === currentElement) continue;
      
      const elementRect = element.getBoundingClientRect();
      const distance = calculateDistance(currentRect, elementRect, direction);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestElement = element;
      }
    }

    return bestElement;
  }, [getFocusableElements, isElementVisible, calculateDistance]);

  // Define foco em um elemento
  const setFocus = useCallback((element: HTMLElement | null, scrollIntoView = true) => {
    // Remove foco anterior
    if (currentFocusRef.current && currentFocusRef.current !== element) {
      currentFocusRef.current.classList.remove('dpad-focused');
      currentFocusRef.current.setAttribute('data-focused', 'false');
      currentFocusRef.current.blur();
    }

    currentFocusRef.current = element;
    setFocusedElement(element);

    if (element) {
      // Adiciona classes de foco
      element.classList.add('dpad-focused');
      element.setAttribute('data-focused', 'true');
      
      // Focus nativo para acessibilidade - SEM scroll
      element.focus({ preventScroll: true });

      if (scrollIntoView) {
        requestAnimationFrame(() => rolarAteVer(element));
      }
    }
  }, []);

  // Encontra a zona de navegação atual do elemento
  const getCurrentZone = useCallback((element: HTMLElement): NavigationZone | null => {
    for (const zone of NAVIGATION_ZONES) {
      const selectors = zone.selector.split(', ');
      for (const sel of selectors) {
        if (element.closest(sel)) {
          return zone;
        }
      }
    }
    return null;
  }, []);

  // Encontra o primeiro elemento focável em uma zona vizinha
  const getNeighborZoneElement = useCallback((currentElement: HTMLElement, direction: Direction): HTMLElement | null => {
    const currentZone = getCurrentZone(currentElement);
    if (!currentZone) return null;

    const neighborSelector = currentZone.neighbors[direction];
    if (!neighborSelector) return null;

    // Encontra os containers da zona vizinha
    const selectors = neighborSelector.split(', ');
    for (const sel of selectors) {
      const container = document.querySelector<HTMLElement>(sel);
      if (container && isElementVisible(container)) {
        // Obtém elementos focáveis dentro do container vizinho
        const elements = getFocusableElements(container);
        if (elements.length > 0) {
          // Para direita/esquerda, tenta encontrar elemento na mesma altura
          const currentRect = currentElement.getBoundingClientRect();
          const currentCenterY = currentRect.top + currentRect.height / 2;

          // Ordena elementos por proximidade vertical
          const sorted = elements.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            const distA = Math.abs((rectA.top + rectA.height / 2) - currentCenterY);
            const distB = Math.abs((rectB.top + rectB.height / 2) - currentCenterY);
            return distA - distB;
          });

          return sorted[0];
        }
      }
    }
    return null;
  }, [getCurrentZone, getFocusableElements, isElementVisible]);

  // Move foco na direção
  const moveFocus = useCallback((direction: Direction): boolean => {
    // Se não tem elemento focado, foca no primeiro
    if (!currentFocusRef.current || !isElementVisible(currentFocusRef.current)) {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        setFocus(elements[0]);
        return true;
      }
      return false;
    }

    // Primeiro, tenta navegar dentro da mesma zona
    const nextElement = findNextElement(currentFocusRef.current, direction);
    
    if (nextElement) {
      // Verifica se o próximo elemento está na mesma zona
      const currentZone = getCurrentZone(currentFocusRef.current);
      const nextZone = getCurrentZone(nextElement);
      
      // Se está na mesma zona, navega normalmente
      if (currentZone && nextZone && currentZone.name === nextZone.name) {
        setFocus(nextElement);
        return true;
      }
      
      // Se está mudando de zona, verifica se é uma transição válida
      if (currentZone) {
        const neighborSelector = currentZone.neighbors[direction];
        if (neighborSelector) {
          // Tem vizinho definido nessa direção, usa a navegação de zona
          const neighborElement = getNeighborZoneElement(currentFocusRef.current, direction);
          if (neighborElement) {
            setFocus(neighborElement);
            
            // Se está indo para o player, dispara evento para mostrar controles
            if (neighborElement.closest('.video-player-container, .main-content')) {
              const playerContainer = document.querySelector('.video-player-container');
              if (playerContainer) {
                playerContainer.dispatchEvent(new CustomEvent('dpad-enter'));
              }
            }
            
            return true;
          }
        }
      }
      
      // Se não tem vizinho definido, usa navegação normal
      setFocus(nextElement);
      return true;
    }
    
    // Não encontrou elemento na zona atual, tenta navegar para zona vizinha
    const neighborElement = getNeighborZoneElement(currentFocusRef.current, direction);
    if (neighborElement) {
      setFocus(neighborElement);
      
      // Se está indo para o player, dispara evento para mostrar controles
      if (neighborElement.closest('.video-player-container, .main-content')) {
        const playerContainer = document.querySelector('.video-player-container');
        if (playerContainer) {
          playerContainer.dispatchEvent(new CustomEvent('dpad-enter'));
        }
      }
      
      return true;
    }
    
    // Se não encontrou na direção, mantém o foco atual (não perde)
    return false;
  }, [findNextElement, setFocus, getFocusableElements, isElementVisible, getCurrentZone, getNeighborZoneElement]);

  // Foca no primeiro elemento
  const focusFirst = useCallback((containerId?: string) => {
    const container = containerId ? document.getElementById(containerId) : document;
    const elements = getFocusableElements(container);
    
    if (elements.length > 0) {
      setFocus(elements[0]);
    }
  }, [getFocusableElements, setFocus]);

  // Foca em elemento específico
  const focusElement = useCallback((selector: string, containerId?: string): boolean => {
    const container = containerId ? document.getElementById(containerId) : document;
    const element = container?.querySelector<HTMLElement>(selector) ||
                    container?.querySelector<HTMLElement>(`#${selector}`) ||
                    container?.querySelector<HTMLElement>(`[data-focus-key="${selector}"]`);
    
    if (element && isElementVisible(element)) {
      setFocus(element);
      return true;
    }
    return false;
  }, [setFocus, isElementVisible]);

  // Registra handler de voltar
  const registerBackHandler = useCallback((handler: () => boolean | void): (() => void) => {
    backHandlersRef.current.push(handler);
    return () => {
      const index = backHandlersRef.current.indexOf(handler);
      if (index > -1) {
        backHandlersRef.current.splice(index, 1);
      }
    };
  }, []);

  // Handler de voltar
  const handleBack = useCallback(() => {
    // Tenta handlers registrados (do mais recente ao mais antigo)
    for (let i = backHandlersRef.current.length - 1; i >= 0; i--) {
      const result = backHandlersRef.current[i]();
      if (result !== false) {
        return true;
      }
    }

    // Se não há handlers, navega para trás
    const isHome = location.pathname === '/';
    if (!isHome) {
      navigate(-1);
      return true;
    }

    return false;
  }, [navigate, location.pathname]);

  // Handler de teclado global
  useEffect(() => {
    if (!isEnabled) return;

    let lastKeyTime = 0;
    const KEY_DELAY = 100; // Delay mínimo entre teclas para evitar spam

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();
      const target = event.target as HTMLElement;
      
      // Ignora se estiver em input de texto (exceto para navegação vertical e escape)
      const isTextInput = target.tagName === 'INPUT' && 
        ['text', 'search', 'email', 'url', 'tel'].includes((target as HTMLInputElement).type);
      const isTextArea = target.tagName === 'TEXTAREA';
      
      if ((isTextInput || isTextArea) && !['ArrowUp', 'ArrowDown', 'Escape'].includes(event.key)) {
        return;
      }

      // Indica que está usando D-pad
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(event.key)) {
        if (!isUsingDpad) {
          setIsUsingDpad(true);
          setShowHint(true);
          setTimeout(() => setShowHint(false), 6000);
        }
      }

      let handled = false;

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          // Delay para evitar navegação muito rápida
          if (now - lastKeyTime < KEY_DELAY) {
            event.preventDefault();
            return;
          }
          lastKeyTime = now;
          
          const direction = event.key.replace('Arrow', '').toLowerCase() as Direction;
          handled = moveFocus(direction);
          break;
        }
        case 'Enter':
          if (currentFocusRef.current) {
            // Dispara click no elemento focado
            currentFocusRef.current.click();
            handled = true;
          }
          break;
        case ' ':
          // Espaço só ativa se não estiver em input
          if (currentFocusRef.current && !isTextInput && !isTextArea) {
            currentFocusRef.current.click();
            handled = true;
          }
          break;
        case 'Escape':
        case 'Backspace':
          if (event.key === 'Backspace' && (isTextInput || isTextArea)) {
            return; // Permite backspace em inputs
          }
          handled = handleBack();
          break;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isEnabled, moveFocus, handleBack, isUsingDpad]);

  // Suporte a Gamepad
  useEffect(() => {
    if (!isEnabled) return;

    let animationFrameId: number;
    const lastButtonStates = new Array(16).fill(false);
    let lastNavigationTime = 0;
    const NAVIGATION_DELAY = 150; // Delay entre navegações em ms

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads?.() || [];
      const now = Date.now();

      for (const gamepad of gamepads) {
        if (!gamepad) continue;

        // Botões D-pad padrão
        const buttons = {
          dpadUp: gamepad.buttons[12]?.pressed ?? false,
          dpadDown: gamepad.buttons[13]?.pressed ?? false,
          dpadLeft: gamepad.buttons[14]?.pressed ?? false,
          dpadRight: gamepad.buttons[15]?.pressed ?? false,
          buttonA: gamepad.buttons[0]?.pressed ?? false,
          buttonB: gamepad.buttons[1]?.pressed ?? false,
        };

        // Verifica se passou tempo suficiente desde última navegação
        const canNavigate = now - lastNavigationTime >= NAVIGATION_DELAY;

        // Detectar mudanças de estado (edge detection)
        const wasUp = lastButtonStates[12];
        const wasDown = lastButtonStates[13];
        const wasLeft = lastButtonStates[14];
        const wasRight = lastButtonStates[15];
        const wasA = lastButtonStates[0];
        const wasB = lastButtonStates[1];

        // Navegação D-pad com delay
        if (canNavigate) {
          if (buttons.dpadUp && !wasUp) {
            moveFocus('up');
            lastNavigationTime = now;
          } else if (buttons.dpadDown && !wasDown) {
            moveFocus('down');
            lastNavigationTime = now;
          } else if (buttons.dpadLeft && !wasLeft) {
            moveFocus('left');
            lastNavigationTime = now;
          } else if (buttons.dpadRight && !wasRight) {
            moveFocus('right');
            lastNavigationTime = now;
          }
        }

        // Botões de ação (sem delay)
        if (buttons.buttonA && !wasA && currentFocusRef.current) {
          currentFocusRef.current.click();
        }
        if (buttons.buttonB && !wasB) {
          handleBack();
        }

        // Indica uso de controle
        const anyButtonPressed = Object.values(buttons).some(b => b);
        const anyWasPressed = [wasUp, wasDown, wasLeft, wasRight, wasA, wasB].some(b => b);
        if (anyButtonPressed && !anyWasPressed && !isUsingDpad) {
          setIsUsingDpad(true);
          setShowHint(true);
          setTimeout(() => setShowHint(false), 6000);
        }

        // Atualiza estados
        lastButtonStates[12] = buttons.dpadUp;
        lastButtonStates[13] = buttons.dpadDown;
        lastButtonStates[14] = buttons.dpadLeft;
        lastButtonStates[15] = buttons.dpadRight;
        lastButtonStates[0] = buttons.buttonA;
        lastButtonStates[1] = buttons.buttonB;

        // Analógico esquerdo
        const axisX = gamepad.axes[0] || 0;
        const axisY = gamepad.axes[1] || 0;
        const deadzone = 0.6;
        const wasAnalogActive = lastButtonStates[16];

        const isAnalogActive = Math.abs(axisX) > deadzone || Math.abs(axisY) > deadzone;

        if (isAnalogActive && !wasAnalogActive && canNavigate) {
          if (axisY < -deadzone) {
            moveFocus('up');
            lastNavigationTime = now;
          } else if (axisY > deadzone) {
            moveFocus('down');
            lastNavigationTime = now;
          } else if (axisX < -deadzone) {
            moveFocus('left');
            lastNavigationTime = now;
          } else if (axisX > deadzone) {
            moveFocus('right');
            lastNavigationTime = now;
          }
        }

        lastButtonStates[16] = isAnalogActive;
      }

      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    const handleGamepadConnected = () => {
      if (!animationFrameId) {
        pollGamepad();
      }
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);

    // Inicia se já tem gamepad
    if (navigator.getGamepads?.().some((gp) => gp)) {
      pollGamepad();
    }

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isEnabled, moveFocus, handleBack, isUsingDpad]);

  // Atualiza foco quando clica com mouse
  useEffect(() => {
    if (!isEnabled) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const focusable = target.closest<HTMLElement>(seletorFocavel());
      if (focusable) {
        setFocus(focusable, false);
        // NÃO desativa D-pad no clique - permite continuar usando D-pad após clique
      }
    };

    // Desativa indicador de D-pad APENAS após uso prolongado do mouse
    // Mas NUNCA limpa o foco atual
    let lastMouseX = 0;
    let lastMouseY = 0;
    let moveCount = 0;
    let lastMoveTime = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now();
      
      // Reset contador se passou muito tempo desde último movimento
      if (now - lastMoveTime > 500) {
        moveCount = 0;
      }
      lastMoveTime = now;
      
      // Calcula distância movida
      const distance = Math.abs(event.clientX - lastMouseX) + Math.abs(event.clientY - lastMouseY);
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      
      // Só conta como movimento real se moveu mais de 15px
      if (distance > 15) {
        moveCount++;
        // Precisa de 5 movimentos significativos consecutivos para considerar que voltou ao mouse
        // MAS não limpa o foco - apenas muda o indicador visual
        if (moveCount >= 5 && isUsingDpad) {
          setIsUsingDpad(false);
          moveCount = 0;
        }
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isEnabled, setFocus, isUsingDpad]);

  // Reset foco quando muda de página - MAS mantém o estado de navegação
  useEffect(() => {
    // Se estava usando D-pad, mantém o estado e foca no primeiro elemento após transição
    if (isUsingDpad) {
      // Delay para garantir que a página carregou completamente
      const timer = setTimeout(() => {
        // Verifica se o elemento atual ainda existe e está visível
        if (currentFocusRef.current && isElementVisible(currentFocusRef.current)) {
          // Elemento ainda existe, mantém o foco
          return;
        }
        
        // Elemento não existe mais, limpa e foca no primeiro
        if (currentFocusRef.current) {
          currentFocusRef.current.classList.remove('dpad-focused');
          currentFocusRef.current.setAttribute('data-focused', 'false');
        }
        currentFocusRef.current = null;
        setFocusedElement(null);
        
        // Foca no primeiro elemento disponível
        const elements = getFocusableElements();
        if (elements.length > 0) {
          setFocus(elements[0]);
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Na TV a tela não pode ficar sem foco: o controle precisa responder já na primeira tecla,
  // e de novo a cada tela nova (o foco antigo pode ter saído de cena).
  useEffect(() => {
    if (!isEnabled || !ehTv()) return;
    const timer = setTimeout(() => {
      if (!currentFocusRef.current || !isElementVisible(currentFocusRef.current)) {
        const elementos = getFocusableElements();
        if (elementos.length > 0) setFocus(elementos[0]);
      }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, location.pathname]);

  // Na TV: janela abriu, o foco entra nela; fechou, volta para onde estava (o cartão).
  useEffect(() => {
    if (!isEnabled || !ehTv()) return;
    let atual: HTMLElement | null = janelaAberta();
    const pilha: (HTMLElement | null)[] = [];
    let agendado = 0;
    const conferir = () => {
      agendado = 0;
      const nova = janelaAberta();
      if (nova === atual) return;
      if (nova && (!atual || !nova.contains(atual))) {
        pilha.push(currentFocusRef.current);
        const alvo = nova.querySelector<HTMLElement>('[data-autofocus], .vod-btn-assistir, button.primario')
          ?? Array.from(nova.querySelectorAll<HTMLElement>(seletorFocavel())).find(isElementVisible) ?? null;
        if (alvo) setFocus(alvo);
      } else if (!nova || (atual && atual.contains(nova))) {
        const antes = pilha.pop();
        if (antes && antes.isConnected && isElementVisible(antes)) setFocus(antes);
      }
      atual = nova;
    };
    const obs = new MutationObserver(() => {
      if (!agendado) agendado = window.setTimeout(conferir, 80);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); if (agendado) clearTimeout(agendado); };
  }, [isEnabled, setFocus, isElementVisible]);

  const contextValue: DpadContextValue = {
    focusedElement,
    setFocus,
    moveFocus,
    focusFirst,
    focusElement,
    registerBackHandler,
    isEnabled,
    setEnabled,
    isUsingDpad,
  };

  return (
    <DpadContext.Provider value={contextValue}>
      {children}
      <NavigationHint show={showHint && isUsingDpad} />
    </DpadContext.Provider>
  );
}

export const Focusable = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    focusKey?: string;
    disabled?: boolean;
    onDpadSelect?: () => void;
  }
>(function Focusable({ children, focusKey, disabled, onDpadSelect, ...props }, forwardedRef) {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = (forwardedRef as React.RefObject<HTMLDivElement>) || internalRef;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.setAttribute('data-focusable', disabled ? 'false' : 'true');
    element.setAttribute('tabindex', disabled ? '-1' : '0');
    
    if (focusKey) {
      element.setAttribute('data-focus-key', focusKey);
    }
  }, [focusKey, disabled, ref]);

  return (
    <div 
      ref={ref} 
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        onDpadSelect?.();
      }}
    >
      {children}
    </div>
  );
});

export default DpadNavigationProvider;
