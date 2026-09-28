import { useEffect, useCallback, useRef, useState } from 'react';

// Tipos para navegação D-pad
export type FocusableElement = HTMLElement;
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface DpadNavigationOptions {
  /** Se a navegação está habilitada */
  enabled?: boolean;
  /** Callback quando o foco muda */
  onFocusChange?: (element: FocusableElement | null, direction: Direction | null) => void;
  /** Callback quando Enter/Select é pressionado */
  onSelect?: (element: FocusableElement) => void;
  /** Callback quando Back é pressionado */
  onBack?: () => void;
  /** Se deve rolar automaticamente para o elemento focado */
  scrollIntoView?: boolean;
  /** ID do container de navegação (para navegação contextual) */
  containerId?: string;
  /** Se deve focar no primeiro elemento ao iniciar */
  focusFirstOnMount?: boolean;
  /** Se permite loop na navegação */
  enableLoop?: boolean;
}

// Seletor para elementos focáveis
const FOCUSABLE_SELECTOR = '[data-focusable="true"]:not([disabled]):not([data-disabled="true"])';

// Mapa de teclas de controle remoto/gamepad
const KEY_MAP: Record<string, Direction | 'select' | 'back'> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  ' ': 'select', // Espaço
  Escape: 'back',
  Backspace: 'back',
  // Teclas de gamepad comuns
  GamepadDPadUp: 'up',
  GamepadDPadDown: 'down',
  GamepadDPadLeft: 'left',
  GamepadDPadRight: 'right',
  GamepadA: 'select',
  GamepadB: 'back',
};

// Função para obter a posição do elemento
function getElementRect(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect();
}

// Função para calcular a distância entre dois elementos
function calculateDistance(
  from: DOMRect,
  to: DOMRect,
  direction: Direction
): number {
  const fromCenter = {
    x: from.left + from.width / 2,
    y: from.top + from.height / 2,
  };
  const toCenter = {
    x: to.left + to.width / 2,
    y: to.top + to.height / 2,
  };

  // Verificar se o elemento está na direção correta
  switch (direction) {
    case 'up':
      if (toCenter.y >= fromCenter.y - 10) return Infinity; // tolerância de 10px
      break;
    case 'down':
      if (toCenter.y <= fromCenter.y + 10) return Infinity;
      break;
    case 'left':
      if (toCenter.x >= fromCenter.x - 10) return Infinity;
      break;
    case 'right':
      if (toCenter.x <= fromCenter.x + 10) return Infinity;
      break;
  }

  // Calcular distância euclidiana com peso baseado na direção
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  // Dar mais peso à direção principal
  let weightX = 1;
  let weightY = 1;

  if (direction === 'up' || direction === 'down') {
    weightX = 3; // Elementos na mesma coluna têm prioridade
  } else {
    weightY = 3; // Elementos na mesma linha têm prioridade
  }

  // Calcular alinhamento - preferir elementos mais alinhados
  let alignmentBonus = 0;
  if (direction === 'up' || direction === 'down') {
    // Verificar sobreposição horizontal
    const overlapLeft = Math.max(from.left, to.left);
    const overlapRight = Math.min(from.right, to.right);
    if (overlapRight > overlapLeft) {
      alignmentBonus = -500 * ((overlapRight - overlapLeft) / Math.min(from.width, to.width));
    }
  } else {
    // Verificar sobreposição vertical
    const overlapTop = Math.max(from.top, to.top);
    const overlapBottom = Math.min(from.bottom, to.bottom);
    if (overlapBottom > overlapTop) {
      alignmentBonus = -500 * ((overlapBottom - overlapTop) / Math.min(from.height, to.height));
    }
  }

  return Math.sqrt(dx * dx * weightX + dy * dy * weightY) + alignmentBonus;
}

// Encontrar o melhor próximo elemento na direção especificada
function findNextElement(
  currentElement: HTMLElement | null,
  direction: Direction,
  container?: HTMLElement | null
): HTMLElement | null {
  const scope = container || document;
  const focusableElements = Array.from(
    scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => {
    // Verificar se o elemento está visível
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  });

  if (focusableElements.length === 0) return null;

  // Se não há elemento atual, retornar o primeiro
  if (!currentElement) {
    return focusableElements[0];
  }

  const currentRect = getElementRect(currentElement);
  let bestElement: HTMLElement | null = null;
  let bestDistance = Infinity;

  for (const element of focusableElements) {
    if (element === currentElement) continue;

    const elementRect = getElementRect(element);
    const distance = calculateDistance(currentRect, elementRect, direction);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestElement = element;
    }
  }

  return bestElement;
}

// Hook principal de navegação D-pad
export function useDpadNavigation(options: DpadNavigationOptions = {}) {
  const {
    enabled = true,
    onFocusChange,
    onSelect,
    onBack,
    scrollIntoView = true,
    containerId,
    focusFirstOnMount = true,
    enableLoop = false,
  } = options;

  const currentFocusRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);

  // Obtém o container de navegação
  const getContainer = useCallback(() => {
    if (containerId) {
      return document.getElementById(containerId);
    }
    return containerRef.current || document;
  }, [containerId]);

  // Define o foco em um elemento
  const setFocus = useCallback(
    (element: HTMLElement | null, direction: Direction | null = null) => {
      // Remove foco anterior
      if (currentFocusRef.current) {
        currentFocusRef.current.classList.remove('dpad-focused');
        currentFocusRef.current.setAttribute('data-focused', 'false');
      }

      // Define novo foco
      currentFocusRef.current = element;
      setFocusedElement(element);

      if (element) {
        element.classList.add('dpad-focused');
        element.setAttribute('data-focused', 'true');
        element.focus({ preventScroll: !scrollIntoView });

        if (scrollIntoView) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      }

      onFocusChange?.(element, direction);
    },
    [onFocusChange, scrollIntoView]
  );

  // Move o foco na direção especificada
  const moveFocus = useCallback(
    (direction: Direction) => {
      const container = getContainer() as HTMLElement | null;
      const nextElement = findNextElement(
        currentFocusRef.current,
        direction,
        container
      );

      if (nextElement) {
        setFocus(nextElement, direction);
        return true;
      } else if (enableLoop && currentFocusRef.current) {
        // Se loop está habilitado, volta para o início/fim
        const focusableElements = Array.from(
          (container || document).querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        if (focusableElements.length > 0) {
          const currentIndex = focusableElements.indexOf(currentFocusRef.current);
          let nextIndex: number;

          if (direction === 'down' || direction === 'right') {
            nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
          } else {
            nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
          }

          setFocus(focusableElements[nextIndex], direction);
          return true;
        }
      }

      return false;
    },
    [getContainer, setFocus, enableLoop]
  );

  // Foca no primeiro elemento
  const focusFirst = useCallback(() => {
    const container = getContainer() as HTMLElement | null;
    const firstElement = (container || document).querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (firstElement) {
      setFocus(firstElement, null);
    }
  }, [getContainer, setFocus]);

  // Foca no último elemento
  const focusLast = useCallback(() => {
    const container = getContainer() as HTMLElement | null;
    const elements = (container || document).querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (elements.length > 0) {
      setFocus(elements[elements.length - 1], null);
    }
  }, [getContainer, setFocus]);

  // Foca em um elemento específico por ID ou seletor
  const focusElement = useCallback(
    (selectorOrId: string) => {
      const container = getContainer() as HTMLElement | null;
      const element =
        (container || document).querySelector<HTMLElement>(selectorOrId) ||
        (container || document).querySelector<HTMLElement>(`#${selectorOrId}`);
      if (element) {
        setFocus(element, null);
        return true;
      }
      return false;
    },
    [getContainer, setFocus]
  );

  // Handler de teclado
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorar se estiver em input de texto
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type === 'text'
      ) {
        // Permite navegação em inputs de texto com setas verticais
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
          return;
        }
      }
      if (target.tagName === 'TEXTAREA') {
        return;
      }

      const action = KEY_MAP[event.key];
      if (!action) return;

      event.preventDefault();
      event.stopPropagation();

      if (action === 'select') {
        if (currentFocusRef.current) {
          // Simula clique no elemento
          currentFocusRef.current.click();
          onSelect?.(currentFocusRef.current);
        }
      } else if (action === 'back') {
        onBack?.();
      } else {
        moveFocus(action);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled, moveFocus, onSelect, onBack]);

  // Suporte a gamepad
  useEffect(() => {
    if (!enabled) return;

    let animationFrameId: number;
    let lastButtonStates: boolean[] = [];

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads?.() || [];

      for (const gamepad of gamepads) {
        if (!gamepad) continue;

        // D-pad digital (botões 12-15 padrão)
        const dpadUp = gamepad.buttons[12]?.pressed;
        const dpadDown = gamepad.buttons[13]?.pressed;
        const dpadLeft = gamepad.buttons[14]?.pressed;
        const dpadRight = gamepad.buttons[15]?.pressed;
        const buttonA = gamepad.buttons[0]?.pressed;
        const buttonB = gamepad.buttons[1]?.pressed;

        // Detectar mudanças de estado para evitar repetição
        const currentStates = [dpadUp, dpadDown, dpadLeft, dpadRight, buttonA, buttonB];
        const hasChanged = currentStates.some(
          (state, index) => state && !lastButtonStates[index]
        );

        if (hasChanged) {
          if (dpadUp && !lastButtonStates[0]) moveFocus('up');
          else if (dpadDown && !lastButtonStates[1]) moveFocus('down');
          else if (dpadLeft && !lastButtonStates[2]) moveFocus('left');
          else if (dpadRight && !lastButtonStates[3]) moveFocus('right');
          else if (buttonA && !lastButtonStates[4] && currentFocusRef.current) {
            currentFocusRef.current.click();
            onSelect?.(currentFocusRef.current);
          } else if (buttonB && !lastButtonStates[5]) {
            onBack?.();
          }
        }

        lastButtonStates = currentStates;

        // Analógico esquerdo como D-pad
        const axisX = gamepad.axes[0] || 0;
        const axisY = gamepad.axes[1] || 0;
        const deadzone = 0.5;

        if (Math.abs(axisX) > deadzone || Math.abs(axisY) > deadzone) {
          // Debounce para evitar movimento muito rápido
          if (!lastButtonStates[6]) {
            if (axisY < -deadzone) moveFocus('up');
            else if (axisY > deadzone) moveFocus('down');
            else if (axisX < -deadzone) moveFocus('left');
            else if (axisX > deadzone) moveFocus('right');
            lastButtonStates[6] = true;
            setTimeout(() => {
              lastButtonStates[6] = false;
            }, 200);
          }
        }
      }

      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    const handleGamepadConnected = () => {
      if (!animationFrameId) {
        pollGamepad();
      }
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);

    // Se já tem gamepad conectado, inicia polling
    if (navigator.getGamepads?.().some((gp) => gp)) {
      pollGamepad();
    }

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [enabled, moveFocus, onSelect, onBack]);

  // Foca no primeiro elemento ao montar
  useEffect(() => {
    if (enabled && focusFirstOnMount) {
      // Pequeno delay para garantir que o DOM está pronto
      const timer = setTimeout(focusFirst, 100);
      return () => clearTimeout(timer);
    }
  }, [enabled, focusFirstOnMount, focusFirst]);

  // Handler para clique do mouse - atualiza o foco
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const focusable = target.closest<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable) {
        setFocus(focusable, null);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [enabled, setFocus]);

  return {
    focusedElement,
    setFocus,
    moveFocus,
    focusFirst,
    focusLast,
    focusElement,
    containerRef,
    currentFocusRef,
  };
}

// Hook para marcar um elemento como focável
export function useFocusable(
  ref: React.RefObject<HTMLElement>,
  options: {
    focusKey?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    disabled?: boolean;
  } = {}
) {
  const { focusKey, onFocus, onBlur, disabled = false } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.setAttribute('data-focusable', disabled ? 'false' : 'true');
    if (focusKey) {
      element.setAttribute('data-focus-key', focusKey);
    }

    const handleFocus = () => onFocus?.();
    const handleBlur = () => onBlur?.();

    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);

    return () => {
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
    };
  }, [ref, focusKey, onFocus, onBlur, disabled]);
}

// Context para navegação D-pad global
export interface DpadContextValue {
  focusedElement: HTMLElement | null;
  setFocus: (element: HTMLElement | null, direction?: Direction | null) => void;
  moveFocus: (direction: Direction) => boolean;
  focusFirst: () => void;
  focusLast: () => void;
  focusElement: (selectorOrId: string) => boolean;
  registerBackHandler: (handler: () => void) => () => void;
}

// Gerenciador global de handlers de voltar (pilha)
const backHandlers: Array<() => void> = [];

export function registerGlobalBackHandler(handler: () => void): () => void {
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.indexOf(handler);
    if (index > -1) {
      backHandlers.splice(index, 1);
    }
  };
}

export function triggerGlobalBack(): boolean {
  if (backHandlers.length > 0) {
    const lastHandler = backHandlers[backHandlers.length - 1];
    lastHandler();
    return true;
  }
  return false;
}

export default useDpadNavigation;
