import { PointerEvent, useMemo, useRef, useState } from 'react';
import {
  BOARD_SIZE,
  Board,
  Position,
  TILE_META,
  areAdjacent,
  createBoard,
  findMatches,
  resolveBoard,
  shuffledBoard,
  swapTiles,
} from './game/engine';
import { useTelegram } from './useTelegram';

const STARTING_MOVES = 24;
const STORAGE = {
  level: 'pp-balance-level',
  best: 'pp-balance-best',
  coins: 'pp-balance-coins',
  daily: 'pp-balance-daily',
};

type Screen = 'home' | 'game';
type RoundStatus = 'playing' | 'won' | 'lost';

type PointerStart = {
  position: Position;
  x: number;
  y: number;
};

function readNumber(key: string, fallback: number): number {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function samePosition(a: Position | null, b: Position): boolean {
  return a?.row === b.row && a.col === b.col;
}

function levelGoal(level: number): number {
  return 1300 + (level - 1) * 350;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="PP BALANCE">
      <div className="brand__symbol" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="brand__copy">
        <strong>PP BALANCE</strong>
        {!compact && <small>здоровая игра каждый день</small>}
      </div>
    </div>
  );
}

export default function App() {
  const telegram = useTelegram();
  const pointerStart = useRef<PointerStart | null>(null);

  const [screen, setScreen] = useState<Screen>('home');
  const [level, setLevel] = useState(() => readNumber(STORAGE.level, 1));
  const [bestScore, setBestScore] = useState(() => readNumber(STORAGE.best, 0));
  const [coins, setCoins] = useState(() => readNumber(STORAGE.coins, 120));
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(STARTING_MOVES);
  const [selected, setSelected] = useState<Position | null>(null);
  const [status, setStatus] = useState<RoundStatus>('playing');
  const [busy, setBusy] = useState(false);
  const [shuffleCount, setShuffleCount] = useState(2);
  const [toast, setToast] = useState<string | null>(null);

  const goal = levelGoal(level);
  const progress = Math.min(100, Math.round((score / goal) * 100));
  const playerName = telegram.user?.first_name || 'Игрок';
  const today = new Date().toISOString().slice(0, 10);
  const dailyClaimed = localStorage.getItem(STORAGE.daily) === today;

  const nextLevels = useMemo(
    () => [level, level + 1, level + 2, level + 3],
    [level],
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function persistCoins(nextCoins: number) {
    setCoins(nextCoins);
    localStorage.setItem(STORAGE.coins, String(nextCoins));
  }

  function startLevel(targetLevel = level) {
    setLevel(targetLevel);
    setBoard(createBoard());
    setScore(0);
    setMoves(STARTING_MOVES);
    setShuffleCount(2);
    setSelected(null);
    setStatus('playing');
    setBusy(false);
    setScreen('game');
    telegram.impact('medium');
  }

  function finishRound(nextScore: number, roundStatus: Exclude<RoundStatus, 'playing'>) {
    setStatus(roundStatus);
    setSelected(null);

    if (nextScore > bestScore) {
      setBestScore(nextScore);
      localStorage.setItem(STORAGE.best, String(nextScore));
    }

    if (roundStatus === 'won') {
      const reward = 30 + level * 5;
      persistCoins(coins + reward);
      telegram.notify('success');
    } else {
      telegram.notify('warning');
    }
  }

  async function attemptMove(from: Position, to: Position) {
    if (busy || status !== 'playing' || !areAdjacent(from, to)) return;

    setSelected(null);
    setBusy(true);
    const original = board;
    const swapped = swapTiles(original, from, to);
    setBoard(swapped);
    telegram.impact('light');
    await delay(140);

    if (findMatches(swapped).length === 0) {
      setBoard(original);
      telegram.notify('error');
      await delay(120);
      setBusy(false);
      return;
    }

    const result = resolveBoard(swapped);
    const nextScore = score + result.score;
    const nextMoves = moves - 1;

    setBoard(result.board);
    setScore(nextScore);
    setMoves(nextMoves);

    if (result.cascades > 1) {
      showToast(`Комбо ×${result.cascades} · +${result.score}`);
      telegram.impact('heavy');
    }

    if (nextScore >= goal) {
      finishRound(nextScore, 'won');
    } else if (nextMoves <= 0) {
      finishRound(nextScore, 'lost');
    }

    await delay(120);
    setBusy(false);
  }

  function handleTileTap(position: Position) {
    if (busy || status !== 'playing') return;

    if (!selected) {
      setSelected(position);
      telegram.select();
      return;
    }

    if (samePosition(selected, position)) {
      setSelected(null);
      return;
    }

    if (areAdjacent(selected, position)) {
      void attemptMove(selected, position);
      return;
    }

    setSelected(position);
    telegram.select();
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, position: Position) {
    pointerStart.current = {
      position,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const swipeDistance = Math.max(Math.abs(dx), Math.abs(dy));

    if (swipeDistance < 20) {
      handleTileTap(start.position);
      return;
    }

    const target = { ...start.position };
    if (Math.abs(dx) > Math.abs(dy)) {
      target.col += dx > 0 ? 1 : -1;
    } else {
      target.row += dy > 0 ? 1 : -1;
    }

    if (
      target.row >= 0 &&
      target.row < BOARD_SIZE &&
      target.col >= 0 &&
      target.col < BOARD_SIZE
    ) {
      void attemptMove(start.position, target);
    }
  }

  function useShuffle() {
    if (busy || status !== 'playing') return;
    if (shuffleCount <= 0) {
      showToast('Перемешивания закончились');
      return;
    }

    setBoard(shuffledBoard());
    setShuffleCount((value) => value - 1);
    setSelected(null);
    telegram.impact('medium');
    showToast('Поле перемешано');
  }

  function buyExtraMoves() {
    const price = 40;
    if (status !== 'playing') return;
    if (coins < price) {
      showToast('Недостаточно монет');
      telegram.notify('error');
      return;
    }

    persistCoins(coins - price);
    setMoves((value) => value + 5);
    telegram.notify('success');
    showToast('+5 ходов');
  }

  function claimDailyReward() {
    if (dailyClaimed) {
      showToast('Награда уже получена');
      return;
    }

    localStorage.setItem(STORAGE.daily, today);
    persistCoins(coins + 50);
    telegram.notify('success');
    showToast('+50 монет');
  }

  function goToNextLevel() {
    const nextLevel = level + 1;
    localStorage.setItem(STORAGE.level, String(nextLevel));
    startLevel(nextLevel);
  }

  if (screen === 'home') {
    return (
      <main className="app-shell home-screen">
        <header className="home-header">
          <BrandMark />
          <div className="coin-pill" aria-label={`${coins} монет`}>
            <span>🟡</span>
            <strong>{coins}</strong>
          </div>
        </header>

        <section className="welcome-card">
          <div>
            <p className="eyebrow">Привет, {playerName}!</p>
            <h1>Собери полезный баланс</h1>
            <p>
              Соединяй продукты, создавай комбо и открывай новые этапы PP BALANCE.
            </p>
          </div>
          <div className="welcome-card__bowl" aria-hidden="true">🥗</div>
        </section>

        <section className="level-hero">
          <div className="level-hero__top">
            <div>
              <span>Текущий этап</span>
              <strong>Уровень {level}</strong>
            </div>
            <div className="level-badge">{level}</div>
          </div>
          <div className="level-hero__path" aria-hidden="true">
            {nextLevels.map((item, index) => (
              <div className={`path-node ${index === 0 ? 'path-node--active' : ''}`} key={item}>
                {index === 0 ? '★' : item}
              </div>
            ))}
          </div>
          <button className="primary-button" type="button" onClick={() => startLevel()}>
            Играть сейчас
            <span>▶</span>
          </button>
        </section>

        <section className="dashboard-grid">
          <button className="dashboard-card daily-card" type="button" onClick={claimDailyReward}>
            <span className="dashboard-card__icon">🎁</span>
            <span>
              <strong>Ежедневный бонус</strong>
              <small>{dailyClaimed ? 'Уже получен' : '+50 монет сегодня'}</small>
            </span>
          </button>
          <div className="dashboard-card">
            <span className="dashboard-card__icon">🏆</span>
            <span>
              <strong>Лучший результат</strong>
              <small>{bestScore.toLocaleString('ru-RU')} очков</small>
            </span>
          </div>
        </section>

        <section className="mission-card">
          <div className="mission-card__icon">⚡</div>
          <div className="mission-card__content">
            <span>Задание дня</span>
            <strong>Сделай комбо ×3</strong>
            <div className="mini-progress"><span style={{ width: '35%' }} /></div>
          </div>
          <b>0/1</b>
        </section>

        <nav className="bottom-nav" aria-label="Основная навигация">
          <button className="bottom-nav__item bottom-nav__item--active" type="button">
            <span>⌂</span><small>Главная</small>
          </button>
          <button className="bottom-nav__item" type="button" onClick={() => showToast('Турниры появятся в v0.2')}>
            <span>🏆</span><small>Турнир</small>
          </button>
          <button className="bottom-nav__item" type="button" onClick={() => showToast('Магазин появится в v0.2')}>
            <span>🛍️</span><small>Магазин</small>
          </button>
          <button className="bottom-nav__item" type="button" onClick={() => showToast(`Профиль: ${playerName}`)}>
            <span>☺</span><small>Профиль</small>
          </button>
        </nav>

        {toast && <div className="toast">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="app-shell game-screen">
      <header className="game-header">
        <button className="icon-button" type="button" onClick={() => setScreen('home')} aria-label="На главную">
          ‹
        </button>
        <BrandMark compact />
        <div className="coin-pill coin-pill--small">
          <span>🟡</span><strong>{coins}</strong>
        </div>
      </header>

      <section className="game-stats">
        <div className="stat-card">
          <small>Уровень</small>
          <strong>{level}</strong>
        </div>
        <div className="stat-card stat-card--score">
          <small>Очки</small>
          <strong>{score.toLocaleString('ru-RU')}</strong>
        </div>
        <div className="stat-card">
          <small>Ходы</small>
          <strong>{moves}</strong>
        </div>
      </section>

      <section className="goal-panel">
        <div className="goal-panel__copy">
          <span>Цель уровня</span>
          <strong>{score.toLocaleString('ru-RU')} / {goal.toLocaleString('ru-RU')}</strong>
        </div>
        <div className="goal-progress"><span style={{ width: `${progress}%` }} /></div>
      </section>

      <section className={`game-board ${busy ? 'game-board--busy' : ''}`} aria-label="Игровое поле 8 на 8">
        {board.flatMap((row, rowIndex) =>
          row.map((tile, colIndex) => {
            if (!tile) return <div className="tile tile--empty" key={`empty-${rowIndex}-${colIndex}`} />;
            const position = { row: rowIndex, col: colIndex };
            return (
              <button
                type="button"
                className={`tile tile--${tile.kind} ${samePosition(selected, position) ? 'tile--selected' : ''}`}
                key={tile.id}
                aria-label={`${TILE_META[tile.kind].label}, ряд ${rowIndex + 1}, колонка ${colIndex + 1}`}
                onPointerDown={(event) => handlePointerDown(event, position)}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { pointerStart.current = null; }}
              >
                <span aria-hidden="true">{TILE_META[tile.kind].emoji}</span>
              </button>
            );
          }),
        )}
      </section>

      <section className="boosters" aria-label="Бустеры">
        <button type="button" className="booster" onClick={useShuffle}>
          <span>🔀</span>
          <strong>Перемешать</strong>
          <small>{shuffleCount} шт.</small>
        </button>
        <button type="button" className="booster" onClick={buyExtraMoves}>
          <span>➕</span>
          <strong>+5 ходов</strong>
          <small>40 монет</small>
        </button>
        <button type="button" className="booster" onClick={() => showToast('Молоток появится в v0.2')}>
          <span>🔨</span>
          <strong>Молоток</strong>
          <small>Скоро</small>
        </button>
      </section>

      <p className="game-hint">Нажми два соседних продукта или проведи пальцем по элементу</p>

      {status !== 'playing' && (
        <div className="result-overlay" role="dialog" aria-modal="true">
          <section className="result-card">
            <div className="result-card__icon">{status === 'won' ? '🏆' : '🥗'}</div>
            <p className="eyebrow">Уровень {level}</p>
            <h2>{status === 'won' ? 'Отличный баланс!' : 'Почти получилось'}</h2>
            <p>
              {status === 'won'
                ? `Ты набрал ${score.toLocaleString('ru-RU')} очков и получил ${30 + level * 5} монет.`
                : `Набрано ${score.toLocaleString('ru-RU')} из ${goal.toLocaleString('ru-RU')} очков.`}
            </p>
            {status === 'won' ? (
              <button type="button" className="primary-button" onClick={goToNextLevel}>
                Следующий уровень <span>→</span>
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={() => startLevel(level)}>
                Попробовать снова <span>↻</span>
              </button>
            )}
            <button type="button" className="text-button" onClick={() => setScreen('home')}>
              Вернуться на главную
            </button>
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
