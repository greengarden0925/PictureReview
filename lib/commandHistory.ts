/**
 * Command Pattern — 每個操作都有 execute / undo，支援 redo。
 */

export interface Command {
  readonly description: string;
  execute(): void;
  undo(): void;
}

export class CommandHistory {
  private history: Command[] = [];
  private cursor = -1;

  get canUndo(): boolean {
    return this.cursor >= 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.history.length - 1;
  }

  get undoDescription(): string | null {
    return this.canUndo ? this.history[this.cursor].description : null;
  }

  get redoDescription(): string | null {
    return this.canRedo ? this.history[this.cursor + 1].description : null;
  }

  execute(cmd: Command): void {
    // 捨棄 cursor 之後的歷史（有新操作後不能再 redo 到舊的未來）
    this.history.splice(this.cursor + 1);
    this.history.push(cmd);
    this.cursor++;
    cmd.execute();
  }

  undo(): void {
    if (!this.canUndo) return;
    this.history[this.cursor].undo();
    this.cursor--;
  }

  redo(): void {
    if (!this.canRedo) return;
    this.cursor++;
    this.history[this.cursor].execute();
  }

  /** 換組時清空歷史，避免跨組 undo */
  clear(): void {
    this.history = [];
    this.cursor = -1;
  }
}

/**
 * 建立「設定問卷答案」的 Command。
 * 使用閉包捕捉 prevValue / nextValue，透過 setter 作用於 React state。
 */
export function makeSetAnswerCommand(
  questionId: string,
  nextValue: number | string,
  prevValue: number | string | undefined,
  setter: (
    updater: (
      prev: Record<string, number | string>
    ) => Record<string, number | string>
  ) => void
): Command {
  return {
    description: `設定 ${questionId} = ${nextValue}`,
    execute() {
      setter((prev) => ({ ...prev, [questionId]: nextValue }));
    },
    undo() {
      setter((prev) => {
        if (prevValue === undefined) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [questionId]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [questionId]: prevValue };
      });
    },
  };
}
