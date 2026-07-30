export const BOARD_SIZE = 8;

export type TileKind =
  | 'tomato'
  | 'broccoli'
  | 'avocado'
  | 'egg'
  | 'rice'
  | 'chicken';

export type Position = {
  row: number;
  col: number;
};

export type Tile = {
  id: number;
  kind: TileKind;
};

export type Cell = Tile | null;
export type Board = Cell[][];

export const TILE_META: Record<
  TileKind,
  { emoji: string; label: string; shortLabel: string }
> = {
  tomato: { emoji: '🍅', label: 'Томат', shortLabel: 'Томат' },
  broccoli: { emoji: '🥦', label: 'Брокколи', shortLabel: 'Брок.' },
  avocado: { emoji: '🥑', label: 'Авокадо', shortLabel: 'Авок.' },
  egg: { emoji: '🥚', label: 'Яйцо', shortLabel: 'Яйцо' },
  rice: { emoji: '🍚', label: 'Рис', shortLabel: 'Рис' },
  chicken: { emoji: '🍗', label: 'Курица', shortLabel: 'Курица' },
};

const TILE_KINDS = Object.keys(TILE_META) as TileKind[];
let tileId = 1;

function makeTile(kind = randomKind()): Tile {
  return { id: tileId++, kind };
}

function randomKind(): TileKind {
  return TILE_KINDS[Math.floor(Math.random() * TILE_KINDS.length)];
}

function copyBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function createsImmediateMatch(
  board: Board,
  row: number,
  col: number,
  kind: TileKind,
): boolean {
  const horizontal =
    col >= 2 &&
    board[row][col - 1]?.kind === kind &&
    board[row][col - 2]?.kind === kind;

  const vertical =
    row >= 2 &&
    board[row - 1][col]?.kind === kind &&
    board[row - 2][col]?.kind === kind;

  return horizontal || vertical;
}

export function createBoard(size = BOARD_SIZE): Board {
  let board: Board;
  let attempts = 0;

  do {
    board = Array.from({ length: size }, () =>
      Array.from<Cell>({ length: size }).fill(null),
    );

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        let kind = randomKind();
        let safety = 0;

        while (createsImmediateMatch(board, row, col, kind) && safety < 30) {
          kind = randomKind();
          safety += 1;
        }

        board[row][col] = makeTile(kind);
      }
    }

    attempts += 1;
  } while (!hasPossibleMove(board) && attempts < 20);

  return board;
}

export function areAdjacent(a: Position, b: Position): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swapTiles(board: Board, a: Position, b: Position): Board {
  const next = copyBoard(board);
  [next[a.row][a.col], next[b.row][b.col]] = [
    next[b.row][b.col],
    next[a.row][a.col],
  ];
  return next;
}

export function findMatches(board: Board): Position[] {
  const matches = new Set<string>();
  const size = board.length;

  for (let row = 0; row < size; row += 1) {
    let start = 0;
    for (let col = 1; col <= size; col += 1) {
      const previous = board[row][col - 1];
      const current = col < size ? board[row][col] : null;
      const same = previous && current && previous.kind === current.kind;

      if (!same) {
        const runLength = col - start;
        if (previous && runLength >= 3) {
          for (let matchCol = start; matchCol < col; matchCol += 1) {
            matches.add(`${row}:${matchCol}`);
          }
        }
        start = col;
      }
    }
  }

  for (let col = 0; col < size; col += 1) {
    let start = 0;
    for (let row = 1; row <= size; row += 1) {
      const previous = board[row - 1]?.[col] ?? null;
      const current = row < size ? board[row][col] : null;
      const same = previous && current && previous.kind === current.kind;

      if (!same) {
        const runLength = row - start;
        if (previous && runLength >= 3) {
          for (let matchRow = start; matchRow < row; matchRow += 1) {
            matches.add(`${matchRow}:${col}`);
          }
        }
        start = row;
      }
    }
  }

  return [...matches].map((key) => {
    const [row, col] = key.split(':').map(Number);
    return { row, col };
  });
}

function clearMatches(board: Board, matches: Position[]): Board {
  const next = copyBoard(board);
  for (const { row, col } of matches) {
    next[row][col] = null;
  }
  return next;
}

function collapseAndRefill(board: Board): Board {
  const size = board.length;
  const next = Array.from({ length: size }, () =>
    Array.from<Cell>({ length: size }).fill(null),
  );

  for (let col = 0; col < size; col += 1) {
    const existing = board
      .map((row) => row[col])
      .filter((tile): tile is Tile => tile !== null);
    const missing = size - existing.length;
    const column = [
      ...Array.from({ length: missing }, () => makeTile()),
      ...existing,
    ];

    for (let row = 0; row < size; row += 1) {
      next[row][col] = column[row];
    }
  }

  return next;
}

export function resolveBoard(board: Board): {
  board: Board;
  score: number;
  cascades: number;
  removed: number;
} {
  let current = copyBoard(board);
  let score = 0;
  let cascades = 0;
  let removed = 0;

  for (let guard = 0; guard < 30; guard += 1) {
    const matches = findMatches(current);
    if (matches.length === 0) break;

    cascades += 1;
    removed += matches.length;
    score += matches.length * 100 * cascades;
    current = collapseAndRefill(clearMatches(current, matches));
  }

  if (!hasPossibleMove(current)) {
    current = createBoard(current.length);
  }

  return { board: current, score, cascades, removed };
}

export function hasPossibleMove(board: Board): boolean {
  const size = board.length;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const here = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const candidate of candidates) {
        if (candidate.row >= size || candidate.col >= size) continue;
        if (findMatches(swapTiles(board, here, candidate)).length > 0) {
          return true;
        }
      }
    }
  }

  return false;
}

export function shuffledBoard(size = BOARD_SIZE): Board {
  return createBoard(size);
}
